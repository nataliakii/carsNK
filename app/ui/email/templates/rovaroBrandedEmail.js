/**
 * Shared Rovaro branded email shell — header, body, signature, legal footer.
 * Used by marketplace payment / decline / paid templates.
 */

import {
  escapeHtml,
  getEmailStyle,
  renderEmailButton,
  renderEmailHeaderRow,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { ROVARO_MAILBOX } from "@config/email";

/**
 * @param {{
 *   title: string,
 *   locale?: string,
 *   introHtml?: string,
 *   rows?: Array<[string, string]>,
 *   extraHtml?: string,
 *   beforeCtaHtml?: string,
 *   cta?: { href: string, label: string } | null,
 * }} data
 */
export function renderRovaroBrandedEmail(data) {
  const {
    title,
    introHtml = "",
    rows = [],
    extraHtml = "",
    beforeCtaHtml = "",
    cta = null,
  } = data;
  const s = getEmailStyle("rovaro");
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
          ${renderEmailButton(cta.href, cta.label, s)}
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .rovaro-shell { width: 100% !important; }
      .rovaro-pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${s.bgPage};font-family:${s.fontSans};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${s.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="rovaro-shell" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${s.bgCard};border:1px solid ${s.border};box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          ${renderEmailHeaderRow({ title, style: s })}
          <tr>
            <td class="rovaro-pad" style="padding:40px 40px 36px 40px;color:${s.text};font-size:15px;line-height:1.6;font-family:${s.fontSans};overflow-wrap:anywhere;">
              ${introHtml}
              ${
                rowHtml
                  ? `<div style="margin:28px 0 0 0;padding:24px;background-color:${s.bgDetailsCard};border:1px solid ${s.border};border-top:3px solid ${s.accent};">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rowHtml}</table>
              </div>`
                  : ""
              }
              ${beforeCtaHtml || ""}
              ${ctaHtml}
              ${extraHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px 40px;">
              <div style="margin-top:40px;padding-top:30px;border-top:2px solid ${s.border};text-align:center;font-size:13px;color:${s.muted};line-height:1.8;font-family:${s.fontSans};">
                <div style="margin-bottom:8px;"><strong style="color:${s.text};font-size:14px;">Rovaro Support</strong></div>
                <div style="color:${s.muted};margin-bottom:12px;">Spain car rental marketplace</div>
                <div><a href="https://rovaro.autos" style="color:${s.link};text-decoration:none;">rovaro.autos</a></div>
                <div style="margin-top:14px;padding-top:12px;border-top:1px solid ${s.border};font-size:11px;color:${s.footerMuted};line-height:1.7;">
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
