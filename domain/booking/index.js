/**
 * 📦 domain/booking
 *
 * Бизнес-логика бронирования: конфликты, валидация, правила.
 */

// Conflict analysis
export { default as analyzeOrderTimeConflicts } from "./analyzeOrderTimeConflicts";
export {
  default as analyzeConfirmationConflicts,
  canPendingOrderBeConfirmed,
} from "./analyzeConfirmationConflicts";

// Validation
export { default as conflictValidation } from "./conflictValidation";

// Rules
export { BOOKING_RULES } from "./bookingRules";

// Admin utilities
export { default as adminTimeAdjustment } from "./adminTimeAdjustment";
export { default as getAutoFixSuggestions } from "./getAutoFixSuggestions";
export { default as calendarMetadata } from "./calendarMetadata";

// Order utilities
export { default as orderOwnership } from "./orderOwnership";
export { default as orderSystem } from "./orderSystem";
export { default as groupOrdersForAdmin } from "./groupOrdersForAdmin";

// Superadmin
export { default as superadminOverride } from "./superadminOverride";

export {
  BOOKING_MODES,
  resolveBookingMode,
  isMarketplaceRequestMode,
} from "./bookingMode";
export {
  evaluateRentalAvailability,
  AVAILABILITY_PURPOSE,
  CONFLICT_TYPE,
  serializePublicBlockedIntervals,
  checkOrderIntervalConflicts,
  toLegacyCreateConflict,
} from "./availabilityEngine";
export { resolveRentalBookingContext } from "./resolveRentalContext";
export { BOOKING_STATUS } from "./bookingStatus";
