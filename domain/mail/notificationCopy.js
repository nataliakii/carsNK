/**
 * Subjects + HTML/text bodies for platform notification matrix events.
 * Escapes all user-generated values in HTML. No secrets / signed URLs.
 */

import { absoluteUrl } from "@config/domain";
import { renderAdminOrderNotificationEmail } from "@/app/ui/email/renderEmail";
import { buildSupplierNewBookingEmail } from "@/domain/mail/supplierNewBookingEmail";
import {
  NOTIFICATION_EVENT,
} from "@/domain/mail/notificationEvents";
import {
  COMPANY_DECLINE_CONFIRMATION_DISCLAIMER,
  partnerDeclineReasonLabel,
} from "@/domain/mail/partnerDeclinePolicy";

function line(label, value) {
  return `${label}: ${value == null || value === "" ? "—" : value}`;
}

function firstName(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) return "";
  return raw.split(/\s+/)[0];
}

function moneyMinor(minor, currency = "EUR") {
  const amount = (Number(minor) || 0) / 100;
  return `${String(currency || "EUR").toUpperCase()} ${amount.toFixed(2)}`;
}

function formatTs(value) {
  if (!value) return new Date().toISOString();
  try {
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
}

function companyLegalUrl(companyId) {
  return absoluteUrl(
    `/admin/partners?tab=legal&companyId=${encodeURIComponent(String(companyId || ""))}`
  );
}

function companyRecordUrl(companyId) {
  return absoluteUrl(
    `/admin/partners?tab=overview&companyId=${encodeURIComponent(String(companyId || ""))}`
  );
}

function companySetupUrl(companyId) {
  return absoluteUrl(
    `/admin/company?companyId=${encodeURIComponent(String(companyId || ""))}`
  );
}

function bookingAdminUrl(orderId) {
  return absoluteUrl(
    `/admin/orders?orderId=${encodeURIComponent(String(orderId || ""))}`
  );
}

function calendarDeepLink(orderId) {
  return absoluteUrl(
    `/admin?view=orders-big-calendar&orderId=${encodeURIComponent(String(orderId || ""))}`
  );
}

/**
 * @param {string} eventType
 * @param {"company"|"superadmin"} audience
 * @param {object} ctx
 * @returns {{ subject: string, text: string, html: string } | null}
 */
export function buildNotificationContent(eventType, audience, ctx = {}) {
  const companyName = String(ctx.companyName || "Company");
  const orderNumber = String(ctx.orderNumber || ctx.orderId || "");

  switch (eventType) {
    case NOTIFICATION_EVENT.COMPANY_CREATED: {
      if (audience === "company") {
        const subject = "Welcome to Rovaro — complete your company setup";
        const lines = [
          `Welcome to Rovaro.`,
          "",
          line("Company", companyName),
          "",
          "Complete your company setup in three simple steps:",
          "1. Accept the Partner Agreement",
          "2. Add your company rental terms (or use Rovaro standard terms)",
          "3. Publish at least one active car",
          "",
          `Open company setup: ${companySetupUrl(ctx.companyId)}`,
        ];
        return wrap(subject, lines);
      }
      const subject = `New company created: ${companyName}`;
      const lines = [
        line("Company", companyName),
        line("Country", ctx.country || ""),
        line("Creator email", ctx.creatorEmail || ""),
        line("Created at", formatTs(ctx.createdAt)),
        "",
        `Company record: ${companyRecordUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.AGREEMENT_ACCEPTED: {
      if (audience !== "superadmin") return null;
      const subject = `${companyName} accepted the Partner Agreement`;
      const lines = [
        line("Company", companyName),
        line("Action", "Partner Agreement accepted"),
        line("Actor", ctx.actorEmail || ctx.actorName || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        line("Previous status", ctx.previousStatus || "—"),
        line("New version / checksum", ctx.newVersion || ctx.packageChecksum || "—"),
        "",
        `Legal tab: ${companyLegalUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.RENTAL_TERMS_UPDATED: {
      if (audience !== "superadmin") return null;
      const subject = `${companyName} updated its rental terms`;
      const lines = [
        line("Company", companyName),
        line("Action", "Company rental terms uploaded/replaced"),
        line("Actor", ctx.actorEmail || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        line("Previous hash", ctx.previousHash || "—"),
        line("New hash", ctx.newHash || "—"),
        "",
        `Legal tab: ${companyLegalUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.RENTAL_TERMS_REMOVED: {
      if (audience !== "superadmin") return null;
      const subject = `${companyName} returned to Rovaro standard rental terms`;
      const lines = [
        line("Company", companyName),
        line("Action", "Company rental terms removed"),
        line("Actor", ctx.actorEmail || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        line("Previous hash", ctx.previousHash || "—"),
        "",
        `Legal tab: ${companyLegalUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.IMPORTANT_SETTINGS_CHANGED: {
      if (audience !== "superadmin") return null;
      const subject = `Important company update: ${companyName}`;
      const changeLines = (ctx.changes || []).map(
        (c) => `- ${c.label || c.field}: ${c.previous} → ${c.next}`
      );
      const lines = [
        line("Company", companyName),
        line("Changed by", ctx.actorEmail || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        "",
        "Changes:",
        ...(changeLines.length ? changeLines : ["(see admin)"]),
        "",
        `Review: ${companyRecordUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.CAR_ADDED: {
      if (audience !== "superadmin") return null;
      const subject = `Important company update: ${companyName}`;
      const lines = [
        line("Company", companyName),
        line("Action", "Car added"),
        line("Car", [ctx.carModel, ctx.regNumber].filter(Boolean).join(" ") || ctx.carId),
        line("Changed by", ctx.actorEmail || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        "",
        `Review: ${companyRecordUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.CAR_DELETED:
    case NOTIFICATION_EVENT.CAR_DEACTIVATED: {
      if (audience !== "superadmin") return null;
      const subject = `Important company update: ${companyName}`;
      const action =
        eventType === NOTIFICATION_EVENT.CAR_DELETED
          ? "Car deleted"
          : "Car deactivated";
      const lines = [
        line("Company", companyName),
        line("Action", action),
        line("Car", [ctx.carModel, ctx.regNumber].filter(Boolean).join(" ") || ctx.carId),
        line("Changed by", ctx.actorEmail || ""),
        line("Timestamp", formatTs(ctx.timestamp)),
        "",
        `Review: ${companyRecordUrl(ctx.companyId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.BOOKING_REQUESTED: {
      if (audience === "company") {
        return buildSupplierNewBookingEmail(ctx);
      }
      const subject = `New booking request: ${orderNumber} — ${companyName}`;
      const lines = [
        line("Company", companyName),
        line("Booking", orderNumber),
        line("Car", ctx.carModel || ""),
        line("Pickup", ctx.pickup || ""),
        line("Return", ctx.return || ""),
        ctx.numberOfDays != null ? `🗓 Days: ${ctx.numberOfDays}` : null,
        line("Customer", ctx.customerName || ""),
        line("Phone", ctx.phone || ""),
        line("Email", ctx.email || ""),
        line("Total", ctx.totalFormatted || ""),
        line("Booking fee", ctx.feeFormatted || ""),
        line("Remaining to company", ctx.remainingFormatted || ""),
        "",
        `Open: ${bookingAdminUrl(ctx.orderId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.BOOKING_ACCEPTED: {
      if (audience !== "superadmin") return null;
      const subject = `Booking accepted by ${companyName}: ${orderNumber}`;
      const lines = [
        line("Company", companyName),
        line("Booking", orderNumber),
        line("Actor", ctx.actorEmail || ""),
        line("Status", ctx.status || "accepted"),
        line("Timestamp", formatTs(ctx.timestamp)),
        "",
        `Open: ${bookingAdminUrl(ctx.orderId)}`,
      ];
      return wrap(subject, lines);
    }

    case NOTIFICATION_EVENT.BOOKING_FEE_PAID:
      // Paid mail uses CUSTOMER_BOOKING_CONFIRMED, SUPPLIER_BOOKING_PAID,
      // and SUPERADMIN_BOOKING_PAYMENT_RECEIVED. This matrix must not send
      // the technical admin template to any audience.
      return null;

    case NOTIFICATION_EVENT.BOOKING_DECLINED: {
      const reasonLabel =
        partnerDeclineReasonLabel(ctx.reasonCode) || ctx.reasonLabel || ctx.reason || "";
      if (audience === "company") {
        const subject = `Booking declined: ${orderNumber}`;
        const lines = [
          "Your decline has been recorded.",
          "",
          line("Booking", orderNumber),
          line("Reason", reasonLabel),
          ctx.explanation ? line("Explanation", ctx.explanation) : null,
          line("Time", formatTs(ctx.timestamp)),
          line("Status", ctx.status || "declined"),
          "",
          COMPANY_DECLINE_CONFIRMATION_DISCLAIMER,
        ].filter((l) => l != null);
        return wrap(subject, lines);
      }
      const subject = `Decision required — company declined booking ${orderNumber}`;
      const lines = [
        line("Company", companyName),
        line("Booking", orderNumber),
        line("Customer", ctx.customerName || ""),
        line("Fee paid", ctx.feePaid ? "yes" : "no"),
        line("Fee amount", ctx.feeFormatted || "—"),
        line("Reason", reasonLabel),
        ctx.explanation ? line("Explanation", ctx.explanation) : null,
        line("Timeline", formatTs(ctx.timestamp)),
        line(
          "Alternative available",
          ctx.alternativeAvailable === true
            ? "yes"
            : ctx.alternativeAvailable === false
              ? "no"
              : "unknown"
        ),
        line("Platform recommendation (display only)", ctx.recommendationLabel || "—"),
        "",
        "This is not a final refund decision. Do not auto-refund.",
        "",
        `Decision screen: ${bookingAdminUrl(ctx.orderId)}`,
      ].filter((l) => l != null);
      return wrap(subject, lines);
    }

    default:
      return null;
  }
}

function wrap(subject, lines) {
  const text = lines.join("\n");
  const html = renderAdminOrderNotificationEmail(subject, text);
  return { subject, text, html };
}

export {
  calendarDeepLink,
  bookingAdminUrl,
  companyLegalUrl,
  moneyMinor,
  firstName,
};
