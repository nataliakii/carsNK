import { DEVELOPER_EMAIL } from "@config/email";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { renderAdminOrderNotificationHtml } from "@/app/ui/email/templates/adminOrderNotification";
import {
  EMAIL_STYLE,
  escapeHtml,
} from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { EMAIL_SIGNATURE_HTML } from "@/app/ui/email/templates/signature";

const ADMIN_TRANSFER_EMAILS = [
  DEVELOPER_EMAIL,
  "admin@bbqr.site",
  String(process.env.MAIL_FROM_TO_ADMIN || "").trim(),
].filter(Boolean);

function uniqueEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function formatWhen(datetime) {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function buildTransferDetailsLines(doc) {
  return [
    `From: ${doc.from}`,
    `To: ${doc.to}`,
    doc.distanceKm != null
      ? `Distance: ${doc.distanceKm} km${
          doc.durationMinutes != null ? ` (~${doc.durationMinutes} min)` : ""
        }`
      : null,
    `When: ${formatWhen(doc.datetime)}`,
    `Passengers: ${doc.passengers}`,
    doc.customerName ? `Name: ${doc.customerName}` : null,
    doc.phone ? `Phone: ${doc.phone}` : null,
    doc.email ? `Email: ${doc.email}` : null,
    doc.notes ? `Notes: ${doc.notes}` : null,
  ].filter(Boolean);
}

function renderCustomerTransferHtml({ title, greeting, lines }) {
  const s = EMAIL_STYLE;
  const linesHtml = lines
    .map(
      (line) =>
        `<div style="margin:8px 0;color:${s.text};line-height:1.6;font-size:15px;font-family:${s.fontSans};">${escapeHtml(line)}</div>`
    )
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
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background-color:${s.bgCard};border:1px solid ${s.border};border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:${s.headerTeal};color:${s.headerText};padding:24px 28px;font-size:20px;font-weight:600;">
              ${escapeHtml(title)}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="margin:0 0 16px;color:${s.text};font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</div>
              ${linesHtml}
              <div style="margin:20px 0 0;color:${s.muted};font-size:14px;line-height:1.5;">
                We will contact you shortly to confirm the transfer details.
              </div>
              ${EMAIL_SIGNATURE_HTML}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Email admins + customer after a transfer request is created.
 * Failures are logged; caller should not fail the HTTP response.
 * @param {object} doc - Transfer mongoose doc / lean object
 */
export async function notifyTransferEmails(doc) {
  const lines = buildTransferDetailsLines(doc);
  const body = lines.join("\n");
  const adminTitle = "🚕 New transfer request — CarsNK";
  const adminTo = uniqueEmails(ADMIN_TRANSFER_EMAILS);

  const adminHtml = renderAdminOrderNotificationHtml({
    title: adminTitle,
    body,
  });

  await sendEmailDirect({
    title: adminTitle,
    message: body,
    html: adminHtml,
    to: adminTo,
  });

  const customerEmail = String(doc.email || "").trim();
  if (!customerEmail || !customerEmail.includes("@")) {
    return { adminSent: true, customerSent: false };
  }

  const name = String(doc.customerName || "").trim() || "there";
  const customerTitle = "CarsNK — transfer request received";
  const greeting = `Hi ${name}, thank you for your transfer request. Here are the details:`;
  const customerHtml = renderCustomerTransferHtml({
    title: customerTitle,
    greeting,
    lines,
  });

  await sendEmailDirect({
    title: customerTitle,
    message: `${greeting}\n\n${body}`,
    html: customerHtml,
    to: [customerEmail],
    cc: [DEVELOPER_EMAIL],
  });

  return { adminSent: true, customerSent: true };
}

export default notifyTransferEmails;
