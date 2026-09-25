/**
 * Persist a marketplace gross correction. Never creates a Checkout Session
 * or a refund. After payment the original paid snapshot is left untouched.
 */

import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { expireUnpaidMarketplacePayment } from "@/domain/booking/expireMarketplacePayment";
import { expireRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { ROLE } from "@models/user";
import {
  appendPriceRevision,
  capturePaidMarketplaceFeeSnapshot,
  MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT,
  PRICE_CORRECTION_CODE,
  previewMarketplaceGrossRevision,
} from "@/domain/orders/marketplacePriceCorrection";
import { sendMarketplacePriceCorrectionEmails } from "@/domain/orders/marketplaceBookingEmails";

function roleName(sessionRole) {
  const n = Number(sessionRole);
  if (n === ROLE.SUPERADMIN) return "SUPERADMIN";
  if (String(sessionRole || "").toUpperCase() === "SUPERADMIN") return "SUPERADMIN";
  return "ADMIN";
}

export async function applyMarketplacePriceCorrection({
  orderId,
  revisedGrossMinor,
  reason,
  actorEmail = "",
  actorRole = "",
  actorUserId = "",
  confirmZeroSupplierBalance = false,
  ipAddress = "",
  userAgent = "",
  now = new Date(),
} = {}) {
  await connectToDB();
  const order = await Order.findById(orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }
  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return {
      ok: false,
      status: 400,
      code: PRICE_CORRECTION_CODE.NOT_MARKETPLACE,
      message: "Price correction applies only to Spain marketplace bookings.",
    };
  }

  const preview = previewMarketplaceGrossRevision({
    order: order.toObject ? order.toObject() : order,
    revisedGrossMinor,
    reason,
    actorRole: roleName(actorRole),
    confirmZeroSupplierBalance,
    now,
  });
  if (!preview.ok) {
    return { ...preview, status: preview.code === PRICE_CORRECTION_CODE.FORBIDDEN ? 403 : 400 };
  }

  const revision = {
    ...preview.revision,
    actor: String(actorEmail || actorUserId || "superadmin"),
  };

  if (preview.paid && !order.paidMarketplaceFeeSnapshot) {
    order.set(
      "paidMarketplaceFeeSnapshot",
      capturePaidMarketplaceFeeSnapshot(order, { now }),
      { strict: false }
    );
  }

  const previousPaidSnapshot = order.paidMarketplaceFeeSnapshot
    ? { ...order.paidMarketplaceFeeSnapshot }
    : null;

  order.set("authoritativePrice", preview.nextAuthoritativePrice, {
    strict: false,
  });
  order.totalPrice = preview.nextTotalMajor;
  order.pricingVersion = revision.pricingVersion;
  order.set(
    "priceRevisions",
    appendPriceRevision(order.priceRevisions, revision),
    { strict: false }
  );

  if (preview.paid && previousPaidSnapshot) {
    order.set("paidMarketplaceFeeSnapshot", previousPaidSnapshot, {
      strict: false,
    });
  }

  // The stored checksum exists to catch a price that moved without an
  // explanation. This revision *is* the explanation and it is recorded in
  // priceRevisions, so the unpaid order carries the checksum of the price a
  // customer would now be asked to pay. A paid order keeps the checksum of what
  // was actually charged.
  if (!preview.paid) {
    order.set(
      "payment",
      {
        ...(order.payment && typeof order.payment === "object" ? order.payment : {}),
        priceChecksum: computePriceSnapshotChecksum(order),
      },
      { strict: false }
    );
  }

  await order.save();

  let invalidated = null;
  if (!preview.paid && order.payment?.providerPaymentId) {
    await expireRentalCheckoutSession(String(order._id)).catch(() => {});
    invalidated = await expireUnpaidMarketplacePayment({
      order,
      sessionId: order.payment?.providerPaymentId,
      reason: "price_revised_before_payment",
      sendEmail: false,
      now,
    });
  }

  const mailed = await sendMarketplacePriceCorrectionEmails({
    order: order.toObject ? order.toObject() : order,
    revision,
  }).catch((err) => {
    console.error("[price correction] notify failed", err?.message || err);
    return { ok: false };
  });

  await recordAuditEvent({
    action: preview.paid
      ? MARKETPLACE_PRICE_CORRECTED_AFTER_PAYMENT
      : "FORCE_UPDATE_ORDER",
    userRole: "superadmin",
    userEmail: actorEmail,
    userId: actorUserId || undefined,
    severity: "high",
    reason: revision.reason,
    ipAddress,
    userAgent,
    orderData: {
      orderId: order._id,
      orderNumber: order.orderNumber,
    },
    metadata: {
      companyId: order.ownerId ? String(order.ownerId) : "",
      previousGrossMinor: revision.previousGrossMinor,
      revisedGrossMinor: revision.revisedGrossMinor,
      fixedPaidPlatformAmountMinor: revision.fixedPaidPlatformAmountMinor,
      previousSupplierBalanceMinor: revision.previousSupplierBalanceMinor,
      revisedSupplierBalanceMinor: revision.revisedSupplierBalanceMinor,
      currency: revision.currency,
      paid: preview.paid,
      createsCheckoutSession: false,
      createsRefund: false,
    },
  });

  return {
    ok: true,
    paid: preview.paid,
    revision,
    preview,
    mailed,
    invalidated,
    createsCheckoutSession: false,
    createsRefund: false,
    order: order.toObject ? order.toObject() : order,
  };
}
