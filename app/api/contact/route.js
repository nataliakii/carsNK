import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import {
  getInternalNotificationEmail,
  isValidEmailAddress,
  normalizeEmailAddress,
} from "@config/email";
import { COMPANY_ID } from "@config/company";
import Company from "@models/company";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import { consumePublicPostOrError, contactRateLimitOptions } from "@/services/publicPostRateLimit";
import { sanitizeSmtpError } from "@/lib/email/smtpConfig";

export const runtime = "nodejs";

const MAX_NAME = 200;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 4000;
const HEADER_INJECTION = /[\r\n]/;

function uniqueEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const email = normalizeEmailAddress(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function clip(value, max) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const name = clip(body?.name, MAX_NAME);
  const email = clip(body?.email, MAX_EMAIL);
  const subject = clip(body?.subject, MAX_SUBJECT);
  const message = clip(body?.message, MAX_MESSAGE);

  if (!name || !email || !message) {
    return NextResponse.json(
      { success: false, message: "name, email and message are required" },
      { status: 400 }
    );
  }

  if (
    HEADER_INJECTION.test(name) ||
    HEADER_INJECTION.test(email) ||
    HEADER_INJECTION.test(subject)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid input" },
      { status: 400 }
    );
  }

  if (!isValidEmailAddress(email)) {
    return NextResponse.json(
      { success: false, message: "Invalid email" },
      { status: 400 }
    );
  }

  try {
    await connectToDB();
  } catch (err) {
    console.error("[contact] db connect failed", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Service unavailable" },
      { status: 503 }
    );
  }

  const limited = await consumePublicPostOrError(
    request,
    contactRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  let companyEmail = "";
  try {
    const company = await Company.findById(COMPANY_ID).select("email").lean();
    companyEmail = String(company?.email || "").trim();
  } catch (err) {
    console.error("[contact] company lookup failed", err?.message || err);
  }

  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    subject ? `Subject: ${subject}` : null,
    "",
    message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const customerReplyTo = normalizeEmailAddress(email);
  const recipients = uniqueEmails([
    getInternalNotificationEmail(),
    companyEmail,
  ]);

  try {
    await sendEmailDirect({
      title: subject
        ? `Contact form: ${subject}`
        : `Contact form from ${name}`,
      message: text,
      to: recipients,
      replyTo: customerReplyTo || undefined,
      meta: { type: MAIL_TYPE.CONTACT },
    });
  } catch (err) {
    console.error("[contact] send failed", sanitizeSmtpError(err));
    return NextResponse.json(
      { success: false, message: "Failed to send message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, status: "Email sent" }, { status: 200 });
}
