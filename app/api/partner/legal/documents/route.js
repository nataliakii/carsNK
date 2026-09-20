import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { SIGNED_URL_TTL_SECONDS } from "@/domain/legal/drivingLicenceAccess";
import {
  buildPartnerLegalFolderPath,
  isAllowedPartnerDocumentType,
  isKnownPartnerDocumentKind,
  partnerDocumentResourceType,
  resourceTypeFromStorageRef,
  PARTNER_DOCUMENT_ALLOWED_TYPES,
  PARTNER_DOCUMENT_MAX_BYTES,
} from "@/domain/legal/partnerDocuments";
import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supporting evidence for the partner legal profile.
 *
 * Same handling as customer driving licences: session-gated on the way in,
 * only the Cloudinary public id is persisted, and reading a file back yields
 * a short-lived signed URL that is audit-logged. There is no public variant
 * of any of these methods.
 */
function resolveCompanyId(session, requested) {
  return resolvePartnerCompanyId(session, requested);
}

function noCompanyResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "No partner company is associated with this account",
    },
    { status: 403 }
  );
}

/**
 * Evidence may be replaced while the partner is still preparing the file or
 * fixing a rejection. Once it has been handed over for checking, or accepted,
 * the stored copy is what the operator reviewed and is left alone.
 */
const UPLOADABLE_STATUSES = new Set([
  PARTNER_VERIFICATION_STATUS.DRAFT,
  PARTNER_VERIFICATION_STATUS.REJECTED,
  PARTNER_VERIFICATION_STATUS.SUSPENDED,
]);

function uploadBufferToCloudinary(buffer, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        unique_filename: true,
        // Keeps the asset out of unsigned delivery URLs.
        type: "upload",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    const stream = require("stream");
    const passthrough = new stream.PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

/** GET — short-lived signed URLs for the partner's own evidence. */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = resolveCompanyId(
    session,
    request.nextUrl.searchParams.get("companyId")
  );
  if (!companyId) return noCompanyResponse();

  await connectToDB();
  const profile = await PartnerLegalProfile.findOne({ companyId })
    .select("documents")
    .lean();

  const stored = (profile?.documents || []).filter((doc) => doc?.storageRef);
  if (!stored.length) {
    return NextResponse.json({ success: true, documents: [] });
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return NextResponse.json(
      { success: false, message: "Document storage is not configured" },
      { status: 503 }
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const documents = stored.map((doc) => ({
    kind: doc.kind,
    label: doc.label || "",
    uploadedAt: doc.uploadedAt,
    accepted: Boolean(doc.accepted),
    note: doc.note || "",
    url: cloudinary.url(doc.storageRef, {
      secure: true,
      sign_url: true,
      type: "upload",
      resource_type: resourceTypeFromStorageRef(doc.storageRef),
      expires_at: expiresAt,
    }),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }));

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_DOCUMENT_ACCESSED",
    userRole: "admin",
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    severity: "medium",
    ipAddress,
    userAgent,
    metadata: {
      companyId,
      kinds: documents.map((d) => d.kind),
    },
  });

  return NextResponse.json({
    success: true,
    documents,
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
  });
}

