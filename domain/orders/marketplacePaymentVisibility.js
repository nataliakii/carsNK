import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import MailLog from "@models/MailLog";
import { MAIL_STATUS, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { BookingHold } from "@models/BookingHold";
import { resolveRentalState } from "@/domain/booking/rentalBookingState";
import { resolveRentalCheckoutAmount } from "@/domain/orders/companyRentalPaymentPolicy";
import {
  evaluatePaymentLinkReissue,
} from "@/domain/orders/reissueMarketplacePaymentLink";
import {
  computeNetPaidMinor,
  listSessionHistory,
  REFUND_STATUS,
} from "@/domain/orders/stripePaymentRefs";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { buildCheckoutInvalidationView } from "@/domain/orders/invalidateMarketplaceCheckout";

function safePayment(order) {
  const pay = order?.payment && typeof order.payment === "object" ? order.payment : {};
  return {
    status: pay.status || "",
    amountMinor: pay.amountMinor ?? null,
    paidAmountMinor: pay.paidAmountMinor ?? pay.amountMinor ?? null,
    refundedAmountMinor: pay.refundedAmountMinor ?? 0,
    netPaidAmountMinor:
      pay.netPaidAmountMinor ??
      computeNetPaidMinor({
        paidAmountMinor: pay.paidAmountMinor || pay.amountMinor || 0,
        refundedAmountMinor: pay.refundedAmountMinor || 0,
      }),
    refundStatus: pay.refundStatus || REFUND_STATUS.NONE,
    disputeStatus: pay.disputeStatus || "",
    currency: pay.currency || "",
    provider: pay.provider || "",
    currentSessionId: pay.providerPaymentId || "",
    paymentIntentId: pay.paymentIntentId || "",
    chargeId: pay.chargeId || "",
    checkoutUrl: pay.checkoutUrl || "",
    expiresAt: pay.expiresAt || null,
    paidAt: pay.paidAt || null,
    lastCheckoutError: "",
    lastWebhookError: pay.lastWebhookError || "",
    lastInvalidateErrorCategory: pay.lastInvalidateErrorCategory || "",
    sessionHistory: listSessionHistory(pay).map((row) => ({
      sessionId: row.sessionId || "",
      status: row.status || "",
      expiresAt: row.expiresAt || null,
      archivedAt: row.archivedAt || null,
    })),
  };
}

export async function buildMarketplacePaymentOpsView(order) {
  if (!order) return null;
  const hold = await BookingHold.findOne({ orderId: order._id }).lean();
  const emails = await MailLog.find({
    orderId: order._id,
    type: {
      $in: [
        MAIL_TYPE.ORDER_PAYMENT,
        MAIL_TYPE.ORDER_PAYMENT_EXPIRED,
        MAIL_TYPE.ORDER_PAYMENT_REISSUED,
        MAIL_TYPE.ORDER_PAID_CUSTOMER,
      ],
    },
    status: MAIL_STATUS.SENT,
  })
    .select("type sentAt payload status")
    .sort({ sentAt: -1 })
    .lean();

  const reissue = isMarketplaceRequestMode(order.bookingMode)
    ? evaluatePaymentLinkReissue(order)
    : { ok: false, code: "not_marketplace" };
  const amounts = resolveRentalCheckoutAmount(order);
  const retryOffer = await AlternativeVehicleOffer.findOne({
    orderId: order._id,
    $or: [
      { complianceInvalidateRetry: true },
      { checkoutUrl: { $exists: true, $nin: [null, ""] } },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  return {
    marketplace: isMarketplaceRequestMode(order.bookingMode),
    bookingStatus: order.bookingStatus || "",
    rentalState: resolveRentalState(order),
    payment: safePayment(order),
    invalidation: buildCheckoutInvalidationView(order, retryOffer),
    hold: hold
      ? {
          status: hold.status || "",
          holdExpiresAt: hold.holdExpiresAt || null,
          releasedAt: hold.releasedAt || null,
          finalizedAt: hold.finalizedAt || null,
          releaseReason: hold.releaseReason || "",
          stripeSessionId: hold.stripeSessionId || "",
        }
      : null,
    price: {
      currency: amounts.currency,
      grossMinor: amounts.grossMinor,
      prepaymentMinor: amounts.amountMinor,
      balanceMinor: amounts.balanceMinor,
      platformAmountMinor: amounts.platformAmountMinor ?? amounts.amountMinor,
      stripeAmountMinor: amounts.stripeAmountMinor ?? amounts.amountMinor,
      supplierBalanceMinor: amounts.supplierBalanceMinor ?? amounts.balanceMinor,
      payoutMinor: amounts.payoutMinor ?? 0,
      marketplaceBookingFeeBps: amounts.marketplaceBookingFeeBps,
      feePercent: amounts.feePercent,
      checksum:
        order.payment?.priceChecksum ||
        order.partnerConfirmMeta?.priceChecksum ||
        "",
    },
    emails: emails.map((row) => ({
      type: row.type,
      sentAt: row.sentAt,
      stripeSessionId: row.payload?.stripeSessionId || "",
    })),
    canIssueNewLink: Boolean(reissue.ok),
    canResendExisting: Boolean(reissue.canResend || order.payment?.checkoutUrl),
    issueBlockedReason: reissue.ok ? "" : reissue.message || reissue.code || "",
  };
}
