/**
 * Public / internal notification mailboxes.
 *
 * SMTP credentials and From/Reply-To resolution live in lib/email/smtpConfig.js
 * (server-only). This module is imported by client components, so it must not
 * read SMTP_PASSWORD, SMTP_PASS, or any other secret.
 *
 * One deployment = one brand (NEXT_PUBLIC_SITE_COUNTRY). Greece keeps the
 * historical BBQR inboxes as defaults; Spain defaults to the Rovaro mailbox.
 */

import { getSiteCountryCode } from "./siteCountry.js";

export const GREECE_INTERNAL_EMAIL = "cars@bbqr.site";
export const GREECE_ADMIN_CC_EMAIL = "admin@bbqr.site";
export const ROVARO_MAILBOX = "admin@rovaro.autos";

const HEADER_INJECTION = /[\r\n]/;
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

export function isValidEmailAddress(raw) {
  const email = String(raw || "").trim();
  if (!email || email.length > 254) return false;
  if (HEADER_INJECTION.test(email)) return false;
  return EMAIL_RE.test(email);
}

export function normalizeEmailAddress(raw) {
  if (!isValidEmailAddress(raw)) return null;
  return String(raw).trim().toLowerCase();
}

/** Client-safe public contact address for the active deployment. */
export function getPublicContactEmail() {
  return getSiteCountryCode() === "ES" ? ROVARO_MAILBOX : GREECE_INTERNAL_EMAIL;
}

/**
 * Server-controlled ops inbox (contact form, admin CC, empty-to fallback).
 * Separate from the SMTP From address; they may coincide via env.
 */
export function getInternalNotificationEmail() {
  const fromEnv = normalizeEmailAddress(
    process.env.MAIL_INTERNAL_TO || process.env.DEVELOPER_EMAIL
  );
  if (fromEnv) return fromEnv;
  return getPublicContactEmail();
}

/** Official confirmation CC: env override, else Greece BBQR admin / Spain ops inbox. */
export function getDefaultConfirmationCcEmail() {
  const fromEnv = normalizeEmailAddress(process.env.ORDER_CONFIRMATION_CC_EMAIL);
  if (fromEnv) return fromEnv;
  return getSiteCountryCode() === "ES"
    ? getInternalNotificationEmail()
    : GREECE_ADMIN_CC_EMAIL;
}

/**
 * Platform-admin recipients for transfer ops mail.
 * Greece keeps both historical inboxes; Spain does not add BBQR by default.
 */
export function getAdminTransferEmails() {
  const extra = normalizeEmailAddress(process.env.MAIL_FROM_TO_ADMIN);
  const greeceAdmin =
    getSiteCountryCode() === "GR" ? GREECE_ADMIN_CC_EMAIL : null;
  const seen = new Set();
  const out = [];
  for (const raw of [getInternalNotificationEmail(), greeceAdmin, extra]) {
    const email = normalizeEmailAddress(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Greece default ops inbox. Prefer getInternalNotificationEmail() for sends
 * so Spain does not silently notify BBQR.
 * @deprecated
 */
export const DEVELOPER_EMAIL = GREECE_INTERNAL_EMAIL;
