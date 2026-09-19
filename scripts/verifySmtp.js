/**
 * Verify SMTP configuration without sending mail.
 *
 * Usage:
 *   npm run email:verify
 *
 * Loads Next env files, builds a Nodemailer transport with the same port/TLS
 * rules as lib/email/smtpConfig.js, and runs transporter.verify().
 * Prints only success or a sanitised failure — never credentials or host/port.
 */
const { loadEnvConfig } = require("@next/env");
const nodemailer = require("nodemailer");

loadEnvConfig(process.cwd());

function trim(value) {
  return String(value || "").trim();
}

function sanitize(err) {
  const raw = String(err && err.message ? err.message : err || "");
  if (/do not match the active site brand/i.test(raw)) {
    return "SMTP credentials do not match the active site brand";
  }
  if (/not configured|Missing SMTP/i.test(raw)) {
    return trim(process.env.NODE_ENV) === "production"
      ? "SMTP is not configured"
      : "Missing SMTP configuration";
  }
  if (/Invalid SMTP port|implicit TLS|STARTTLS|SMTP_SECURE/i.test(raw)) {
    return "Invalid SMTP configuration";
  }
  if (/auth|invalid login|eauth|credentials/i.test(raw)) {
    return "SMTP authentication failed";
  }
  if (/certificate|tls|unauthorized|unauthoriz/i.test(raw)) {
    return "SMTP TLS validation failed";
  }
  if (/enotfound|econnrefused|etimedout|econnreset|timeout|socket|connect/i.test(raw)) {
    return "SMTP connection failed";
  }
  return "SMTP verification failed";
}

function parsePort(raw) {
  const text = trim(raw);
  if (!text) return 465;
  if (!/^\d+$/.test(text)) {
    throw new Error("Invalid SMTP port");
  }
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid SMTP port");
  }
  return port;
}

function parseSecureFlag(raw) {
  const value = trim(raw).toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

function resolveTransportOptions() {
  const host = trim(process.env.SMTP_HOST);
  const user = trim(process.env.SMTP_USER);
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
  const port = parsePort(process.env.SMTP_PORT);
  const secureFlag = parseSecureFlag(process.env.SMTP_SECURE);
  const country = trim(
    process.env.NEXT_PUBLIC_SITE_COUNTRY || process.env.SITE_COUNTRY || ""
  ).toUpperCase();

  if (!host || !user || !pass) {
    throw new Error(
      trim(process.env.NODE_ENV) === "production"
        ? "SMTP is not configured"
        : "Missing SMTP configuration"
    );
  }

  if (country === "ES" && /@bbqr\.site$/i.test(user)) {
    throw new Error("SMTP credentials do not match the active site brand");
  }

  let secure;
  if (port === 465) {
    if (secureFlag === false) throw new Error("port 465 requires implicit TLS");
    secure = true;
  } else if (port === 587) {
    if (secureFlag === true) throw new Error("port 587 requires STARTTLS");
    secure = false;
  } else if (secureFlag == null) {
    throw new Error("SMTP_SECURE is required for this SMTP port");
  } else {
    secure = secureFlag;
  }

  const options = {
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2" },
  };
  if (port === 587) options.requireTLS = true;
  return options;
}

async function main() {
  let transport;
  try {
    transport = nodemailer.createTransport(resolveTransportOptions());
  } catch (err) {
    console.error("SMTP verification failed:", sanitize(err));
    process.exit(1);
  }

  try {
    await transport.verify();
    console.log("SMTP connection verified");
  } catch (err) {
    console.error("SMTP verification failed:", sanitize(err));
    process.exit(1);
  }
}

main();
