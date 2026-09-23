/**
 * EMAIL_TESTING mode — prevents accidental delivery to real recipients.
 *
 * When EMAIL_TESTING=true:
 *   - Telegram is never sent (unless EMAIL_TESTING_ALLOW_TELEGRAM=true).
 *   - SMTP never goes to the original customer/partner/admin recipients.
 *   - If EMAIL_TEST_ADDRESS is set, mail is redirected only to that sink.
 *   - If EMAIL_TEST_ADDRESS is unset, SMTP is skipped and MailLog records a skip.
 *
 * Production (EMAIL_TESTING unset/false) is unchanged.
 */

import { normalizeEmailAddress } from "@config/email";

export function isEmailTestingMode() {
  return String(process.env.EMAIL_TESTING || "").trim().toLowerCase() === "true";
}

export function isEmailTestingTelegramAllowed() {
  return (
    isEmailTestingMode() &&
    String(process.env.EMAIL_TESTING_ALLOW_TELEGRAM || "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function getEmailTestSinkAddress() {
  if (!isEmailTestingMode()) return null;
  return normalizeEmailAddress(process.env.EMAIL_TEST_ADDRESS);
}

/**
 * Rewrites outbound recipients for test mode.
 * @returns {{
 *   deliver: boolean,
 *   to: string[],
 *   cc: string[],
 *   intendedTo: string[],
 *   intendedCc: string[],
 *   redirected: boolean,
 *   subjectPrefix: string,
 * }}
 */
export function applyEmailTestingRecipients({ to = [], cc = [] } = {}) {
  const intendedTo = Array.isArray(to) ? [...to] : [];
  const intendedCc = Array.isArray(cc) ? [...cc] : [];

  if (!isEmailTestingMode()) {
    return {
      deliver: true,
      to: intendedTo,
      cc: intendedCc,
      intendedTo,
      intendedCc,
      redirected: false,
      subjectPrefix: "",
    };
  }

  const sink = getEmailTestSinkAddress();
  if (!sink) {
    return {
      deliver: false,
      to: [],
      cc: [],
      intendedTo,
      intendedCc,
      redirected: false,
      subjectPrefix: "[TEST] ",
    };
  }

  return {
    deliver: true,
    to: [sink],
    cc: [],
    intendedTo,
    intendedCc,
    redirected: true,
    subjectPrefix: "[TEST] ",
  };
}

export function withEmailTestingSubject(title, subjectPrefix) {
  const raw = String(title || "");
  const prefix = String(subjectPrefix || "");
  if (!prefix) return raw;
  if (raw.startsWith("[TEST]")) return raw;
  return `${prefix}${raw}`;
}
