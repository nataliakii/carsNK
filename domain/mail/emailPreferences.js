/**
 * Company email notification preferences.
 * Critical account/legal messages still go to ≥1 active company admin.
 */

import { isValidEmailAddress, normalizeEmailAddress } from "@config/email";

export const DEFAULT_EMAIL_PREFERENCES = Object.freeze({
  /** Primary operational mailbox (falls back to company.email). */
  primaryOperationalEmail: "",
  additionalRecipients: [],
});

/**
 * @typedef {{
 *   email: string,
 *   bookingEmailsEnabled: boolean,
 *   transferEmailsEnabled: boolean,
 * }} AdditionalEmailRecipient
 */

/**
 * @param {unknown} raw
 * @returns {{
 *   primaryOperationalEmail: string,
 *   additionalRecipients: AdditionalEmailRecipient[],
 * }}
 */
export function normalizeEmailPreferences(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const primary =
    normalizeEmailAddress(src.primaryOperationalEmail) ||
    normalizeEmailAddress(src.primary) ||
    "";

  const list = Array.isArray(src.additionalRecipients)
    ? src.additionalRecipients
    : Array.isArray(src.additional)
      ? src.additional
      : [];

  const seen = new Set();
  const additionalRecipients = [];
  for (const row of list.slice(0, 20)) {
    const email =
      typeof row === "string"
        ? normalizeEmailAddress(row)
        : normalizeEmailAddress(row?.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    additionalRecipients.push({
      email,
      bookingEmailsEnabled:
        typeof row === "object" && row != null && "bookingEmailsEnabled" in row
          ? Boolean(row.bookingEmailsEnabled)
          : true,
      transferEmailsEnabled:
        typeof row === "object" && row != null && "transferEmailsEnabled" in row
          ? Boolean(row.transferEmailsEnabled)
          : true,
    });
  }

  return {
    primaryOperationalEmail: primary,
    additionalRecipients,
  };
}

/**
 * Resolve company operational booking-notification addresses from preferences
 * + company.email / email2. Never accepts client-supplied recipient lists.
 *
 * @param {object} company
 * @param {"booking"|"transfer"|"critical"} channel
 * @returns {string[]}
 */
export function resolveCompanyPreferenceEmails(company, channel = "booking") {
  const prefs = normalizeEmailPreferences(company?.emailPreferences);
  const out = [];
  const seen = new Set();

  const push = (raw) => {
    const email = normalizeEmailAddress(raw);
    if (!email || seen.has(email)) return;
    seen.add(email);
    out.push(email);
  };

  if (prefs.primaryOperationalEmail) {
    push(prefs.primaryOperationalEmail);
  } else {
    push(company?.email);
  }

  // Always keep a fallback to the company mailbox for critical/account mail.
  if (channel === "critical") {
    push(company?.email);
    push(company?.email2);
  }

  for (const row of prefs.additionalRecipients) {
    if (channel === "booking" && !row.bookingEmailsEnabled) continue;
    if (channel === "transfer" && !row.transferEmailsEnabled) continue;
    if (channel === "critical") {
      // Critical still may include additional only when booking-enabled;
      // primary/admin path is handled separately by resolveCompanyAdminEmails.
      continue;
    }
    push(row.email);
  }

  if (channel === "booking" || channel === "transfer") {
    // Legacy secondary company email participates in booking mail when set.
    if (channel === "booking") push(company?.email2);
  }

  return out.filter(isValidEmailAddress);
}

export function emailPreferencesSchemaShape() {
  return {
    primaryOperationalEmail: { type: String, default: "", trim: true },
    additionalRecipients: {
      type: [
        {
          email: { type: String, trim: true, lowercase: true },
          bookingEmailsEnabled: { type: Boolean, default: true },
          transferEmailsEnabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
  };
}
