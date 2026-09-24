/**
 * Shared order → notification context for booking matrix emails.
 * Never includes passwords, tokens, Stripe secrets, or signed URLs.
 */

import { moneyMinor } from "@/domain/mail/notificationCopy";
import { resolveRentalCheckoutAmount } from "@/domain/orders/companyRentalPaymentPolicy";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";

/**
 * Contacts stay hidden from company-facing copy until verified payment.
 * @param {object} order
 * @returns {boolean}
 */
export function orderFeePaidVerified(order) {
  const status = String(order?.payment?.status || "").toLowerCase();
  if (status === "paid" || status === "succeeded") return true;
  if (order?.payment?.paidAt) return true;
  if (order?.payment?.paidEmailsSentAt) return true;
  return false;
}

/**
 * Safe Stripe reference for ops emails (session/intent id prefix only).
 */
export function safeStripeRef(order) {
  const raw =
    order?.payment?.paymentIntentId ||
    order?.payment?.providerPaymentId ||
    order?.payment?.chargeId ||
    "";
  const id = String(raw || "").trim();
  if (!id) return "";
  // Never include webhook secrets or full bank details.
  return id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-4)}` : id;
}

/**
 * @param {object} order
 * @param {{ companyName?: string, revealContacts?: boolean, deadline?: string }} [opts]
 */
export function buildBookingNotificationContext(order, opts = {}) {
  const amounts = resolveRentalCheckoutAmount(order || {});
  const feePaid = orderFeePaidVerified(order);
  const revealContacts =
    opts.revealContacts != null ? Boolean(opts.revealContacts) : feePaid;

  return {
    orderId: order?._id ? String(order._id) : "",
    orderNumber: order?.orderNumber || "",
    companyId: order?.ownerId ? String(order.ownerId) : "",
    companyName: opts.companyName || "",
    carModel: order?.carModel || "",
    pickup: [order?.placeIn, order?.rentalStartDate, order?.timeIn]
      .filter(Boolean)
      .join(" · "),
    return: [order?.placeOut, order?.rentalEndDate, order?.timeOut]
      .filter(Boolean)
      .join(" · "),
    customerName: order?.customerName || "",
    phone: revealContacts ? order?.phone || "" : "",
    email: revealContacts ? order?.email || "" : "",
    revealContacts,
    totalFormatted: moneyMinor(amounts.grossMinor, amounts.currency),
    feeFormatted: moneyMinor(
      amounts.platformAmountMinor ?? amounts.amountMinor,
      amounts.currency
    ),
    remainingFormatted: moneyMinor(
      amounts.supplierBalanceMinor ?? amounts.balanceMinor,
      amounts.currency
    ),
    feePercent: amounts.feePercent ?? null,
    feePaid,
    stripeRef: safeStripeRef(order),
    status: order?.bookingStatus || order?.payment?.status || "",
    deadline: opts.deadline || "",
    marketplace: isMarketplaceRequestMode(order?.bookingMode),
  };
}
