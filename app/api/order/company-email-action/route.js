import { NextResponse } from "next/server";
import {
  applyCompanyEmailDecision,
  sendCompanyEmailMessageToSuperadmin,
  parseCompanyEmailActionToken,
} from "@/domain/orders/companyEmailActions";
import { absoluteUrl } from "@config/domain";

export const runtime = "nodejs";

function htmlPage({ title, bodyHtml, ok = true }) {
  const color = ok ? "#0B1F3A" : "#B71C1C";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fa;color:#0B1F3A;">
  <div style="max-width:560px;margin:48px auto;padding:28px 24px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(11,31,58,0.08);">
    <h1 style="margin:0 0 12px;font-size:1.35rem;color:${color};">${escape(title)}</h1>
    <div style="line-height:1.55;font-size:1rem;">${bodyHtml}</div>
    <p style="margin-top:28px;font-size:0.85rem;color:#667;">
      <a href="${absoluteUrl("/admin")}" style="color:#008989;">Open admin calendar</a>
      · CarsNK
    </p>
  </div>
</body>
</html>`;
}

function escape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function messageFormHtml(token) {
  const actionUrl = absoluteUrl("/api/order/company-email-action");
  return htmlPage({
    title: "Message superadmins",
    ok: true,
    bodyHtml: `
      <p>Write a short note about this order. Superadmins will receive it by email (and Telegram if configured).</p>
      <form method="POST" action="${actionUrl}" style="margin-top:16px;">
        <input type="hidden" name="token" value="${escape(token)}" />
        <input type="hidden" name="intent" value="message" />
        <textarea name="message" required rows="6" maxlength="4000"
          placeholder="Your message…"
          style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccd;border-radius:8px;font:inherit;"></textarea>
        <button type="submit"
          style="margin-top:12px;background:#E53935;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:700;cursor:pointer;">
          Send to superadmins
        </button>
      </form>
    `,
  });
}

/**
 * GET ?token=… — accept / reject execute; message shows form.
 */
export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = await parseCompanyEmailActionToken(token);
  if (!parsed.ok) {
    return new NextResponse(
      htmlPage({
        title: "Link invalid",
        ok: false,
        bodyHtml: `<p>${escape(parsed.message)}</p>`,
      }),
      { status: parsed.status || 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (parsed.action === "message") {
    return new NextResponse(messageFormHtml(token), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const decision = parsed.action === "accept" ? "accepted" : "rejected";
  const result = await applyCompanyEmailDecision({ token, decision });
  if (!result.ok) {
    return new NextResponse(
      htmlPage({
        title: "Could not update",
        ok: false,
        bodyHtml: `<p>${escape(result.message)}</p>`,
      }),
      { status: result.status || 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    htmlPage({
      title: decision === "accepted" ? "Accepted" : "Rejected",
      ok: true,
      bodyHtml: `<p>${escape(result.message)}</p>`,
    }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/**
 * POST — message form submit (application/x-www-form-urlencoded or JSON).
 */
export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";
  let token = "";
  let intent = "";
  let message = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = String(body.token || "");
    intent = String(body.intent || "message");
    message = String(body.message || "");
  } else {
    const form = await request.formData();
    token = String(form.get("token") || "");
    intent = String(form.get("intent") || "message");
    message = String(form.get("message") || "");
  }

  if (intent === "accept" || intent === "reject") {
    const decision = intent === "accept" ? "accepted" : "rejected";
    const result = await applyCompanyEmailDecision({ token, decision });
    if (!result.ok) {
      return new NextResponse(
        htmlPage({
          title: "Could not update",
          ok: false,
          bodyHtml: `<p>${escape(result.message)}</p>`,
        }),
        { status: result.status || 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new NextResponse(
      htmlPage({
        title: decision === "accepted" ? "Accepted" : "Rejected",
        ok: true,
        bodyHtml: `<p>${escape(result.message)}</p>`,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const result = await sendCompanyEmailMessageToSuperadmin({ token, message });
  if (!result.ok) {
    return new NextResponse(
      htmlPage({
        title: "Message not sent",
        ok: false,
        bodyHtml: `<p>${escape(result.message)}</p>`,
      }),
      { status: result.status || 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(
    htmlPage({
      title: "Message sent",
      ok: true,
      bodyHtml: `<p>${escape(result.message)}</p>`,
    }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
