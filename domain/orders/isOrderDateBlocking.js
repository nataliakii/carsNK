import { isHardBlockingBookingStatus, isNonBlockingBookingStatus } from "@/domain/booking/bookingStatus";
import { internalRecordBlocksAvailability } from "@/domain/admin/rovaroContractorAdmin";

/**
 * Whether an order blocks car calendar dates for new bookings.
 * Internal records block unless `blocksAvailability === false` or cancelled.
 * Platform rows keep confirmed / offline / bookingStatus rules.
 */
export function isOrderDateBlocking(order) {
  if (!order) return false;
  if (isNonBlockingBookingStatus(order.bookingStatus)) return false;
  if (internalRecordBlocksAvailability(order)) return true;
  if (isHardBlockingBookingStatus(order.bookingStatus)) return true;
  if (order.offline === true) return true;
  return order.confirmed === true;
}

export default isOrderDateBlocking;
