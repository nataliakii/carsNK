/**
 * Direct email send — no HTTP fetch. Use for server-side notifications
 * to avoid "fetch failed" when server calls itself.
 */
import nodemailer from "nodemailer";
import { getInternalNotificationEmail, normalizeEmailAddress } from "@config/email";
import { EMAIL_SIGNATURE_HTML, EMAIL_SIGNATURE_TEXT } from "@/app/ui/email/templates/signature";
import {
  SmtpConfigError,
  assertNoHeaderInjection,
  resolveMailSender,
  resolveSmtpTransportOptions,
  sanitizeSmtpError,
} from "@/lib/email/smtpConfig";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(resolveSmtpTransportOptions());
  }
  return transporter;
}

/** Test helper — drop the cached transporter after env changes. */
export function resetEmailTransporter() {
  transporter = null;
}

function wrapTextWithSignature(title, text) {
  const lines = (text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '<div style="height: 8px;"></div>';
      return `<div style="margin: 8px 0; color: #1a1a1a; line-height: 1.6; font-family: sans-serif;">${trimmed
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&/g, "&amp;")}</div>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${(title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title></head>
<body style="margin: 0; padding: 24px; font-family: sans-serif;">
  ${lines}
  ${EMAIL_SIGNATURE_HTML}
</body>
</html>`;
}

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function parseAttachments(rawAttachments) {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
    return [];
  }

  const attachments = [];
  for (const item of rawAttachments.slice(0, MAX_ATTACHMENTS)) {
    if (!item || typeof item !== "object") continue;

    const filename =
      typeof item.filename === "string" ? item.filename.trim() : "";
    if (!filename) continue;

    let content = null;
    if (Buffer.isBuffer(item.content)) {
      content = item.content;
    } else if (item.content instanceof Uint8Array) {
      content = Buffer.from(item.content);
    } else if (typeof item.contentBase64 === "string" && item.contentBase64.trim()) {
      content = Buffer.from(item.contentBase64.trim(), "base64");
    }

    if (!content || content.length === 0 || content.length > MAX_ATTACHMENT_BYTES) {
      continue;
    }

    attachments.push({
      filename,
      content,
      contentType:
        typeof item.contentType === "string" && item.contentType.trim()
          ? item.contentType.trim()
          : undefined,
      disposition: "attachment",
    });
  }

  return attachments;
}

function normalizeRecipientList(list) {
  const source = Array.isArray(list) ? list : [];
  const out = [];
  const seen = new Set();
  for (const raw of source) {
    assertNoHeaderInjection(raw, "recipient");
    const email = normalizeEmailAddress(raw);
    if (!email) {
      throw new SmtpConfigError("Invalid recipient", "SMTP_HEADER");
    }
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Send email directly (no HTTP). Same contract as /api/sendEmail expects.
 * Envelope From is always the resolved mailbox — never a customer address.
 * @param {{ title: string, message: string, html?: string, to: string[], cc?: string[], replyTo?: string, attachments?: Array<{ filename: string, contentBase64?: string, content?: Buffer|Uint8Array, contentType?: string }> }}
 */
export async function sendEmailDirect({
  title,
  message,
  html,
  to,
  cc = [],
  replyTo,
  attachments = [],
} = {}) {
  const sender = resolveMailSender();
  assertNoHeaderInjection(title, "subject");
  const hasReadyHtml = typeof html === "string" && html.trim().length > 0;
  const finalText = hasReadyHtml ? message || "" : `${message || ""}\n\n${EMAIL_SIGNATURE_TEXT}`;
  const finalHtml = hasReadyHtml ? html : wrapTextWithSignature(title, message || "");
  const parsedAttachments = parseAttachments(attachments);

  const toList = normalizeRecipientList(to);
  if (toList.length === 0) toList.push(getInternalNotificationEmail());
  const ccList = normalizeRecipientList(cc);

  let resolvedReplyTo = sender.replyTo;
  if (replyTo != null && String(replyTo).trim()) {
    assertNoHeaderInjection(replyTo, "replyTo");
    const validated = normalizeEmailAddress(replyTo);
    if (!validated) {
      throw new SmtpConfigError("Invalid replyTo", "SMTP_HEADER");
    }
    resolvedReplyTo = validated;
  }

  try {
    const info = await getTransporter().sendMail({
      from: sender.fromHeader,
      sender: sender.fromEmail,
      envelope: {
        from: sender.fromEmail,
        to: ccList.length > 0 ? [...toList, ...ccList] : toList,
      },
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      replyTo: resolvedReplyTo,
      subject: title,
      text: finalText,
      html: finalHtml,
      attachments: parsedAttachments.length > 0 ? parsedAttachments : undefined,
    });
    return { messageId: info.messageId, accepted: info.accepted };
  } catch (err) {
    if (err instanceof SmtpConfigError) throw err;
    const safe = new Error(sanitizeSmtpError(err));
    safe.code = "SMTP_SEND";
    throw safe;
  }
}
