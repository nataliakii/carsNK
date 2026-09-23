import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  applyCompanyEmailDecision,
  sendCompanyEmailMessageToSuperadmin,
  parseCompanyEmailActionToken,
} from "@/domain/orders/companyEmailActions";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  supportMessageRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  getPartnerSupportCopy,
  normalizeSupportLocale,
  SUPPORT_REASON_CODES,
} from "@/domain/orders/partnerSupportCopy";

const PARTNER_BOOKINGS_PATH = "/admin/orders";

export const runtime = "nodejs";

function escape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveLang(request, extra) {
  const fromQuery = request?.nextUrl?.searchParams?.get?.("lang");
  const fromExtra = extra?.lang;
  const accept = request?.headers?.get?.("accept-language") || "";
  return normalizeSupportLocale(fromExtra || fromQuery || accept);
}

function htmlPage({ title, bodyHtml, ok = true, copy }) {
  const color = ok ? "#0A0A0A" : "#B71C1C";
  const brand = copy?.brand || "Rovaro";
  const backLabel = copy?.backToBookings || "Back to bookings";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escape(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fa;color:#0A0A0A;">
  <div style="max-width:560px;margin:48px auto;padding:28px 24px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(10,10,10,0.08);">
    <h1 style="margin:0 0 12px;font-size:1.35rem;color:${color};">${escape(title)}</h1>
    <div style="line-height:1.55;font-size:1rem;">${bodyHtml}</div>
    <p style="margin-top:28px;font-size:0.85rem;color:#667;">
      <a href="${escape(PARTNER_BOOKINGS_PATH)}" style="color:#E9004F;">${escape(backLabel)}</a>
      · ${escape(brand)}
    </p>
  </div>
</body>
</html>`;
}

function messageFormHtml(token, copy, actionUrl) {
  const idempotencyKey = crypto.randomBytes(16).toString("hex");
  const reasonOptions = SUPPORT_REASON_CODES.map(
    (code) =>
      `<option value="${escape(code)}">${escape(copy.reasons[code])}</option>`
  ).join("");

  return htmlPage({
    title: copy.pageTitle,
    ok: true,
    copy,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#455a64;">${escape(copy.intro)}</p>
      <button type="button" id="open-support"
        style="background:#fff;color:#0A0A0A;border:1px solid #cfd8dc;border-radius:8px;padding:8px 14px;font-size:0.88rem;font-weight:600;cursor:pointer;">
        ${escape(copy.button)}
      </button>
      <dialog id="support-dialog" style="border:0;border-radius:12px;padding:0;max-width:440px;width:calc(100% - 32px);box-shadow:0 16px 40px rgba(0,0,0,0.18);">
        <form method="POST" action="${escape(actionUrl)}" id="support-form" style="padding:22px 20px 18px;">
          <input type="hidden" name="token" value="${escape(token)}" />
          <input type="hidden" name="intent" value="message" />
          <input type="hidden" name="idempotencyKey" value="${escape(idempotencyKey)}" />
          <h2 style="margin:0 0 8px;font-size:1.1rem;">${escape(copy.title)}</h2>
          <p style="margin:0 0 14px;font-size:0.88rem;color:#546e7a;">${escape(copy.intro)}</p>
          <label style="display:block;font-size:0.8rem;color:#607d8b;margin-bottom:6px;">${escape(copy.reasonLabel)}</label>
          <select name="reason"
            style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;">
            ${reasonOptions}
          </select>
          <textarea name="message" required rows="5" minlength="2" maxlength="4000"
            placeholder="${escape(copy.messagePlaceholder)}"
            style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccd;border-radius:8px;font:inherit;"></textarea>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
            <button type="button" id="cancel-support"
              style="background:#fff;color:#455a64;border:1px solid #cfd8dc;border-radius:8px;padding:9px 14px;font-weight:600;cursor:pointer;">
              ${escape(copy.cancel)}
            </button>
            <button type="submit" id="send-support"
              style="background:#E9004F;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer;">
              ${escape(copy.send)}
            </button>
          </div>
        </form>
      </dialog>
      <noscript>
        <form method="POST" action="${escape(actionUrl)}" style="margin-top:18px;">
          <input type="hidden" name="token" value="${escape(token)}" />
          <input type="hidden" name="intent" value="message" />
          <input type="hidden" name="idempotencyKey" value="${escape(idempotencyKey)}" />
          <label style="display:block;font-size:0.8rem;color:#607d8b;margin-bottom:6px;">${escape(copy.reasonLabel)}</label>
          <select name="reason" style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;">
            ${reasonOptions}
          </select>
          <textarea name="message" required rows="5" minlength="2" maxlength="4000"
            placeholder="${escape(copy.messagePlaceholder)}"
            style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccd;border-radius:8px;font:inherit;"></textarea>
          <button type="submit"
            style="margin-top:12px;background:#E9004F;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;">
            ${escape(copy.send)}
          </button>
        </form>
      </noscript>
      <script>
        (function () {
          var dialog = document.getElementById("support-dialog");
          var openBtn = document.getElementById("open-support");
          var cancelBtn = document.getElementById("cancel-support");
          var form = document.getElementById("support-form");
          var sendBtn = document.getElementById("send-support");
          if (openBtn && dialog && dialog.showModal) {
            openBtn.addEventListener("click", function () { dialog.showModal(); });
          }
          if (cancelBtn && dialog) {
            cancelBtn.addEventListener("click", function () { dialog.close(); });
          }
          if (form && sendBtn) {
            form.addEventListener("submit", function () {
              sendBtn.disabled = true;
            });
          }
        })();
      </script>
    `,
  });
}

