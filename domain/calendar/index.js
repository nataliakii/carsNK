/**
 * 📦 domain/calendar
 *
 * Single source of truth for calendar dates, day-level extraction, and rental overlap.
 */

export {
  returnHoursToParseToDayjs,
  processOrders,
  functionToCheckDuplicates,
  getConfirmedAndUnavailableStartEndDates,
  functionToretunrStartEndOverlap,
  extractArraysOfStartEndConfPending,
  returnOverlapOrders,
  returnOverlapOrdersObjects,
  returnTime,
  setTimeToDatejs,
  calculateAvailableTimes,
  toParseTime,
  ordersRentalPeriodsOverlap,
  getOrderOverlaps,
  isOrderCompatible,
  getOrderCarId,
  isOrderOnCar,
  getOrdersOnCar,
  getCarAvailability,
  buildConflictMap,
  getCarCalendarOrderDerivedState,
} from "./functions";
