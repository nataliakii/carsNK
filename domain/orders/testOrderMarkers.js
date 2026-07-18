/**
 * Prefix emails / Telegram when order was created from localhost (dev test bookings).
 */

export const TEST_ORDER_SUBJECT_PREFIX = "[TEST] ";

/**
 * @param {string} subject
 * @param {boolean} [fromLocalhost]
 * @returns {string}
 */
export function withTestOrderEmailSubject(subject, fromLocalhost) {
  if (!fromLocalhost) return String(subject ?? "");
  const s = String(subject ?? "").trim();
  if (/^\[TEST\]/i.test(s)) return s;
  return `${TEST_ORDER_SUBJECT_PREFIX}${s}`;
}

/**
 * @param {string} message
 * @param {boolean} [fromLocalhost]
 * @returns {string}
 */
export function withTestOrderTelegramMessage(message, fromLocalhost) {
  if (!fromLocalhost) return String(message ?? "");
  const s = String(message ?? "");
  if (s.trimStart().startsWith("[TEST]")) return s;
  return `[TEST]\n\n${s}`;
}
