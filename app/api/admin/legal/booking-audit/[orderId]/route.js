import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import ConfirmedBookingSnapshot from "@models/ConfirmedBookingSnapshot";
import BookingConfirmationToken from "@models/BookingConfirmationToken";
import { getOrderAuditTrail } from "@/domain/legal/auditTrail";
import { listOffersForOrder } from "@/domain/booking/alternativeVehicle";
import { resolveRentalState } from "@/domain/booking/rentalBookingState";
import { getAgreementVersionRef } from "@/domain/legal/agreementService";
import { listSupportMessagesForOrder } from "@/domain/orders/partnerSupportMessage";
import { buildMarketplacePaymentOpsView } from "@/domain/orders/marketplacePaymentVisibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin "Booking legal audit" for a single order.
 *
 * Read-only by design. There is deliberately no PATCH/PUT here: a confirmed
 * booking snapshot is immutable at the model level, so even a superadmin
 * cannot quietly rewrite what was agreed.
 */
export async function GET(request, { params }) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  await connectToDB();

  const order = await Order.findById(orderId).lean();
  if (!order) {
    return NextResponse.json(
      { success: false, message: "Order not found" },
      { status: 404 }
    );
  }

  const [snapshots, tokens, offers, auditTrail, agreementRef, supportMessages, paymentOps] =
    await Promise.all([
      ConfirmedBookingSnapshot.find({ orderId }).sort({ sequence: 1 }).lean(),
      BookingConfirmationToken.find({ orderId }).sort({ createdAt: 1 }).lean(),
      listOffersForOrder(orderId),
      getOrderAuditTrail(orderId),
      order.ownerId ? getAgreementVersionRef(order.ownerId).catch(() => null) : null,
      listSupportMessagesForOrder(orderId),
      buildMarketplacePaymentOpsView(order),
    ]);

  return NextResponse.json({
    success: true,
    request: {
      orderId: String(order._id),
      orderNumber: order.orderNumber || "",
      createdAt: order.date,
      bookingMode: order.bookingMode || "",
      state: resolveRentalState(order),
      clientLang: order.clientLang || "",
      clientCountry: order.clientCountry || "",
      offline: Boolean(order.offline),
    },
    partnerConfirmation: tokens.map((t) => ({
      jti: t.jti,
      issuedAt: t.createdAt,
      expiresAt: t.expiresAt,
      consumedAt: t.consumedAt,
      decision: t.decision,
      ipAddress: t.consumedIp,
      userAgent: t.consumedUserAgent,
      replayAttempts: t.replayAttempts,
      agreementRef: t.agreementRef,
    })),
    clientPayment: paymentOps?.payment || (order.payment
      ? {
          provider: order.payment.provider || "",
          status: order.payment.status || "",
          amountMinor: order.payment.amountMinor ?? null,
          currency: order.payment.currency || "",
          paidAt: order.payment.paidAt || null,
          providerPaymentId: order.payment.providerPaymentId || "",
          collectionMode: order.payment.collectionMode || "",
        }
      : null),
    marketplacePayment: paymentOps,
    priceSnapshot: order.authoritativePrice || null,
    /** Immutable; the checksum proves nothing was altered afterwards. */
    confirmedSnapshots: snapshots,
    agreementVersions: agreementRef,
    alternativeOffers: offers,
    customerAcceptance: offers
      .filter((o) => o.decidedAt)
      .map((o) => ({
        offerId: o.offerId,
        status: o.status,
        decidedAt: o.decidedAt,
        ipAddress: o.decisionIp,
        userAgent: o.decisionUserAgent,
        declineReason: o.declineReason || "",
      })),
    emails: order.confirmationEmailHistory || [],
    supportMessages,
    auditLog: auditTrail,
  });
}
