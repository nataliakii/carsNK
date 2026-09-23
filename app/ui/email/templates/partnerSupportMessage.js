/**
 * Rovaro-branded email when a partner messages support about a booking.
 * Never uses CarsNK / Natali Cars / BBQR branding.
 */

import { escapeHtml } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { LEGAL_ENTITY_IDENTITY } from "@config/legalEntity";
import { ROVARO_MAILBOX } from "@config/email";

function row(label, value) {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#607d8b;font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;color:#0A0A0A;">${escapeHtml(value)}</td>
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
  const brand = LEGAL_ENTITY_IDENTITY.platformBrand;
  const footerLines = [
    brand,
    `Operated by ${LEGAL_ENTITY_IDENTITY.ownerLegalName}, trading as ${LEGAL_ENTITY_IDENTITY.tradingName}`,
    LEGAL_ENTITY_IDENTITY.legalEmail || ROVARO_MAILBOX,
  ];
  const messageHtml = escapeHtml(message || "").replace(/\n/g, "<br />");
  const detailRows = (bookingLines || [])
    .filter((line) => line && line.label)
    .map((line) => row(line.label, line.value ?? "—"))
    .join("");

  const staffLink = staffOrderUrl
    ? `<p style="margin:20px 0 0;font-size:14px;">
        <a href="${escapeHtml(staffOrderUrl)}" style="color:#E9004F;font-weight:700;">Open booking in Rovaro admin</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(brand)} partner message</title>
</head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0A0A0A;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 24px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;color:#E9004F;font-weight:700;">${escapeHtml(brand).toUpperCase()}</p>
    <h1 style="margin:0 0 16px;font-size:20px;">Partner message about booking ${escapeHtml(bookingReference || "—")}</h1>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      ${row("Rental company", companyName || "—")}
      ${row("Sender", sender || "Partner (email link)")}
      ${row("Booking reference", bookingReference || "—")}
      ${row("Reason", reasonLabel || "—")}
    </table>
    <div style="background:#fafafa;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:12px;color:#607d8b;font-weight:700;">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.55;white-space:pre-wrap;">${messageHtml}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${detailRows}
    </table>
    ${staffLink}
    <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#78909c;line-height:1.7;">
      ${footerLines.map((line) => escapeHtml(line)).join("<br />")}
    </p>
  </div>
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
