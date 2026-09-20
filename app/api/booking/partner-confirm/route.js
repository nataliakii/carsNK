import { NextResponse } from "next/server";

import { absoluteUrl } from "@config/domain";
import { getOperatorLine, getPublicLegalEntity } from "@config/legalEntity";
import {
  buildConfirmationView,
  consumeConfirmationToken,
  PARTNER_CONFIRMATION_BUTTON_LABEL,
} from "@/domain/booking/partnerBookingConfirmation";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  bookingConfirmRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Partner booking confirmation.
 *
 *   GET  — renders the confirmation page. Read-only: opening the link, a link
 *          preview fetch, or an email scanner following it changes nothing.
 *   POST — consumes the one-time token and records the decision.
 *
 * Everything shown is recomputed server-side from the stored booking; no
 * amount is taken from the URL or the form.
 */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(minor, currency) {
  const amount = Number(minor || 0) / 100;
  return `${currency} ${amount.toFixed(2)}`;
}

function dateTime(value, timezone) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) +
      (timezone ? ` (${timezone})` : " UTC");
  } catch {
    return "—";
  }
}

function page({ title, bodyHtml, ok = true }) {
  const entity = getPublicLegalEntity();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fa;color:#0A0A0A;">
  <div style="max-width:680px;margin:40px auto;padding:28px 24px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 16px;font-size:1.3rem;color:${ok ? "#0A0A0A" : "#B71C1C"};">${esc(title)}</h1>
    ${bodyHtml}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:0.76rem;color:#78909c;line-height:1.7;">
      ${esc(getOperatorLine())}<br />
      ${esc(entity.legalEmail)}
    </p>
  </div>
</body>
</html>`;
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

function detailRow(label, value) {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#607d8b;font-size:0.85rem;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:0.9rem;font-weight:600;">${esc(value)}</td>
  </tr>`;
}

function confirmationFormHtml(token, view) {
  const b = view.booking;
  const f = b.financials;
  const actionUrl = absoluteUrl("/api/booking/partner-confirm");

  const rules = view.cancellationRules;
  const ruleLines = [
    rules.supplierCancellationServiceCharge != null
      ? `Supplier cancellation service charge: ${rules.currency} ${Number(rules.supplierCancellationServiceCharge).toFixed(2)}`
      : "Supplier cancellation service charge: as set out in the Rovaro fee schedule",
    rules.replacementCostDifferenceCap != null
      ? `Replacement cost difference cap: ${rules.currency} ${Number(rules.replacementCostDifferenceCap).toFixed(2)}`
      : "Replacement cost difference cap: as set out in the Rovaro fee schedule",
    `A replacement vehicle must be notified at least ${rules.replacementNotificationHours} hours before pickup and requires the customer's explicit consent.`,
  ];

  const agreementLine = view.agreement.applicableVersion
    ? `Partner Agreement ${esc(view.agreement.applicableVersion.agreementId)} (accepted ${esc(
        new Date(view.agreement.applicableVersion.acceptedAt).toISOString().slice(0, 10)
      )})`
    : view.agreement.partnerAgreementVersion
      ? `Partner Agreement v${esc(view.agreement.partnerAgreementVersion.version)}`
      : "Partner Agreement — version not yet recorded";

  return page({
    title: "Confirm vehicle availability",
    bodyHtml: `
      <p style="font-size:0.9rem;color:#455a64;line-height:1.6;margin:0 0 20px;">
        Please check the booking below. Opening this page does not change anything —
        the booking is only confirmed when you submit the form.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${detailRow("Booking ID", b.orderNumber ? `${b.orderNumber} (${b.bookingId})` : b.bookingId)}
        ${detailRow("Vehicle", [b.vehicle.model, b.vehicle.regNumber].filter(Boolean).join(" · "))}
        ${detailRow("Category", [b.vehicle.category, b.vehicle.transmission, b.vehicle.seats ? `${b.vehicle.seats} seats` : ""].filter(Boolean).join(" · ") || "—")}
        ${detailRow("Pickup", `${dateTime(b.pickup.atUtc, b.timezone)} — ${b.pickup.place || "—"}${b.pickup.detail ? ` (${b.pickup.detail})` : ""}`)}
        ${detailRow("Return", `${dateTime(b.dropoff.atUtc, b.timezone)} — ${b.dropoff.place || "—"}${b.dropoff.detail ? ` (${b.dropoff.detail})` : ""}`)}
        ${detailRow("Rental days", b.numberOfDays ?? "—")}
        ${detailRow("Insurance", b.insurance || "—")}
        ${detailRow("Extras", [b.extras.childSeats ? `Child seats ×${b.extras.childSeats}` : "", b.extras.secondDriver ? "Second driver" : ""].filter(Boolean).join(", ") || "None")}
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#fafafa;padding:8px;">
        ${detailRow("Total price", money(f.grossMinor, f.currency))}
        ${detailRow(`Booking prepayment (${f.prepaymentPercent}%, paid to Rovaro)`, money(f.prepaymentMinor, f.currency))}
        ${detailRow("Balance you collect at handover", money(f.balanceMinor, f.currency))}
        ${detailRow("Vehicle security deposit (yours, separate)", b.securityDeposit != null ? `${f.currency} ${Number(b.securityDeposit).toFixed(2)}` : "As per your rental agreement")}
      </table>

      <div style="background:#fff8e1;border-radius:8px;padding:12px 14px;margin-bottom:20px;font-size:0.82rem;color:#5d4037;line-height:1.65;">
        <strong>Cancellation and replacement rules</strong><br />
        ${ruleLines.map((line) => esc(line)).join("<br />")}
      </div>

      <p style="font-size:0.8rem;color:#607d8b;margin-bottom:20px;">
        Applicable agreement: ${agreementLine}
      </p>

      <form method="POST" action="${actionUrl}">
        <input type="hidden" name="token" value="${esc(token)}" />
        <input type="hidden" name="decision" value="accepted" />
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:0.86rem;line-height:1.6;cursor:pointer;">
          <input type="checkbox" name="accepted" value="yes" required style="margin-top:3px;" />
          <span>${esc(view.statement)}</span>
        </label>
        <button type="submit"
          style="margin-top:18px;background:#E30052;color:#fff;border:0;border-radius:8px;padding:13px 22px;font-weight:700;font-size:0.95rem;cursor:pointer;">
          ${esc(PARTNER_CONFIRMATION_BUTTON_LABEL)}
        </button>
      </form>

      <form method="POST" action="${actionUrl}" style="margin-top:18px;">
        <input type="hidden" name="token" value="${esc(token)}" />
        <input type="hidden" name="decision" value="declined" />
        <input type="text" name="reason" maxlength="500" placeholder="Reason (optional)"
          style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;font-size:0.86rem;" />
        <button type="submit"
          style="margin-top:10px;background:#fff;color:#B71C1C;border:1px solid #ef9a9a;border-radius:8px;padding:11px 18px;font-weight:600;font-size:0.88rem;cursor:pointer;">
          Cannot provide this vehicle
        </button>
      </form>
    `,
  });
}

