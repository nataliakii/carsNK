import { PassThrough } from "stream";
import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { ownCompanyScope } from "@/domain/legal/companyLegalPage";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { SIGNED_URL_TTL_SECONDS } from "@/domain/legal/drivingLicenceAccess";
import {
  buildPartnerLegalFolderPath,
  isAllowedPartnerDocumentType,
  isKnownPartnerDocumentKind,
  partnerDocumentResourceType,
  resolvePartnerDocumentResourceType,
  PARTNER_DOCUMENT_ALLOWED_TYPES,
  PARTNER_DOCUMENT_MAX_BYTES,
} from "@/domain/legal/partnerDocuments";
import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cloudinary uploads can take ~15s; do not let the platform default cut them off. */
export const maxDuration = 60;

/**
 * Supporting evidence for the partner legal profile.
 *
 * Same handling as customer driving licences: session-gated on the way in,
 * only the Cloudinary public id is persisted, and reading a file back yields
 * a short-lived signed URL that is audit-logged. There is no public variant
 * of any of these methods.
 */
function resolveCompanyId(session, requested) {
  const scope = ownCompanyScope(session, requested);
  if (scope.forbidden) return "";
  return scope.companyId || resolvePartnerCompanyId(session, requested);
}

function jsonError(status, error, message, extra) {
  return NextResponse.json(
    { success: false, error, message, ...(extra || {}) },
    { status }
  );
}

function noCompanyResponse() {
  return jsonError(
    403,
    "no_company",
    "No partner company is associated with this account"
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
    const passthrough = new PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadStream);
  });
}

function isDuplicateKeyError(err) {
  return Number(err?.code) === 11000;
}

/**
 * Two first-time uploads (or an upload racing a profile save) both used to
 * `new PartnerLegalProfile` + `save()`, and the loser threw E11000 with no JSON.
 */
async function loadOrCreateProfile(companyId) {
  const existing = await PartnerLegalProfile.findOne({ companyId });
  if (existing) return existing;
  try {
    const created = new PartnerLegalProfile({ companyId, documents: [] });
    await created.save();
    return created;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const raced = await PartnerLegalProfile.findOne({ companyId });
    if (!raced) throw err;
    return raced;
  }
}

/** Replace or append one evidence slot without dropping a parallel upload. */
async function saveDocumentEntry(companyId, entry) {
  const replaced = await PartnerLegalProfile.findOneAndUpdate(
    { companyId, "documents.kind": entry.kind },
    { $set: { "documents.$": entry } },
    { new: true }
  );
  if (replaced) return { replaced: true };

  const pushed = await PartnerLegalProfile.findOneAndUpdate(
    { companyId, "documents.kind": { $ne: entry.kind } },
    { $push: { documents: entry } },
    { new: true }
  );
  if (pushed) return { replaced: false };

  const retry = await PartnerLegalProfile.findOneAndUpdate(
    { companyId, "documents.kind": entry.kind },
    { $set: { "documents.$": entry } },
    { new: true }
  );
  if (retry) return { replaced: true };

  throw new Error("Partner legal profile not found");
}

/** GET — short-lived signed URLs for the partner's own evidence. */
export async function GET(request) {
  try {
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
      return jsonError(503, "storage_unconfigured", "Document storage is not configured");
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const documents = stored.map((doc) => {
      const resourceType = resolvePartnerDocumentResourceType(doc);
      return {
        kind: doc.kind,
        label: doc.label || "",
        uploadedAt: doc.uploadedAt,
        accepted: Boolean(doc.accepted),
        note: doc.note || "",
        resourceType,
        url: cloudinary.url(doc.storageRef, {
          secure: true,
          sign_url: true,
          type: "upload",
          resource_type: resourceType,
          expires_at: expiresAt,
        }),
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      };
    });

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
  } catch (err) {
    console.error("[partner-legal-documents] GET failed", err?.message || err);
    return jsonError(500, "view_failed", "Could not load documents");
  }
}

/** POST multipart — upload or replace one piece of evidence. */
export async function POST(request) {
  try {
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(400, "invalid_multipart", "Expected a multipart upload");
    }

    const companyId = resolveCompanyId(session, formData.get("companyId"));
    if (!companyId) return noCompanyResponse();

    const kind = String(formData.get("kind") || "").trim();
    if (!isKnownPartnerDocumentKind(kind)) {
      return jsonError(400, "unknown_kind", `Unknown document kind ${kind}`);
    }

    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return jsonError(400, "no_file", "No file uploaded");
    }

    const mime = String(file.type || "").toLowerCase();
    if (!isAllowedPartnerDocumentType(mime)) {
      return jsonError(
        400,
        "unsupported_type",
        `Allowed formats: ${PARTNER_DOCUMENT_ALLOWED_TYPES.join(", ")}`
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > PARTNER_DOCUMENT_MAX_BYTES) {
      return jsonError(400, "file_too_large", "File too large (max 10 MB)");
    }

    await connectToDB();
    const profile = await loadOrCreateProfile(companyId);

    if (!UPLOADABLE_STATUSES.has(profile.verificationStatus)) {
      return jsonError(
        409,
        "locked",
        `Evidence cannot be changed while the profile is ${profile.verificationStatus}`,
        { code: "locked" }
      );
    }

    const cfg = ensureCloudinaryConfigured();
    if (!cfg.ok) {
      return jsonError(503, "storage_unconfigured", cfg.message);
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
      return jsonError(500, "upload_failed", "Upload failed");
    }

    const entry = {
      kind,
      label: String(formData.get("label") || file.name || "").slice(0, 200),
      storageRef: uploaded.public_id,
      resourceType: partnerDocumentResourceType(mime),
      uploadedAt: new Date(),
      uploadedByUserId: String(session.user?.id || ""),
      reviewedAt: null,
      reviewedByEmail: "",
      accepted: false,
      note: "",
    };

    const { replaced } = await saveDocumentEntry(companyId, entry);

    const { ipAddress, userAgent } = extractAuditContext(request);
    await recordAuditEvent({
      action: "PARTNER_DOCUMENT_UPLOADED",
      userRole: "admin",
      userId: session.user?.id,
      userEmail: session.user?.email || "",
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: { companyId, kind, replaced },
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
  } catch (err) {
    console.error("[partner-legal-documents] POST failed", err?.message || err);
    return jsonError(500, "upload_failed", "Upload failed");
  }
}

/** DELETE ?kind= — remove a file the partner uploaded by mistake. */
export async function DELETE(request) {
  try {
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    const companyId = resolveCompanyId(
      session,
      request.nextUrl.searchParams.get("companyId")
    );
    if (!companyId) return noCompanyResponse();

    const kind = String(request.nextUrl.searchParams.get("kind") || "").trim();
    if (!isKnownPartnerDocumentKind(kind)) {
      return jsonError(400, "unknown_kind", `Unknown document kind ${kind}`);
    }

    await connectToDB();
    const profile = await PartnerLegalProfile.findOne({ companyId });
    if (!profile) {
      return jsonError(404, "not_found", "Partner legal profile not found");
    }
    if (!UPLOADABLE_STATUSES.has(profile.verificationStatus)) {
      return jsonError(
        409,
        "locked",
        `Evidence cannot be changed while the profile is ${profile.verificationStatus}`,
        { code: "locked" }
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
          resource_type: resolvePartnerDocumentResourceType(existing),
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
  } catch (err) {
    console.error("[partner-legal-documents] DELETE failed", err?.message || err);
    return jsonError(500, "remove_failed", "Could not remove the document");
  }
}
