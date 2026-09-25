import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import {
  evaluateDrivingLicenceAccess,
  signedDocumentDelivery,
} from "@/domain/legal/drivingLicenceAccess";
import { verifyDownloadGrant } from "@/domain/legal/drivingLicenceDownloadGrant";
import {
  recordDrivingLicenceAccess,
  recordDrivingLicenceAccessDenied,
  extractAuditContext,
} from "@/domain/legal/auditTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LICENCE_SELECT = [
  "ownerId",
  "confirmed",
  "payment",
  "source",
  "my_order",
  "offline",
  "bookingMode",
  "pickupAtUtc",
  "returnAtUtc",
  "timeIn",
  "timeOut",
  "rentalStartDate",
  "rentalEndDate",
  "drivingLicenceSnapshot",
].join(" ");

/** One generic refusal for every reason a download can fail. */
function notFound() {
  return NextResponse.json(
    { success: false, code: "not_found", message: "Document not found" },
    { status: 404 }
  );
}

/**
 * POST /api/admin/orders/{orderId}/driving-licence/download
 *
 * Streams the captured driving licence document through the server.
 *
 * The grant arrives in the request body, never in the URL: a link that carries
 * authorisation data leaks through history, referrers and access logs. The grant
 * only narrows which document and for how long — authorisation is decided again
 * here from the session, the order's ownership and the verified-payment state,
 * so an old grant cannot outlive the permission that produced it.
 *
 * The client receives bytes. No storage reference, signed URL or delivery URL
 * ever crosses this boundary.
 */
export async function POST(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  const { ipAddress, userAgent } = extractAuditContext(request);
  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  const actorRole = isSuperadmin ? "superadmin" : "admin";

  const deny = async (reason) => {
    await recordDrivingLicenceAccessDenied({
      orderId: String(orderId),
      userId: session.user?.id,
      userEmail: session.user?.email || "",
      userRole: actorRole,
      ipAddress,
      userAgent,
      mode: "download",
      reason,
    });
    return notFound();
  };

  let grantToken = "";
  try {
    const body = await request.json();
    grantToken = String(body?.grant || "");
  } catch {
    return deny("grant_malformed");
  }

  const grant = verifyDownloadGrant(grantToken);
  if (!grant.ok) return deny(grant.code);
  if (grant.orderId !== String(orderId)) return deny("grant_order_mismatch");

  await connectToDB();
  const order = await Order.findById(orderId).select(LICENCE_SELECT).lean();

  // Re-decided from scratch. The grant is not evidence of permission.
  const decision = evaluateDrivingLicenceAccess({
    order,
    isSuperadmin,
    sessionOwnerId: session.user?.ownerId || null,
  });
  if (!decision.allowed) return deny(decision.code);

  const storageReference = String(
    order?.drivingLicenceSnapshot?.storageReference || ""
  ).trim();
  if (!storageReference || storageReference !== grant.storageReference) {
    return deny("document_reference_mismatch");
  }

  const cfg = ensureCloudinaryConfigured();
  if (!cfg.ok) {
    console.error("[licence-download] storage not configured");
    return NextResponse.json(
      { success: false, code: "STORAGE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  const delivery = signedDocumentDelivery(new Date(), {
    storageType: order?.drivingLicenceSnapshot?.storageType || "authenticated",
    resourceType: grant.resourceType,
  });
  const signedUrl = cloudinary.url(storageReference, delivery.options);

  let upstream;
  try {
    upstream = await fetch(signedUrl, { cache: "no-store" });
  } catch (err) {
    // Log the failure, not the URL that failed.
    console.error("[licence-download] storage fetch failed", err?.message || err);
    return deny("storage_fetch_failed");
  }
  if (!upstream.ok || !upstream.body) {
    console.error("[licence-download] storage rejected the read", upstream.status);
    return deny("storage_read_rejected");
  }

  await recordDrivingLicenceAccess({
    orderId: String(orderId),
    userId: session.user?.id,
    userEmail: session.user?.email || "",
    userRole: actorRole,
    ipAddress,
    userAgent,
    mode: "download",
    assetRef: storageReference,
    result: "success",
  });

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": 'inline; filename="driving-licence"',
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
