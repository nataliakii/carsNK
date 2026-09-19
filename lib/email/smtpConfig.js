/**
 * Server-only SMTP + transactional sender resolution.
 * Do not import from client components. Never log credentials.
 */

import { getSiteCountryCode } from "@config/siteCountry";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
  ROVARO_MAILBOX,
} from "@config/email";

const BBQR_HOST = /@bbqr\.site$/i;
const ROVARO_FROM_NAME = "Rovaro";
const GREECE_FROM_NAME = "CarsNK";

export class SmtpConfigError extends Error {
  constructor(message, code = "SMTP_CONFIG") {
    super(message);
    this.name = "SmtpConfigError";
    this.code = code;
  }
}

function readEnv(overrides = {}) {
  return { ...process.env, ...overrides };
}

function trim(value) {
  return String(value || "").trim();
}

function isProduction(env) {
  return trim(env.NODE_ENV) === "production";
}

export function isLegacyBbqrMailbox(email) {
  const normalized = normalizeEmailAddress(email);
  return Boolean(normalized && BBQR_HOST.test(normalized));
}

function getSmtpPassword(env = process.env) {
  const merged = readEnv(env);
  return merged.SMTP_PASSWORD || merged.SMTP_PASS || "";
}

function parsePort(raw) {
  const text = trim(raw);
  if (!text) return 465;
  if (!/^\d+$/.test(text)) return null;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function parseSecureFlag(raw) {
  const value = trim(raw).toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function requireMailbox(value, label) {
  const email = normalizeEmailAddress(value);
  if (!email) {
    throw new SmtpConfigError(`Invalid ${label}`, "SMTP_CONFIG");
  }
  return email;
}

/**
 * Brand-aware From / Reply-To. Env wins; Spain defaults to Rovaro mailbox,
 * Greece keeps SMTP_USER + CarsNK (existing production behaviour).
 */
export function resolveMailSender(overrides = {}) {
  const env = readEnv(overrides);
  const country = getSiteCountryCodeFromEnv(env);
  const smtpUser = trim(env.SMTP_USER);
  const fromEmailOverride = trim(env.MAIL_FROM_EMAIL);
  const fromNameOverride = trim(env.MAIL_FROM_NAME);
  const replyToOverride = trim(env.MAIL_REPLY_TO);

  if (country === "ES") {
    if (smtpUser && isLegacyBbqrMailbox(smtpUser)) {
      throw new SmtpConfigError(
        "SMTP credentials do not match the active site brand",
        "SMTP_BRAND_MISMATCH"
      );
    }
    if (fromEmailOverride && isLegacyBbqrMailbox(fromEmailOverride)) {
      throw new SmtpConfigError(
        "SMTP credentials do not match the active site brand",
        "SMTP_BRAND_MISMATCH"
      );
    }
  }

  const fromEmail =
    country === "ES"
      ? requireMailbox(fromEmailOverride || ROVARO_MAILBOX, "MAIL_FROM_EMAIL")
      : requireMailbox(fromEmailOverride || smtpUser, "MAIL_FROM_EMAIL");

  const fromName =
    fromNameOverride || (country === "ES" ? ROVARO_FROM_NAME : GREECE_FROM_NAME);

  const replyTo = replyToOverride
    ? requireMailbox(replyToOverride, "MAIL_REPLY_TO")
    : fromEmail;

  if (HEADER_INJECTION_IN_NAME(fromName)) {
    throw new SmtpConfigError("Invalid MAIL_FROM_NAME", "SMTP_CONFIG");
  }

  return {
    fromName,
    fromEmail,
    replyTo,
    fromHeader: `${fromName} <${fromEmail}>`,
  };
}

function HEADER_INJECTION_IN_NAME(value) {
  return /[\r\n]/.test(String(value || ""));
}

function getSiteCountryCodeFromEnv(env) {
  const raw = trim(env.NEXT_PUBLIC_SITE_COUNTRY || env.SITE_COUNTRY || "").toUpperCase();
  if (raw === "ES" || raw === "GR") return raw;
  return getSiteCountryCode();
}

/**
 * Nodemailer transport options. Password is included for createTransport only;
 * callers must not log this object.
 */
export function resolveSmtpTransportOptions(overrides = {}) {
  const env = readEnv(overrides);
  const host = trim(env.SMTP_HOST);
  const user = trim(env.SMTP_USER);
  const pass = String(getSmtpPassword(env) || "");
  const port = parsePort(env.SMTP_PORT);
  const secureFlag = parseSecureFlag(env.SMTP_SECURE);

  if (!host || !user || !pass) {
    const message = isProduction(env)
      ? "SMTP is not configured"
      : "Missing SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS or SMTP_PASSWORD)";
    throw new SmtpConfigError(message, "SMTP_MISSING");
  }

  if (!isValidEmailAddress(user) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    throw new SmtpConfigError("Invalid SMTP_USER", "SMTP_CONFIG");
  }

  if (port == null) {
    throw new SmtpConfigError("Invalid SMTP port", "SMTP_CONFIG");
  }

  let secure;
  if (port === 465) {
    if (secureFlag === false) {
      throw new SmtpConfigError(
        "SMTP port 465 requires implicit TLS",
        "SMTP_CONFIG"
      );
    }
    secure = true;
  } else if (port === 587) {
    if (secureFlag === true) {
      throw new SmtpConfigError(
        "SMTP port 587 requires STARTTLS",
        "SMTP_CONFIG"
      );
    }
    secure = false;
  } else if (secureFlag == null) {
    throw new SmtpConfigError(
      "SMTP_SECURE is required for this SMTP port",
      "SMTP_CONFIG"
    );
  } else {
    secure = secureFlag;
  }

  const country = getSiteCountryCodeFromEnv(env);
  if (country === "ES" && isLegacyBbqrMailbox(user)) {
    throw new SmtpConfigError(
      "SMTP credentials do not match the active site brand",
      "SMTP_BRAND_MISMATCH"
    );
  }

  // Resolve sender so From cannot silently fall back to a BBQR mailbox on ES.
  resolveMailSender(env);

  const options = {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      minVersion: "TLSv1.2",
    },
  };

  if (port === 587) {
    options.requireTLS = true;
  }

  return options;
}

export function sanitizeSmtpError(err) {
  const raw = String(err?.message || err || "");
  if (err instanceof SmtpConfigError) {
    return err.message;
  }
  if (/auth|invalid login|eauth|credentials/i.test(raw)) {
    return "SMTP authentication failed";
  }
  if (/certificate|tls|unauthorized|unauthoriz/i.test(raw)) {
    return "SMTP TLS validation failed";
  }
  if (
    /enotfound|econnrefused|etimedout|econnreset|timeout|socket|connect/i.test(
      raw
    )
  ) {
    return "SMTP connection failed";
  }
  return "SMTP send failed";
}

export function assertNoHeaderInjection(value, label = "value") {
  if (/[\r\n]/.test(String(value || ""))) {
    throw new SmtpConfigError(`Invalid ${label}`, "SMTP_HEADER");
  }
}
