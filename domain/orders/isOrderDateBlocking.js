/**
 * Whether an order blocks car calendar dates for new bookings.
 * Offline (off-site) bookings always block, same as confirmed.
 */
export function isOrderDateBlocking(order) {
  if (!order) return false;
  if (order.offline === true) return true;
  return order.confirmed === true;
}

export default isOrderDateBlocking;
