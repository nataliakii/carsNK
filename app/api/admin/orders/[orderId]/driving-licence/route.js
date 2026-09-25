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
import {
  recordDrivingLicenceAccess,
  extractAuditContext,
} from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders/{orderId}/driving-licence
 *
 * Returns short-lived signed URLs for the customer's driving licence images.
 *
 * There is deliberately no public variant of this route: the session check,
 * the fleet-ownership check and the lawful-stage check all run before any URL
 * is produced, and every successful access is written to the audit log.
 */
export async function GET(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  await connectToDB();

  const order = await Order.findById(orderId)
    .select(
      "ownerId confirmed payment pickupAtUtc returnAtUtc timeIn timeOut rentalStartDate rentalEndDate drivingLicenceUrls orderNumber"
    )
    .lean();

  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  const decision = evaluateDrivingLicenceAccess({
    order,
    isSuperadmin,
    sessionOwnerId: session.user?.ownerId || null,
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { success: false, message: decision.message, code: decision.code },
      { status: decision.status }
    );
  }

  const urls = Array.isArray(order.drivingLicenceUrls)
    ? order.drivingLicenceUrls
    : [];
  if (urls.length === 0) {
    return NextResponse.json({ success: true, documents: [] });
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    return NextResponse.json(
      { success: false, message: "Document storage is not configured" },
      { status: 503 }
    );
  }

  const delivery = signedDocumentDelivery();
  const documents = [];

  for (const url of urls) {
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

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordDrivingLicenceAccess({
    orderId: String(orderId),
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    userRole: isSuperadmin ? "superadmin" : "admin",
    ipAddress,
    userAgent,
    mode: request.nextUrl.searchParams.get("mode") === "download" ? "download" : "view",
    assetRef: documents.map((d) => d.publicId).join(","),
  });

  return NextResponse.json({
    success: true,
    documents,
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
  });
}
