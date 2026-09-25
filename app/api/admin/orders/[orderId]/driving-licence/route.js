import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { cloudinaryPublicIdFromSecureUrl } from "@/domain/orders/cloudinaryPublicIdFromSecureUrl";
import {
  evaluateDrivingLicenceAccess,
  issuedUrlIsPermanent,
  signedDocumentDelivery,
  SIGNED_URL_TTL_SECONDS,
} from "@/domain/legal/drivingLicenceAccess";
import { redactDrivingLicenceSnapshot } from "@/domain/legal/drivingLicenceSnapshot";
import { createDownloadGrant } from "@/domain/legal/drivingLicenceDownloadGrant";
import {
  recordDrivingLicenceAccess,
  recordDrivingLicenceAccessDenied,
  extractAuditContext,
} from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fields the access decision and the licence view both need. */
const LICENCE_SELECT = [
  "ownerId",
  "confirmed",
  "payment",
  "source",
  "my_order",
  "offline",
  "bookingMode",
  "bookingFeePaymentStatus",
  "pickupAtUtc",
  "returnAtUtc",
  "timeIn",
  "timeOut",
  "rentalStartDate",
  "rentalEndDate",
  "drivingLicenceUrls",
  "drivingLicenceSnapshot",
  "drivingLicencePurgedAt",
  "orderNumber",
].join(" ");

/**
 * GET /api/admin/orders/{orderId}/driving-licence
 *
 * Licence metadata plus short-lived handles for the documents.
 *
 * There is deliberately no public variant: the session check, the ownership
 * check and the verified-payment check all run before anything is produced, and
 * every attempt — allowed or refused — is written to the audit log.
 *
 * The captured snapshot is served as a short-lived grant, never as a storage
 * reference or delivery URL. Legacy admin-uploaded images still return signed
 * expiring URLs for the existing gallery.
 */
export async function GET(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  await connectToDB();

  const order = await Order.findById(orderId).select(LICENCE_SELECT).lean();

  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  const decision = evaluateDrivingLicenceAccess({
    order,
    isSuperadmin,
    sessionOwnerId: session.user?.ownerId || null,
  });

  const { ipAddress, userAgent } = extractAuditContext(request);
  const actorRole = isSuperadmin ? "superadmin" : "admin";
  const mode =
    request.nextUrl.searchParams.get("mode") === "download" ? "download" : "view";

  if (!decision.allowed) {
    // A refusal is as interesting to security review as a success.
    await recordDrivingLicenceAccessDenied({
      orderId: String(orderId),
      userId: session.user?.id,
      userEmail: session.user?.email || "",
      userRole: actorRole,
      ipAddress,
      userAgent,
      mode,
      reason: decision.code,
    });
    return NextResponse.json(
      { success: false, message: decision.message, code: decision.code },
      { status: decision.status }
    );
  }

  const snapshot = order.drivingLicenceSnapshot || null;
  const legacyUrls = Array.isArray(order.drivingLicenceUrls)
    ? order.drivingLicenceUrls
    : [];
  const storageReference = String(snapshot?.storageReference || "").trim();

  if (legacyUrls.length === 0 && !storageReference) {
    await recordDrivingLicenceAccess({
      orderId: String(orderId),
      userId: session.user?.id,
      userEmail: session.user?.email || "",
      userRole: actorRole,
      ipAddress,
      userAgent,
      mode,
      assetRef: "",
      result: "success",
      reason: "no_document",
    });
    return NextResponse.json({
      success: true,
      documents: [],
      licence: redactDrivingLicenceSnapshot(snapshot),
      purgedAt: order.drivingLicencePurgedAt || null,
    });
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return NextResponse.json(
      { success: false, message: "Document storage is not configured" },
      { status: 503 }
    );
  }

  const documents = [];
  if (legacyUrls.length > 0) {
    const delivery = signedDocumentDelivery();
    for (const url of legacyUrls) {
      const publicId = cloudinaryPublicIdFromSecureUrl(url);
      if (!publicId) continue;
      const signedUrl = cloudinary.url(publicId, delivery.options);
      if (issuedUrlIsPermanent(url, signedUrl)) continue;
      documents.push({
        publicId,
        url: signedUrl,
        expiresAt: delivery.expiresAt,
      });
    }
  }

  let capturedDocument = null;
  if (storageReference) {
    const grant = createDownloadGrant({
      orderId: String(orderId),
      storageReference,
      storageType: snapshot?.storageType || "authenticated",
      resourceType: "image",
    });
    if (grant.ok) {
      capturedDocument = {
        grant: grant.grant,
        expiresAt: grant.expiresAt,
        ttlSeconds: grant.ttlSeconds,
      };
    }
  }

  await recordDrivingLicenceAccess({
    orderId: String(orderId),
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    userRole: actorRole,
    ipAddress,
    userAgent,
    mode,
    // Storage references only. Never the bytes, never the signed URL or grant.
    assetRef: [...documents.map((d) => d.publicId), storageReference]
      .filter(Boolean)
      .join(","),
    result: "success",
  });

  return NextResponse.json({
    success: true,
    documents,
    licence: redactDrivingLicenceSnapshot(snapshot),
    capturedDocument,
    purgedAt: order.drivingLicencePurgedAt || null,
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