/** GET never writes to the booking. */
export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const view = await buildConfirmationView(token);

  if (!view.ok) {
    return htmlResponse(
      page({
        title: "Link not valid",
        ok: false,
        bodyHtml: `<p style="font-size:0.92rem;color:#455a64;">${esc(view.message)}</p>`,
      }),
      view.status || 400
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "BOOKING_CONFIRMATION_PAGE_VIEWED",
    severity: "low",
    ipAddress,
    userAgent,
    orderData: { orderId: view.booking.bookingId },
    metadata: { alreadyConsumed: view.alreadyConsumed },
  });

  if (view.alreadyConsumed) {
    return htmlResponse(
      page({
        title:
          view.decision === "accepted"
            ? "Already confirmed"
            : "Already answered",
        bodyHtml: `<p style="font-size:0.92rem;color:#455a64;">
          This booking has already been ${esc(view.decision === "accepted" ? "confirmed" : "declined")}.
          Contact Rovaro if something needs to change.
        </p>`,
      })
    );
  }

  return htmlResponse(confirmationFormHtml(token, view));
}

/** POST performs the actual, legally significant confirmation. */
export async function POST(request) {
  const limited = await consumePublicPostOrError(
    request,
    bookingConfirmRateLimitOptions()
  );
  if (limited) {
    return htmlResponse(
      page({
        title: "Too many attempts",
        ok: false,
        bodyHtml: `<p style="font-size:0.92rem;">Please wait a few minutes and try again.</p>`,
      }),
      limited.status
    );
  }

  const contentType = request.headers.get("content-type") || "";
  let token = "";
  let decision = "";
  let accepted = false;
  let reason = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = String(body.token || "");
    decision = String(body.decision || "");
    accepted = Boolean(body.accepted);
    reason = String(body.reason || "");
  } else {
    const form = await request.formData();
    token = String(form.get("token") || "");
    decision = String(form.get("decision") || "");
    accepted = String(form.get("accepted") || "") === "yes";
    reason = String(form.get("reason") || "");
  }

  if (decision !== "accepted" && decision !== "declined") {
    return htmlResponse(
      page({
        title: "Invalid request",
        ok: false,
        bodyHtml: `<p style="font-size:0.92rem;">Unknown decision.</p>`,
      }),
      400
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  const result = await consumeConfirmationToken({
    token,
    decision,
    accepted,
    ipAddress,
    userAgent,
    reason,
  });

  if (!result.ok) {
    return htmlResponse(
      page({
        title: "Could not record your answer",
        ok: false,
        bodyHtml: `<p style="font-size:0.92rem;color:#455a64;">${esc(result.message)}</p>`,
      }),
      result.status || 400
    );
  }

  return htmlResponse(
    page({
      title: result.decision === "accepted" ? "Availability confirmed" : "Booking declined",
      bodyHtml: `<p style="font-size:0.92rem;color:#455a64;line-height:1.6;">${esc(result.message)}</p>`,
    })
  );
}
