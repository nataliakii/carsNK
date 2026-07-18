/**
 * Order System Utilities - Index
 *
 * Централизованный экспорт всех утилит системы заказов.
 */

// === OWNERSHIP ===
export {
  getOrderOwnership,
  isBusinessOrder,
  isInternalOrder,
  isConfirmedOrder,
  isPendingOrder,
  isCancelledOrder,
  isClientOrder,
  isSuperadminOrder,
  getOwnershipDescription,
} from "./orderOwnership";

// === GROUPING ===
export {
  groupOrdersForAdmin,
  getDateMetadata,
  buildDateMetadataMap,
  groupOrdersByCarForAdmin,
  getPriorityOrder,
} from "./groupOrdersForAdmin";

// === CALENDAR METADATA ===
export {
  getOrderDateRange,
  buildCalendarMetadata,
  getMetadataForDate,
  isDateBlocked,
  hasDateWarning,
  getRangeSummary,
  prepareCalendarData,
} from "./calendarMetadata";

// === TIME RESTRICTIONS ===
export {
  getPickupTimeRestriction,
  getReturnTimeRestriction,
  getPendingBusinessWarnings,
  getAllTimeRestrictions,
  formatRestrictionsAsText,
} from "./timeRestrictionMessages";

// === CONFLICT VALIDATION ===
export {
  validateConflictsExtended,
  canSuperadminOverride,
  generateOverrideWarning,
  createOverrideAuditEntry,
} from "./conflictValidation";

// === SUPERADMIN OVERRIDE ===
export {
  checkSuperadminOverride,
  isSuperadmin,
  validateOverrideRequest,
  generateOverrideConfirmationData,
  formatAuditEntryForLog,
} from "./superadminOverride";

// === BUSINESS TIME ===
export {
  BUSINESS_TZ,
  formatDate,
  formatTime,
  formatDateTime,
  parseBusinessTime,
  toStorageUTC,
  fromStorage,
  isToday,
  isPast,
  nowInBusiness,
  isSameDay,
  formatDateRange,
  debugTime,
} from "./businessTime";

// === ADMIN TIME ADJUSTMENT ===
export {
  canAdjustTime,
  getTimeConstraints,
  validateSelectedTime,
  collectWarningsForDisplay,
  requiresAdminAcknowledgement,
  generateAcknowledgementData,
  TIME_ADJUSTMENT_MESSAGES,
} from "./adminTimeAdjustment";

