import { Order } from "@models/order";
import { connectToDB } from "@lib/database";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  formatMarketplaceFeePercent,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";

/**
 * Read-only payment status for the success page.
 * `session_id` in the URL is never treated as proof of payment.
 */
export async function readRentalPaymentStatus(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) {
    return { ok: false, phase: "unknown", message: "Missing session" };
  }

  await connectToDB();
  const order = await Order.findOne({
    "payment.providerPaymentId": id,
  }).lean();

  if (!order) {
    return { ok: true, phase: "pending", order: null };
  }

  const paid =
    order.payment?.status === "paid" ||
    order.bookingStatus === BOOKING_STATUS.BOOKING_CONFIRMED;
  const fee = snapshotMarketplaceBookingFeeBps(order);

  return {
    ok: true,
    phase: paid ? "paid" : "pending",
    order: {
      orderId: String(order._id),
      orderNumber: order.orderNumber || "",
      carModel: order.carModel || "",
      bookingStatus: order.bookingStatus || "",
      paymentStatus: order.payment?.status || "",
      marketplaceBookingFeeBps: fee.bps,
      feePercent: formatMarketplaceFeePercent(fee.bps),
      supplierPercent: formatMarketplaceFeePercent(10000 - fee.bps),
    },
  };
}
