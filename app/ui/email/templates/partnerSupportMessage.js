/**
 * Rovaro-branded email when a partner messages support about a booking.
 * Never uses CarsNK / Natali Cars / BBQR branding.
 */

import {
  escapeHtml,
  getEmailStyle,
  renderEmailHeaderRow,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { LEGAL_ENTITY_IDENTITY } from "@config/legalEntity";
import { ROVARO_MAILBOX } from "@config/email";

function row(label, value, style) {
  return `<tr>
    <td style="padding:8px 12px 8px 0;color:${style.muted};font-size:13px;vertical-align:top;white-space:nowrap;font-family:${style.fontSans};">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:${style.text};font-family:${style.fontSans};">${escapeHtml(value)}</td>
  </tr>`;
}

export function renderPartnerSupportMessageEmail({
  bookingReference,
  companyName,
  sender,
  reasonLabel,
  message,
  bookingLines = [],
  staffOrderUrl,
} = {}) {
  const s = getEmailStyle("rovaro");
  const brand = LEGAL_ENTITY_IDENTITY.platformBrand;
  const footerLines = [
    brand,
    `Operated by ${LEGAL_ENTITY_IDENTITY.ownerLegalName}, trading as ${LEGAL_ENTITY_IDENTITY.tradingName}`,
    LEGAL_ENTITY_IDENTITY.legalEmail || ROVARO_MAILBOX,
  ];
  const messageHtml = escapeHtml(message || "").replace(/\n/g, "<br />");
  const detailRows = (bookingLines || [])
    .filter((line) => line && line.label)
    .map((line) => row(line.label, line.value ?? "—", s))
    .join("");
  const pageTitle = `Partner message about booking ${bookingReference || "—"}`;

  const staffLink = staffOrderUrl
    ? `<p style="margin:20px 0 0;font-size:14px;font-family:${s.fontSans};">
        <a href="${escapeHtml(staffOrderUrl)}" style="color:${s.link};font-weight:700;">Open booking in Rovaro admin</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brand)} partner message</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgPage};font-family:${s.fontSans};color:${s.text};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${s.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};">
          ${renderEmailHeaderRow({ title: pageTitle, style: s })}
          <tr>
            <td style="padding:28px 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:16px;">
                ${row("Rental company", companyName || "—", s)}
                ${row("Sender", sender || "Partner (email link)", s)}
                ${row("Booking reference", bookingReference || "—", s)}
                ${row("Reason", reasonLabel || "—", s)}
              </table>
              <div style="background-color:${s.bgDetailsCard};border:1px solid ${s.border};border-top:3px solid ${s.accent};padding:14px 16px;margin-bottom:16px;">
                <p style="margin:0 0 8px;font-size:12px;color:${s.muted};font-weight:700;font-family:${s.fontSans};">Message</p>
                <p style="margin:0;font-size:14px;line-height:1.55;color:${s.text};font-family:${s.fontSans};">${messageHtml}</p>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
                ${detailRows}
              </table>
              ${staffLink}
              <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${s.border};font-size:12px;color:${s.footerMuted};line-height:1.7;font-family:${s.fontSans};">
                ${footerLines.map((line) => escapeHtml(line)).join("<br />")}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function partnerSupportEmailSubject(bookingReference) {
  return `[Rovaro] Partner message about booking ${bookingReference || "—"}`;
}

export function partnerSupportEmailText({
  bookingReference,
  companyName,
  sender,
  reasonLabel,
  message,
  bookingLines = [],
  staffOrderUrl,
} = {}) {
  const lines = [
    `Rental company: ${companyName || "—"}`,
    `Sender: ${sender || "Partner (email link)"}`,
    `Booking reference: ${bookingReference || "—"}`,
    `Reason: ${reasonLabel || "—"}`,
    "",
    "Message:",
    message || "",
    "",
    "Booking details:",
    ...(bookingLines || []).map((line) => `${line.label}: ${line.value ?? "—"}`),
  ];
  if (staffOrderUrl) {
    lines.push("", `Open booking: ${staffOrderUrl}`);
  }
  lines.push(
    "",
    LEGAL_ENTITY_IDENTITY.platformBrand,
    `Operated by ${LEGAL_ENTITY_IDENTITY.ownerLegalName}, trading as ${LEGAL_ENTITY_IDENTITY.tradingName}`,
    LEGAL_ENTITY_IDENTITY.legalEmail || ROVARO_MAILBOX
  );
  return lines.join("\n");
}