function confirmDecisionFormHtml(token, action, copy, actionUrl) {
  const isAccept = action === "accept";
  const title = isAccept ? "Confirm accept" : "Confirm reject";
  const verb = isAccept ? "accept" : "reject";
  const button = isAccept ? "Accept this order" : "Reject this order";
  return htmlPage({
    title,
    ok: true,
    copy,
    bodyHtml: `
      <p>This link only confirms your choice. The order is not updated until you submit.</p>
      <form method="POST" action="${escape(actionUrl)}" style="margin-top:16px;">
        <input type="hidden" name="token" value="${escape(token)}" />
        <input type="hidden" name="intent" value="${escape(verb)}" />
        <button type="submit"
          style="margin-top:12px;background:${isAccept ? "#008989" : "#E53935"};color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:700;cursor:pointer;">
          ${escape(button)}
        </button>
      </form>
    `,
  });
}

function htmlResponse(body, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * GET ?token=… — validate only. message → compact contact UI; accept/reject → confirm form.
 * No DB write.
 */
export async function GET(request) {
  const copy = getPartnerSupportCopy(resolveLang(request));
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = await parseCompanyEmailActionToken(token);
  if (!parsed.ok) {
    return htmlResponse(
      htmlPage({
        title: copy.invalidLink,
        ok: false,
        copy,
        bodyHtml: `<p>${escape(parsed.message)}</p>`,
      }),
      parsed.status || 400
    );
  }

  const actionUrl = "/api/order/company-email-action";
  if (parsed.action === "message") {
    return htmlResponse(messageFormHtml(token, copy, actionUrl));
  }

  return htmlResponse(confirmDecisionFormHtml(token, parsed.action, copy, actionUrl));
}

/**
 * POST — message form submit (application/x-www-form-urlencoded or JSON).
 */
export async function POST(request) {
  const copy = getPartnerSupportCopy(resolveLang(request));
  const contentType = request.headers.get("content-type") || "";
  let token = "";
  let intent = "";
  let message = "";
  let reason = "";
  let idempotencyKey = "";
  let lang = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = String(body.token || "");
    intent = String(body.intent || "message");
    message = String(body.message || "");
    reason = String(body.reason || "");
    idempotencyKey = String(body.idempotencyKey || "");
    lang = String(body.lang || "");
  } else {
    const form = await request.formData();
    token = String(form.get("token") || "");
    intent = String(form.get("intent") || "message");
    message = String(form.get("message") || "");
    reason = String(form.get("reason") || "");
    idempotencyKey = String(form.get("idempotencyKey") || "");
    lang = String(form.get("lang") || "");
  }

  const localeCopy = lang ? getPartnerSupportCopy(lang) : copy;

  if (intent === "accept" || intent === "reject") {
    const decision = intent === "accept" ? "accepted" : "rejected";
    const result = await applyCompanyEmailDecision({ token, decision });
    if (!result.ok) {
      return htmlResponse(
        htmlPage({
          title: "Could not update",
          ok: false,
          copy: localeCopy,
          bodyHtml: `<p>${escape(result.message)}</p>`,
        }),
        result.status || 400
      );
    }
    return htmlResponse(
      htmlPage({
        title: decision === "accepted" ? "Accepted" : "Rejected",
        ok: true,
        copy: localeCopy,
        bodyHtml: `<p>${escape(result.message)}</p>`,
      })
    );
  }

  const limited = await consumePublicPostOrError(
    request,
    supportMessageRateLimitOptions()
  );
  if (limited) {
    return htmlResponse(
      htmlPage({
        title: localeCopy.notSent,
        ok: false,
        copy: localeCopy,
        bodyHtml: `<p>Too many requests. Please wait a few minutes and try again.</p>`,
      }),
      limited.status
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  const result = await sendCompanyEmailMessageToSuperadmin({
    token,
    message,
    reason,
    idempotencyKey,
    ipAddress,
    userAgent,
    locale: lang || resolveLang(request),
  });
  if (!result.ok) {
    return htmlResponse(
      htmlPage({
        title: localeCopy.notSent,
        ok: false,
        copy: localeCopy,
        bodyHtml: `<p>${escape(result.message)}</p>`,
      }),
      result.status || 400
    );
  }

  return htmlResponse(
    htmlPage({
      title: localeCopy.success,
      ok: true,
      copy: localeCopy,
      bodyHtml: `<p>${escape(result.message)}</p>`,
    })
  );
}
