/**
 * The superadmin's manual send of a customer payment link.
 *
 * This is a timing override, not a second payment path. It composes three
 * modules that already exist and adds no Stripe plumbing of its own:
 *
 *   amount authority  → domain/orders/superadminPaymentLinkPolicy.js
 *   recorded override → domain/orders/applyMarketplacePriceCorrection.js
 *   first link        → domain/orders/startMarketplacePaymentAfterAvailability.js
 *   replacement link  → domain/orders/reissueMarketplacePaymentLink.js
 *
 * The actor arrives from the caller's verified session. Nothing here reads a
 * request body, and the capability is asserted again on the loaded order so a
 * hidden button is never the protection.
 */

import { Order } from "@models/order";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import {
  RENTAL_STATE,
  resolveRentalState,
} from "@/domain/booking/rentalBookingState";
import {
  assertBookingCapability,
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import { applyMarketplacePriceCorrection } from "@/domain/orders/applyMarketplacePriceCorrection";
import { startMarketplacePaymentAfterAvailability } from "@/domain/orders/startMarketplacePaymentAfterAvailability";
import {
  PAYMENT_LINK_REISSUE_REASONS,
  reissueMarketplacePaymentLink,
} from "@/domain/orders/reissueMarketplacePaymentLink";
import {
  evaluateManualPaymentLinkAmount,
  prefillManualPaymentLinkAmount,
} from "@/domain/orders/superadminPaymentLinkPolicy";
import { recordAuditEvent } from "@/domain/legal/auditTrail";

function plain(doc) {
  return doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function activeLink(order, now) {
  const pay = order?.payment || {};
  if (String(pay.status || "") !== "pending" && !pay.checkoutUrl) return null;
  if (String(pay.status || "") === "paid") return null;
  if (!pay.checkoutUrl) return null;
  if (pay.expiresAt && new Date(pay.expiresAt) <= now) return null;
  return {
    url: pay.checkoutUrl,
    sessionId: String(pay.providerPaymentId || ""),
    expiresAt: pay.expiresAt || null,
  };
}

async function loadCompany(order) {
  if (!order?.ownerId) return null;
  return Company.findById(order.ownerId)
    .select("name email marketplaceBookingFeeBps rentalPayments prepaymentPercent")
    .lean()
    .catch(() => null);
}

/**
 * @param {{
 *   orderId: string,
 *   actorUser: object,
 *   amountOverride?: { grossMinor: number, reason: string }|null,
 *   confirmZeroSupplierBalance?: boolean,
 *   reasonNote?: string,
 *   idempotencyKey?: string,
 *   ipAddress?: string,
 *   userAgent?: string,
 *   now?: Date,
 * }} input
 */
export async function sendSuperadminPaymentLink({
  orderId,
  actorUser,
  amountOverride = null,
  confirmZeroSupplierBalance = false,
  reasonNote = "",
  idempotencyKey = "",
  ipAddress = "",
  userAgent = "",
  now = new Date(),
} = {}) {
  await connectToDB();
  const doc = await Order.findById(orderId);
  if (!doc) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }

  const capabilities = resolveOrderCapabilities(plain(doc), actorUser, { now });
  const mayIssue = assertBookingCapability(
    capabilities,
    BOOKING_CAPABILITY.ISSUE_CUSTOMER_PAYMENT_LINK
  );
  if (!mayIssue.ok) return mayIssue;
  if (amountOverride) {
    const mayPrice = assertBookingCapability(
      capabilities,
      BOOKING_CAPABILITY.CORRECT_PLATFORM_BOOKING_PRICE
    );
    if (!mayPrice.ok) return mayPrice;
  }

  const company = await loadCompany(doc);
  const evaluation = evaluateManualPaymentLinkAmount({
    order: plain(doc),
    requestedGrossMinor: amountOverride ? amountOverride.grossMinor : null,
    requestedCurrency: "",
    reason: amountOverride ? amountOverride.reason : "",
    confirmZeroSupplierBalance,
    company,
    now,
  });
  if (!evaluation.ok) {
    return {
      ok: false,
      status: 400,
      code: evaluation.code,
      message: evaluation.message,
      prefill: evaluation.prefill || null,
    };
  }

  // A link that is still payable is the answer to a second press, not a reason
  // to mint another session. Charging the customer twice is worse than a button
  // that declines to act.
  const existing = activeLink(doc, now);
  if (existing && !evaluation.changed) {
    return {
      ok: true,
      status: 200,
      reused: true,
      priceCorrected: false,
      amount: evaluation,
      ...existing,
      order: plain(doc),
    };
  }

  let correction = null;
  if (evaluation.changed) {
    correction = await applyMarketplacePriceCorrection({
      orderId: String(doc._id),
      revisedGrossMinor: evaluation.grossMinor,
      reason: amountOverride.reason,
      actorEmail: actorUser?.email || "",
      actorRole: "SUPERADMIN",
      actorUserId: actorUser?.id || actorUser?._id || "",
      confirmZeroSupplierBalance,
      ipAddress,
      userAgent,
      now,
    });
    if (!correction.ok) {
      return {
        ok: false,
        status: correction.status || 400,
        code: correction.code,
        message: correction.message,
      };
    }
  }

  const fresh = await Order.findById(doc._id);
  if (!fresh) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }
  if (String(fresh.payment?.status || "") === "paid") {
    return {
      ok: false,
      status: 409,
      code: "already_paid",
      message: "This booking is already paid.",
      priceCorrected: Boolean(correction),
    };
  }

  const state = resolveRentalState(fresh);
  const hadSession = Boolean(fresh.payment?.providerPaymentId);
  let issued;
  let path;

  if (state === RENTAL_STATE.REQUESTED && !hadSession) {
    // No link has ever existed and the supplier has not answered in the
    // console. This is the rehoming case: Rovaro arranged the vehicle off
    // platform and records itself as the source of that assurance.
    path = "first_link";
    const started = await startMarketplacePaymentAfterAvailability({
      order: fresh,
      actorEmail: actorUser?.email || "",
      ipAddress,
      userAgent,
    });
    issued = started.ok
      ? {
          ok: true,
          url: started.paymentUrl || "",
          reused: Boolean(started.skipped),
          mailed: started.mailed,
        }
      : started;
  } else {
    // A link existed and lapsed, or the supplier already confirmed. The reissue
    // path owns holds, expiry cleanup and partner compliance for that case.
    path = "reissue";
    const reissued = await reissueMarketplacePaymentLink({
      orderId: String(fresh._id),
      reason: PAYMENT_LINK_REISSUE_REASONS.CUSTOMER_REQUESTED,
      reasonNote:
        String(reasonNote || "").trim() ||
        (amountOverride?.reason ? `Amount revised: ${amountOverride.reason}` : ""),
      actorEmail: actorUser?.email || "",
      actorRole: "superadmin",
      ipAddress,
      userAgent,
      idempotencyKey,
      now,
    });
    issued = reissued;
  }

  if (!issued.ok || !issued.url) {
    return {
      ok: false,
      status: issued.status || 502,
      code: issued.code || "payment_link_failed",
      message:
        issued.message ||
        "The amount was saved but the payment link could not be created.",
      priceCorrected: Boolean(correction),
    };
  }

  await recordAuditEvent({
    action: "BOOKING_PAYMENT_LINK_SENT_BY_SUPERADMIN",
    userRole: "superadmin",
    userEmail: actorUser?.email || "",
    userId: actorUser?.id || actorUser?._id || undefined,
    severity: "critical",
    ipAddress,
    userAgent,
    reason: amountOverride?.reason || reasonNote || "manual_send",
    orderData: { orderId: fresh._id, orderNumber: fresh.orderNumber },
    metadata: {
      path,
      companyId: fresh.ownerId ? String(fresh.ownerId) : "",
      priceCorrected: Boolean(correction),
      grossMinor: evaluation.grossMinor,
      previousGrossMinor: evaluation.prefill.grossMinor,
      bookingFeeMinor: evaluation.bookingFeeMinor,
      feeBps: evaluation.feeBps,
      belowContractedFee: evaluation.flags.belowContractedFee,
      supplierConfirmedBeforeSend: state !== RENTAL_STATE.REQUESTED,
    },
  });

  const saved = await Order.findById(fresh._id);
  return {
    ok: true,
    status: 200,
    path,
    reused: Boolean(issued.reused),
    priceCorrected: Boolean(correction),
    revision: correction?.revision || null,
    amount: evaluation,
    url: issued.url,
    sessionId: issued.sessionId || String(saved?.payment?.providerPaymentId || ""),
    expiresAt: issued.expiresAt || saved?.payment?.expiresAt || null,
    mailed: issued.mailed ?? null,
    order: plain(saved || fresh),
  };
}

export { prefillManualPaymentLinkAmount };
