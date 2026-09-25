/**
 * After the company confirms the car is available, issue the Rovaro
 * Booking Fee payment link and email it to the customer.
 *
 * Used by the email confirmation token and by the in-app supplier response.
 */

import Company from "@models/company";
import { Order } from "@models/order";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  acquireMarketplaceHold,
  attachStripeSessionToHold,
  markHoldForRetry,
} from "@/domain/booking/bookingHold";
import {
  applyRentalStateTransition,
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import {
  clampStripeExpiresMinutes,
  createRentalCheckoutSession,
} from "@/domain/orders/rentalStripeCheckout";
import { sendCustomerPaymentRequestEmail } from "@/domain/orders/marketplaceBookingEmails";
import { computePriceSnapshotChecksum } from "@/domain/orders/priceSnapshotChecksum";

export async function startMarketplacePaymentAfterAvailability({
  order,
  actorEmail = "",
  ipAddress = "",
  userAgent = "",
} = {}) {
  if (!order?._id) {
    return { ok: false, code: "missing_order", message: "Order is required." };
  }
  if (!isPlatformBooking(order)) {
    return {
      ok: true,
      skipped: true,
      code: "not_platform_booking",
      reason: "not_platform_booking",
    };
  }
  if (!isMarketplaceRequestMode(order.bookingMode)) {
    return { ok: true, skipped: true, reason: "not_marketplace" };
  }
  if (String(order.payment?.status || "").toLowerCase() === "paid") {
    return { ok: true, skipped: true, reason: "already_paid" };
  }
  if (
    order.payment?.checkoutUrl &&
    resolveRentalState(order) === RENTAL_STATE.PAYMENT_PENDING
  ) {
    return {
      ok: true,
      skipped: true,
      reason: "link_exists",
      paymentUrl: order.payment.checkoutUrl,
    };
  }

  const now = new Date();
  const settings = await loadLegalSettings().catch(() => ({
    paymentLinkExpirationMinutes: 60,
  }));
  const expireMinutes = clampStripeExpiresMinutes(
    settings.paymentLinkExpirationMinutes
  );
  const holdExpiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000);

  const toConfirmed = applyRentalStateTransition(
    order,
    RENTAL_STATE.PARTNER_CONFIRMED
  );
  if (
    !toConfirmed.ok &&
    resolveRentalState(order) !== RENTAL_STATE.PARTNER_CONFIRMED &&
    resolveRentalState(order) !== RENTAL_STATE.PAYMENT_PENDING
  ) {
    return {
      ok: false,
      status: 409,
      code: toConfirmed.code || "illegal_transition",
      message: "This booking cannot be confirmed in its current state.",
    };
  }

  const hold = await acquireMarketplaceHold({
    carId: order.car,
    orderId: order._id,
    companyId: order.ownerId,
    pickupAtUtc: order.pickupAtUtc || order.timeIn,
    returnAtUtc: order.returnAtUtc || order.timeOut,
    holdExpiresAt,
    timezone: order.timezone,
    bookingMode: order.bookingMode,
  });

  if (!hold.ok) {
    await recordAuditEvent({
      action: "BOOKING_HOLD_CONFLICT",
      severity: "high",
      result: "failure",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { code: hold.code, message: hold.message },
    });
    return {
      ok: false,
      status: 409,
      code: hold.code,
      message: hold.message,
    };
  }

  const checkout = await createRentalCheckoutSession(String(order._id), {
    company: order.ownerId
      ? await Company.findById(order.ownerId)
          .select("name email rentalPayments prepaymentPercent")
          .lean()
      : null,
    emailCustomer: false,
  });

  if (!checkout.ok || !checkout.url) {
    await markHoldForRetry(order._id, {
      reason: checkout.code || "checkout_failed",
    });
    await recordAuditEvent({
      action: "RENTAL_CHECKOUT_FAILED",
      severity: "critical",
      result: "failure",
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { code: checkout.code, message: checkout.message },
    });
    try {
      await notifySuperadmin({
        title: `⚠️ Checkout failed after partner confirm — order #${order.orderNumber || order._id}`,
        bodyLines: [
          checkout.message || checkout.code || "Checkout failed",
          "No payment email was sent. Hold marked for retry.",
        ],
        meta: { orderId: order._id },
      });
    } catch (err) {
      console.error(
        "[marketplace-payment-after-availability] checkout fail notify",
        err?.message || err
      );
    }
    return {
      ok: false,
      status: 502,
      code: checkout.code || "checkout_failed",
      message:
        "Availability was recorded but the payment link could not be created. Rovaro has been notified.",
    };
  }

  const reloaded = await Order.findById(order._id);
  if (!reloaded) {
    return { ok: false, code: "not_found", message: "Order not found after checkout." };
  }
  if (resolveRentalState(reloaded) === RENTAL_STATE.REQUESTED) {
    applyRentalStateTransition(reloaded, RENTAL_STATE.PARTNER_CONFIRMED);
  }
  applyRentalStateTransition(reloaded, RENTAL_STATE.PAYMENT_PENDING);
  if (!reloaded.companyEmailDecision) {
    reloaded.companyEmailDecision = "accepted";
    reloaded.companyEmailDecisionAt = now;
  }
  if (!reloaded.partnerConfirmedAt) {
    reloaded.partnerConfirmedAt = now;
    reloaded.partnerConfirmedByEmail = actorEmail || "";
  }
  await reloaded.save();
  await attachStripeSessionToHold(reloaded._id, checkout.sessionId);

  const mailed = await sendCustomerPaymentRequestEmail({
    order: reloaded.toObject(),
    paymentUrl: checkout.url,
    expiresAt: checkout.expiresAt,
    stripeSessionId: checkout.sessionId,
  });
  if (!mailed.ok && !mailed.deduped) {
    console.error(
      "[marketplace-payment-after-availability] payment email failed",
      mailed
    );
  }

  await recordAuditEvent({
    action: "BOOKING_PAYMENT_LINK_ISSUED",
    userRole: "admin",
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    orderData: {
      orderId: reloaded._id,
      orderNumber: reloaded.orderNumber,
    },
    metadata: {
      sessionId: checkout.sessionId,
      priceChecksum: computePriceSnapshotChecksum(reloaded),
      reusedCheckout: Boolean(checkout.reused),
    },
  });

  return {
    ok: true,
    skipped: false,
    paymentUrl: checkout.url,
    bookingStatus: reloaded.bookingStatus,
    mailed: Boolean(mailed.ok || mailed.deduped),
  };
}
