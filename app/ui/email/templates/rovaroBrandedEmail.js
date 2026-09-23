/**
 * Shared Rovaro branded email shell — header, body, signature, legal footer.
 * Used by marketplace payment / decline / paid templates.
 */

import { EMAIL_STYLE, escapeHtml } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { ROVARO_MAILBOX } from "@config/email";

/**
 * @param {{
 *   title: string,
 *   locale?: string,
 *   introHtml?: string,
 *   rows?: Array<[string, string]>,
 *   extraHtml?: string,
 *   cta?: { href: string, label: string } | null,
 * }} data
 */
export function renderRovaroBrandedEmail(data) {
  const {
    title,
    introHtml = "",
    rows = [],
    extraHtml = "",
    cta = null,
  } = data;
  const s = EMAIL_STYLE;
  const footerLines = [
    "Rovaro",
    "Operated by Nataliia Kirejeva, trading as NK Platform Studio",
    ROVARO_MAILBOX,
  ];
  const label = (text) =>
    `<div style="font-size:12px;color:${s.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-family:${s.fontSans};">${escapeHtml(text)}</div>`;
  const value = (text) =>
    `<div style="font-size:15px;font-weight:600;color:${s.text};font-family:${s.fontSans};">${escapeHtml(String(text ?? ""))}</div>`;
  const rowHtml = rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid ${s.border};vertical-align:top;">${label(k)}${value(v)}</td></tr>`
    )
    .join("");

  const ctaHtml =
    cta?.href && cta?.label
      ? `<div style="margin:24px 0 0 0;text-align:center;">
          <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 28px;background-color:${s.headerTeal};color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;font-family:${s.fontSans};">${escapeHtml(cta.label)}</a>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${s.bgPage};font-family:${s.fontSans};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${s.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:${s.headerTeal};padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:${s.headerText};font-size:22px;font-weight:600;letter-spacing:0.5px;font-family:${s.fontSans};">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 36px 40px;color:${s.text};font-size:15px;line-height:1.6;font-family:${s.fontSans};">
              ${introHtml}
              ${
                rowHtml
                  ? `<div style="margin:28px 0 0 0;padding:24px;background-color:${s.bgDetailsCard};border:1px solid ${s.border};">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rowHtml}</table>
              </div>`
                  : ""
              }
              ${ctaHtml}
              ${extraHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px 40px;">
              <div style="margin-top:40px;padding-top:30px;border-top:2px solid #e0e0e0;text-align:center;font-size:13px;color:#616161;line-height:1.8;font-family:${s.fontSans};">
                <div style="margin-bottom:8px;"><strong style="color:#0A0A0A;font-size:14px;">Rovaro Support</strong></div>
                <div style="color:#757575;margin-bottom:12px;">Spain car rental marketplace</div>
                <div><a href="https://rovaro.autos" style="color:${s.headerTeal};text-decoration:none;">rovaro.autos</a></div>
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eeeeee;font-size:11px;color:#9e9e9e;line-height:1.7;">
                  ${footerLines.map((line) => escapeHtml(line)).join("<br />")}
                </div>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;margin-top:20px;">
          <tr>
            <td style="text-align:center;padding:20px;color:${s.muted};font-size:12px;font-family:${s.fontSans};">
              <p style="margin:0;">© ${new Date().getFullYear()} Rovaro. All rights reserved. · rovaro.autos</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
