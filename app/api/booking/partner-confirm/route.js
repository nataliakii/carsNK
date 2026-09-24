import { NextResponse } from "next/server";

import { absoluteUrl } from "@config/domain";
import {
  buildConfirmationView,
  consumeConfirmationToken,
  PARTNER_CONFIRMATION_BUTTON_LABEL,
} from "@/domain/booking/partnerBookingConfirmation";
import {
  listEligibleAlternativeCars,
  offerAlternativeVehicle,
} from "@/domain/booking/alternativeVehicle";
import { ROLE } from "@models/user";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  bookingConfirmRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  formatMarketplaceEuro,
  marketplaceSplitLabels,
} from "@/domain/orders/marketplaceFinancialSplit";

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
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f5f7fa;color:#0A0A0A;">
  <div style="max-width:640px;margin:32px auto;padding:24px 20px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 16px;font-size:1.25rem;color:${ok ? "#0A0A0A" : "#B71C1C"};">${esc(title)}</h1>
    ${bodyHtml}
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
  const splitLabels = marketplaceSplitLabels("en");
  const actionUrl = absoluteUrl("/api/booking/partner-confirm");
  const partnerTermsUrl = absoluteUrl("/en/partner-terms");

  return page({
    title: "Confirm availability",
    bodyHtml: `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${detailRow("Booking", b.orderNumber || b.bookingId)}
        ${detailRow("Vehicle", [b.vehicle.model, b.vehicle.regNumber].filter(Boolean).join(" · "))}
        ${detailRow("Pickup", `${dateTime(b.pickup.atUtc, b.timezone)} — ${b.pickup.place || "—"}`)}
        ${detailRow("Return", `${dateTime(b.dropoff.atUtc, b.timezone)} — ${b.dropoff.place || "—"}`)}
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${detailRow(splitLabels.total, formatMarketplaceEuro(f.grossMinor))}
        ${detailRow(splitLabels.paidToRovaro, formatMarketplaceEuro(f.prepaymentMinor))}
        ${detailRow(splitLabels.collectFromCustomer, formatMarketplaceEuro(f.balanceMinor))}
      </table>
      <p style="margin:0 0 20px;font-size:0.85rem;">
        <a href="${esc(partnerTermsUrl)}" style="color:#E9004F;font-weight:600;text-decoration:none;">${esc(splitLabels.partnerTerms)}</a>
      </p>

      <form method="POST" action="${actionUrl}">
        <input type="hidden" name="token" value="${esc(token)}" />
        <input type="hidden" name="decision" value="accepted" />
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:0.9rem;line-height:1.5;cursor:pointer;">
          <input type="checkbox" name="accepted" value="yes" required style="margin-top:3px;" />
          <span>${esc(view.statement)}</span>
        </label>
        <button type="submit"
          style="margin-top:16px;background:#E9004F;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:700;font-size:0.95rem;cursor:pointer;">
          ${esc(PARTNER_CONFIRMATION_BUTTON_LABEL)}
        </button>
      </form>

      <form method="POST" action="${actionUrl}" style="margin-top:16px;">
        <input type="hidden" name="token" value="${esc(token)}" />
        <input type="hidden" name="decision" value="declined" />
        <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:6px;">Decline reason</label>
        <select name="reasonCode" required
          style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;font-size:0.86rem;">
          <option value="">Select a reason</option>
          <option value="vehicle_unavailable">Vehicle unavailable</option>
          <option value="dates_unavailable">Dates unavailable</option>
          <option value="customer_does_not_meet_requirements">Customer does not meet rental requirements</option>
          <option value="documents_not_acceptable">Documents not acceptable</option>
          <option value="incorrect_listing_or_price">Incorrect listing or price</option>
          <option value="safety_or_fraud_concern">Safety or fraud concern</option>
          <option value="other">Other</option>
        </select>
        <input type="text" name="explanation" maxlength="1000" placeholder="Explanation (required for Other)"
          style="width:100%;box-sizing:border-box;margin-top:10px;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;font-size:0.86rem;" />
        <button type="submit"
          style="margin-top:10px;background:#fff;color:#B71C1C;border:1px solid #ef9a9a;border-radius:8px;padding:10px 16px;font-weight:600;font-size:0.88rem;cursor:pointer;">
          Decline
        </button>
      </form>
      ${alternativeFormHtml(token, view, actionUrl)}
    `,
  });
}

function moneyCap(cap) {
  if (!cap) return "";
  return formatMarketplaceEuro(cap.offeredGrossMinor);
}

