import { isHardBlockingBookingStatus, isNonBlockingBookingStatus } from "@/domain/booking/bookingStatus";

/**
 * Whether an order blocks car calendar dates for new bookings.
 * Offline (off-site) bookings always block, same as confirmed.
 * Explicit future bookingStatus wins when present; otherwise legacy flags.
 */
export function isOrderDateBlocking(order) {
  if (!order) return false;
  if (isNonBlockingBookingStatus(order.bookingStatus)) return false;
  if (isHardBlockingBookingStatus(order.bookingStatus)) return true;
  if (order.offline === true) return true;
  return order.confirmed === true;
}

export default isOrderDateBlocking;