/** POST multipart — upload or replace one piece of evidence. */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: "Expected a multipart upload" },
      { status: 400 }
    );
  }

  const companyId = resolveCompanyId(session, formData.get("companyId"));
  if (!companyId) return noCompanyResponse();

  const kind = String(formData.get("kind") || "").trim();
  if (!isKnownPartnerDocumentKind(kind)) {
    return NextResponse.json(
      { success: false, message: `Unknown document kind ${kind}` },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json(
      { success: false, message: "No file uploaded" },
      { status: 400 }
    );
  }

  const mime = String(file.type || "").toLowerCase();
  if (!isAllowedPartnerDocumentType(mime)) {
    return NextResponse.json(
      {
        success: false,
        message: `Allowed formats: ${PARTNER_DOCUMENT_ALLOWED_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > PARTNER_DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { success: false, message: "File too large (max 10 MB)" },
      { status: 400 }
    );
  }

  await connectToDB();
  let profile = await PartnerLegalProfile.findOne({ companyId });
  if (!profile) profile = new PartnerLegalProfile({ companyId });

  if (!UPLOADABLE_STATUSES.has(profile.verificationStatus)) {
    return NextResponse.json(
      {
        success: false,
        code: "locked",
        message: `Evidence cannot be changed while the profile is ${profile.verificationStatus}`,
      },
      { status: 409 }
    );
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return NextResponse.json({ success: false, message: cfg.message }, { status: 503 });
  }

  let uploaded;
  try {
    uploaded = await uploadBufferToCloudinary(
      buffer,
      buildPartnerLegalFolderPath(companyId),
      partnerDocumentResourceType(mime)
    );
  } catch (err) {
    console.error("[partner-legal-documents] upload failed", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Upload failed" },
      { status: 500 }
    );
  }

  const entry = {
    kind,
    label: String(formData.get("label") || file.name || "").slice(0, 200),
    storageRef: uploaded.public_id,
    uploadedAt: new Date(),
    uploadedByUserId: String(session.user?.id || ""),
    reviewedAt: null,
    reviewedByEmail: "",
    accepted: false,
    note: "",
  };

  const existingIndex = (profile.documents || []).findIndex(
    (doc) => doc.kind === kind
  );
  if (existingIndex >= 0) {
    profile.documents[existingIndex] = entry;
  } else {
    profile.documents.push(entry);
  }
  await profile.save();

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_DOCUMENT_UPLOADED",
    userRole: "admin",
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    severity: "medium",
    ipAddress,
    userAgent,
    metadata: { companyId, kind, replaced: existingIndex >= 0 },
  });

  return NextResponse.json({
    success: true,
    document: {
      kind: entry.kind,
      label: entry.label,
      uploadedAt: entry.uploadedAt,
      accepted: false,
    },
  });
}

/** DELETE ?kind= — remove a file the partner uploaded by mistake. */
export async function DELETE(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = resolveCompanyId(
    session,
    request.nextUrl.searchParams.get("companyId")
  );
  if (!companyId) return noCompanyResponse();

  const kind = String(request.nextUrl.searchParams.get("kind") || "").trim();
  if (!isKnownPartnerDocumentKind(kind)) {
    return NextResponse.json(
      { success: false, message: `Unknown document kind ${kind}` },
      { status: 400 }
    );
  }

  await connectToDB();
  const profile = await PartnerLegalProfile.findOne({ companyId });
  if (!profile) {
    return NextResponse.json(
      { success: false, message: "Partner legal profile not found" },
      { status: 404 }
    );
  }
  if (!UPLOADABLE_STATUSES.has(profile.verificationStatus)) {
    return NextResponse.json(
      {
        success: false,
        code: "locked",
        message: `Evidence cannot be changed while the profile is ${profile.verificationStatus}`,
      },
      { status: 409 }
    );
  }

  const existing = (profile.documents || []).find((doc) => doc.kind === kind);
  if (!existing) {
    return NextResponse.json({ success: true, removed: false });
  }

  profile.documents = profile.documents.filter((doc) => doc.kind !== kind);
  await profile.save();

  if (existing.storageRef && ensureCloudinaryConfigured().ok) {
    await cloudinary.uploader
      .destroy(existing.storageRef, {
        resource_type: resourceTypeFromStorageRef(existing.storageRef),
      })
      .catch((err) => {
        console.error(
          "[partner-legal-documents] asset delete failed",
          err?.message || err
        );
      });
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_DOCUMENT_DELETED",
    userRole: "admin",
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    severity: "medium",
    ipAddress,
    userAgent,
    metadata: { companyId, kind },
  });

  return NextResponse.json({ success: true, removed: true });
}
