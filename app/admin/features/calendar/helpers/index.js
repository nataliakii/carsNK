/**
 * Calendar helpers — barrel export
 */

// Colors - теперь используется getOrderColor из domain/orders/getOrderColor.js

// Dates
export {
  isDateWithinOrder,
  isOrderCompleted,
  isDateInCompletedOrder,
  getStartEndInfo,
  getStartEndOverlapInfo,
  getOverlapInfo,
} from "./dates";

// Orders
export {
  getOrdersForDate,
  getSelectedOrder,
  isDateInSelectedOrder,
  getSelectedOrderEdgeCaseFlags,
} from "./orders";

// Move mode
export { getMoveDayFlags } from "./move";

