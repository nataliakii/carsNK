/**
 * Admin/system order notification email — голубая заставка, контент, подпись BBQR в цветах.
 * Optional actions: CTA buttons for company email (Accept / Reject / Calendar / Message).
 */

import { EMAIL_STYLE, escapeHtml } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { EMAIL_SIGNATURE_HTML } from "@/app/ui/email/templates/signature";

function formatLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return "";

  const emailMatch = trimmed.match(/^(\s*•\s*Email:\s*)([^\s]+@[^\s]+)(\s*)$/);
  if (emailMatch) {
    const before = escapeHtml(emailMatch[1]);
    const addr = emailMatch[2];
    const after = escapeHtml(emailMatch[3] || "");
    return `${before}<a href="mailto:${escapeHtml(addr)}" style="color:#008989;text-decoration:none;">${escapeHtml(addr)}</a>${after}`;
  }

  if (trimmed.includes("NEW ORDER")) {
    const idx = trimmed.indexOf("NEW ORDER");
    const rest = trimmed.slice(idx + "NEW ORDER".length);
    return (
      escapeHtml(trimmed.slice(0, idx)) +
      `<span style="background-color:${EMAIL_STYLE.border};padding:2px 8px;border-radius:4px;font-size:12px;">NEW</span> ORDER` +
      escapeHtml(rest)
    );
  }

  if (trimmed.startsWith("👤 Customer:")) {
    return `<strong style="color:${EMAIL_STYLE.accent};">${escapeHtml(trimmed)}</strong>`;
  }

  if (trimmed.startsWith("🪪")) {
    return `<strong style="color:${EMAIL_STYLE.accent};">${escapeHtml(trimmed)}</strong>`;
  }
  const cloudMatch = trimmed.match(/(https:\/\/res\.cloudinary\.com\/\S+)/);
  if (cloudMatch && trimmed.startsWith("•")) {
    const url = cloudMatch[1];
    const idx = trimmed.indexOf(url);
    const before = trimmed.slice(0, idx);
    return `${escapeHtml(before)}<a href="${escapeHtml(url)}" style="color:#008989;text-decoration:none;word-break:break-all;">${escapeHtml(url)}</a>`;
  }

  return escapeHtml(trimmed);
}

function renderActionsHtml(actions) {
  if (!Array.isArray(actions) || actions.length === 0) return "";
  const s = EMAIL_STYLE;
  const buttons = actions
    .filter((a) => a?.href && a?.label)
    .map((a) => {
      const bg =
        a.variant === "danger"
          ? "#E53935"
          : a.variant === "secondary"
            ? "#0B1F3A"
            : a.variant === "outline"
              ? "#ffffff"
              : "#008989";
      const color = a.variant === "outline" ? "#0B1F3A" : "#ffffff";
      const border =
        a.variant === "outline" ? "1px solid #0B1F3A" : `1px solid ${bg}`;
      return `<a href="${escapeHtml(a.href)}"
        style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;background:${bg};color:${color};border:${border};border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;font-family:${s.fontSans};">
        ${escapeHtml(a.label)}
      </a>`;
    })
    .join("");
  if (!buttons) return "";
  return `
    <tr>
      <td style="padding:8px 40px 28px 40px;">
        <div style="margin:0 0 10px;color:${s.muted};font-size:13px;font-family:${s.fontSans};">
          Quick actions (no customer contacts in this email):
        </div>
        ${buttons}
      </td>
    </tr>`;
}

/**
 * @param {{ title: string, body: string, actions?: Array<{ label: string, href: string, variant?: string }> }} data
 * @returns {string}
 */
export function renderAdminOrderNotificationHtml(data) {
  const { title, body, actions } = data;
  const s = EMAIL_STYLE;

  const linesHtml = (body || "")
    .split("\n")
    .map((line) => {
      const content = formatLine(line);
      if (!content) return '<div style="height:8px;"></div>';
      return `<div style="margin:8px 0;color:${s.text};line-height:1.6;font-size:15px;font-family:${s.fontSans};">${content}</div>`;
    })
    .join("");

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
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};box-shadow:0 2px 8px rgba(0,0,0,0.08);border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:${s.headerTeal};padding:30px 40px;text-align:center;">
              <h1 style="margin:0;color:${s.headerText};font-size:22px;font-weight:600;letter-spacing:0.5px;font-family:${s.fontSans};">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 20px 40px;">
              ${linesHtml}
            </td>
          </tr>
          ${renderActionsHtml(actions)}
          <tr>
            <td style="padding:0 40px 30px 40px;">
              ${EMAIL_SIGNATURE_HTML}
            </td>
          </tr>
        </table>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;margin-top:20px;">
          <tr>
            <td style="text-align:center;padding:20px;color:${s.muted};font-size:12px;font-family:${s.fontSans};">
              <p style="margin:0;">© ${new Date().getFullYear()} CarsNK. All rights reserved. · <a href="https://carsnk.gr" style="color:${s.muted};">carsnk.gr</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
