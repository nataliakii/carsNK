/**
 * POST /api/sendEmail — restricted operational relay.
 *
 * No in-app callers remain (confirmation, contact, notifications all use
 * sendEmailDirect). This HTTP surface is kept only for superadmin / internal
 * ops. Partner ADMIN sessions cannot use it as an email relay.
 *
 * Auth: requireSuperAdmin OR x-internal-password matching
 * ORDER_CONFIRMATION_INTERNAL_PASSWORD.
 */
import { NextResponse } from "next/server";
import { getInternalNotificationEmail } from "@config/email";
import { requireSuperAdmin } from "@/lib/adminAuth";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sanitizeSmtpError } from "@/lib/email/smtpConfig";
import { connectToDB } from "@lib/database";
import AuditLog from "@models/auditLog";
import {
  consumePublicPostOrError,
  sendEmailRateLimitOptions,
} from "@/services/publicPostRateLimit";
import { extractClientContext } from "@/middleware/orderGuard";

const INTERNAL_PASSWORD_HEADER = "x-internal-password";
const MAX_SUBJECT = 200;
const MAX_TEXT = 10000;
const MAX_RECIPIENTS = 10;
const HEADER_INJECTION = /[\r\n]/;
const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

function json(body, status) {
  return NextResponse.json(body, { status });
}

function normalizeEmail(raw) {
  const email = String(raw || "").trim();
  if (!email || email.length > 254) return null;
  if (HEADER_INJECTION.test(email)) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email.toLowerCase();
}

function collectRecipients(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  if (list.length > MAX_RECIPIENTS) {
    return { ok: false, message: "Too many recipients" };
  }
  const seen = new Set();
  const emails = [];
  for (const item of list) {
    const email = normalizeEmail(item);
    if (!email) {
      return { ok: false, message: "Invalid recipient" };
    }
    if (!seen.has(email)) {
      seen.add(email);
      emails.push(email);
    }
  }
  return { ok: true, emails };
}

async function authorizeSendEmail(request) {
  const expectedInternalPassword = process.env.ORDER_CONFIRMATION_INTERNAL_PASSWORD;
  const providedInternalPassword = request.headers
    .get(INTERNAL_PASSWORD_HEADER)
    ?.trim();
  const hasInternalPassword =
    typeof expectedInternalPassword === "string" &&
    expectedInternalPassword.length > 0 &&
    providedInternalPassword === expectedInternalPassword;

  if (hasInternalPassword) {
    return { ok: true, actor: { role: "system", email: "internal" } };
  }

  const { session, errorResponse } = await requireSuperAdmin(request);
  if (session) {
    return { ok: true, actor: session.user };
  }

  const status = errorResponse?.status || 401;
  const message =
    status === 403 ? "Forbidden — superadmin only" : "Unauthorized";
  return { ok: false, response: json({ message }, status) };
}

async function writeSendEmailAudit({ actor, to, request, result, errorMessage }) {
  try {
    const { ip, userAgent } = extractClientContext(request);
    await AuditLog.create({
      action: "SUPERADMIN_ACTION",
      userEmail: typeof actor?.email === "string" ? actor.email : undefined,
      userRole: actor?.role === "system" ? "system" : "superadmin",
      metadata: {
        intent: "SEND_EMAIL_RELAY",
        recipientCount: Array.isArray(to) ? to.length : 0,
      },
      ipAddress: ip,
      userAgent,
      result,
      errorMessage,
      severity: "medium",
    });
  } catch (err) {
    console.error("[sendEmail] audit failed", err?.message || err);
  }
}

export async function POST(request) {
  const auth = await authorizeSendEmail(request);
  if (!auth.ok) return auth.response;

  try {
    await connectToDB();
  } catch (err) {
    console.error("[sendEmail] db connect failed", err?.message || err);
    return json({ message: "Service unavailable" }, 503);
  }

  const limited = await consumePublicPostOrError(
    request,
    sendEmailRateLimitOptions()
  );
  if (limited) {
    return json(limited.body, limited.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const title = String(body?.title || "").trim();
  const text = String(body?.text != null ? body.text : body?.message || "");
  if (!title || !text.trim()) {
    return json(
      { error: "Missing email content: title and text required." },
      400
    );
  }
  if (HEADER_INJECTION.test(title) || title.length > MAX_SUBJECT) {
    return json({ message: "Invalid subject" }, 400);
  }
  if (text.length > MAX_TEXT) {
    return json({ message: "Message too long" }, 400);
  }
  if (body?.html != null && String(body.html).trim()) {
    return json({ message: "Client HTML is not allowed" }, 400);
  }
  if (Array.isArray(body?.attachments) && body.attachments.length > 0) {
    return json({ message: "Attachments are not allowed" }, 400);
  }

  const toParsed = collectRecipients(
    Array.isArray(body?.to) && body.to.length > 0
      ? body.to
      : [getInternalNotificationEmail()]
  );
  if (!toParsed.ok) {
    return json({ message: toParsed.message }, 400);
  }
  const ccParsed = collectRecipients(body?.cc || []);
  if (!ccParsed.ok) {
    return json({ message: ccParsed.message }, 400);
  }

  try {
    const info = await sendEmailDirect({
      title,
      message: text,
      to: toParsed.emails,
      cc: ccParsed.emails,
    });
    await writeSendEmailAudit({
      actor: auth.actor,
      to: toParsed.emails,
      request,
      result: "success",
    });
    return json(
      {
        status: "Email sent",
        messageId: info?.messageId,
      },
      200
    );
  } catch (error) {
    console.error("[sendEmail] send failed", sanitizeSmtpError(error));
    await writeSendEmailAudit({
      actor: auth.actor,
      to: toParsed.emails,
      request,
      result: "failure",
      errorMessage: sanitizeSmtpError(error).slice(0, 200),
    });
    return json({ error: "Failed to send email" }, 500);
  }
}
