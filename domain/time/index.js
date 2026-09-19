/**
 * 📦 domain/time
 *
 * Утилиты для работы с временем в бизнес-таймзоне (Europe/Athens).
 */

export {
  ATHENS_TZ,
  createAthensDateTime,
  toServerUTC,
  fromServerUTC,
  athensStartOfDay,
  athensEndOfDay,
  formatTimeHHMM,
  formatDateYYYYMMDD,
  validateRoundTrip,
} from "./athensTime";

// Legacy compatibility - businessTime exports
export {
  BUSINESS_TZ,
  formatDate,
  formatTime,
  formatDateTime,
  fromStorage,
  toStorageUTC as toStorage,
  isPast,
  isToday,
  nowInBusiness as now,
} from "./businessTime";

export {
  resolveBusinessTimezone,
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
} from "./resolveBusinessTimezone";
export {
  parseLocalInTimezone,
  createBusinessDateTime,
  fromUtcInTimezone,
} from "./businessInstant";