function alternativeFormHtml(token, view, actionUrl) {
  const cars = Array.isArray(view.eligibleAlternativeCars) ? view.eligibleAlternativeCars : [];
  const blocked = view.alternativeEligibility;
  if (blocked?.code === "paid_requires_manual") {
    return `<div style="margin-top:24px;padding:12px;border:1px solid #eee;border-radius:8px;font-size:0.85rem;">
      This booking is already paid. Contact Rovaro to change the car.
    </div>`;
  }
  if (!cars.length) {
    return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;">
      <h2 style="font-size:1rem;margin:0 0 6px;">Offer alternative</h2>
      <p style="font-size:0.85rem;color:#546e7a;margin:0;">No other car from this fleet is available for these dates.</p>
    </div>`;
  }
  const options = cars
    .map((car) => {
      const label = [
        car.unpublished ? "(internal)" : null,
        car.name,
        car.category,
        moneyCap(car.cap),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<option value="${esc(car.carId)}">${esc(label)}</option>`;
    })
    .join("");
  return `<form method="POST" action="${actionUrl}" style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;">
    <h2 style="font-size:1rem;margin:0 0 10px;">Offer alternative</h2>
    <input type="hidden" name="token" value="${esc(token)}" />
    <input type="hidden" name="decision" value="offer_alternative" />
    <label style="display:block;font-size:0.82rem;font-weight:600;margin-bottom:6px;">Replacement car</label>
    <select name="proposedCarId" required
      style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;font-size:0.9rem;">
      <option value="">Select a car</option>
      ${options}
    </select>
    <input type="text" name="reason" maxlength="500" required placeholder="Reason (shown to the customer)"
      style="width:100%;box-sizing:border-box;margin-top:10px;padding:10px;border:1px solid #cfd8dc;border-radius:8px;font:inherit;font-size:0.86rem;" />
    <button type="submit"
      style="margin-top:12px;background:#1565c0;color:#fff;border:0;border-radius:8px;padding:11px 16px;font-weight:700;font-size:0.9rem;cursor:pointer;">
      Offer alternative
    </button>
  </form>`;
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

  const actor = {
    role: ROLE.ADMIN,
    ownerId: view.booking?.ownerId,
    email: "",
    isSuperadmin: false,
  };
  const eligible = await listEligibleAlternativeCars({
    orderId: view.booking.bookingId,
    actor,
  });
  view.eligibleAlternativeCars = eligible.ok ? eligible.cars : [];
  view.excludedAlternativeCars = eligible.ok ? eligible.excluded : [];
  view.alternativeEligibility = eligible.ok
    ? { ok: true }
    : { code: eligible.code, message: eligible.message };

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
  let reasonCode = "";
  let explanation = "";
  let proposedCarId = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = String(body.token || "");
    decision = String(body.decision || "");
    accepted = Boolean(body.accepted);
    reason = String(body.reason || "");
    reasonCode = String(body.reasonCode || "");
    explanation = String(body.explanation || "");
    proposedCarId = String(body.proposedCarId || body.carId || "");
  } else {
    const form = await request.formData();
    token = String(form.get("token") || "");
    decision = String(form.get("decision") || "");
    accepted = String(form.get("accepted") || "") === "yes";
    reason = String(form.get("reason") || "");
    reasonCode = String(form.get("reasonCode") || "");
    explanation = String(form.get("explanation") || "");
    proposedCarId = String(form.get("proposedCarId") || "");
  }

  if (decision === "offer_alternative") {
    const view = await buildConfirmationView(token);
    if (!view.ok) {
      return htmlResponse(
        page({
          title: "Could not record your answer",
          ok: false,
          bodyHtml: `<p style="font-size:0.92rem;color:#455a64;">${esc(view.message)}</p>`,
        }),
        view.status || 400
      );
    }
    const result = await offerAlternativeVehicle({
      orderId: view.booking.bookingId,
      proposedCarId,
      alternative: { reasonForReplacement: reason },
      offeredByEmail: "",
      actor: {
        role: ROLE.ADMIN,
        ownerId: view.booking.ownerId,
        email: "",
        isSuperadmin: false,
      },
    });
    if (!result.ok) {
      return htmlResponse(
        page({
          title: "Could not offer an alternative",
          ok: false,
          bodyHtml: `<p style="font-size:0.92rem;color:#455a64;">${esc(result.message)}</p>`,
        }),
        result.status || 400
      );
    }
    return htmlResponse(
      page({
        title: "Alternative offered",
        bodyHtml: `<p style="font-size:0.92rem;color:#455a64;line-height:1.6;">
          The customer has been sent a replacement-car offer. No hold or payment was created. The original request stays unchanged until they accept.
        </p>`,
      })
    );
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
    reasonCode,
    explanation,
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
