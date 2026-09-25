/**
 * Supplier new-booking notification.
 * One canonical admin URL. No confirm-by-email token and no customer identity.
 */

import { absoluteUrl } from "@config/domain";
import { renderSupplierNewBookingEmailHtml } from "@/app/ui/email/templates/supplierNewBookingRequest";

export const SUPPLIER_NEW_BOOKING_HEADING = "New booking request";
export const SUPPLIER_NEW_BOOKING_INTRO =
  "Please confirm whether you can provide this vehicle.";
export const SUPPLIER_NEW_BOOKING_CTA = "Review booking request";
export const SUPPLIER_NEW_BOOKING_NOTICE =
  "Customer contact details and driving documents will become available after the Rovaro Booking Fee is paid.";
export const SUPPLIER_NEW_BOOKING_PROMPT = "Please respond as soon as possible.";

export function supplierBookingReviewPath(orderId) {
  const id = String(orderId || "").trim();
  return `/admin/orders?orderId=${encodeURIComponent(id)}`;
}

export function supplierBookingReviewUrl(orderId) {
  return absoluteUrl(supplierBookingReviewPath(orderId));
}

export function stripEmailUrls(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Office or city name only. Street lines and map URLs stay out of the email. */
export function supplierEmailLocationName(leg, fallback = "") {
  if (leg && typeof leg === "object") {
    const named = [leg.name, leg.city].filter(Boolean).join(", ");
    if (named) return stripEmailUrls(named);
  }
  return stripEmailUrls(fallback)
    .replace(/\s*·\s*€\d[\d.,]*\s*$/g, "")
    .replace(/^(Office|Delivery)\s+(pickup|return):\s*/i, "")
    .trim();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function zonedParts(value, timeZone) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  let zone = timeZone || "UTC";
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const monthIndex = Number(parts.month) - 1;
  if (!parts.day || !parts.year || monthIndex < 0 || monthIndex > 11) return null;
  return {
    ...parts,
    month: MONTHS[monthIndex],
    hour: String(parts.hour || "").padStart(2, "0"),
    minute: String(parts.minute || "").padStart(2, "0"),
  };
}

export function formatSupplierEmailWhen(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  if (!parts) return "";
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function formatSupplierShortDateRange(start, end, timeZone) {
  const a = zonedParts(start, timeZone);
  const b = zonedParts(end, timeZone);
  if (!a && !b) return "";
  if (a && !b) return `${a.day} ${a.month} ${a.year}`;
  if (!a && b) return `${b.day} ${b.month} ${b.year}`;
  if (a.year === b.year && a.month === b.month && a.day === b.day) {
    return `${a.day} ${a.month} ${a.year}`;
  }
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${a.month} ${a.year}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${a.month} – ${b.day} ${b.month} ${a.year}`;
  }
  return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
}

function row(label, value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return [label, text];
}

/**
 * @param {object} ctx
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildSupplierNewBookingEmail(ctx = {}) {
  const vehicle = String(ctx.carModel || ctx.vehicleName || "Vehicle").trim() || "Vehicle";
  const timeZone = ctx.timezone || "UTC";
  const pickupAt = ctx.pickupAt || ctx.rentalStartDate || "";
  const returnAt = ctx.returnAt || ctx.rentalEndDate || "";
  const range = formatSupplierShortDateRange(pickupAt, returnAt, timeZone);
  const subject = range
    ? `New booking request — ${vehicle}, ${range}`
    : `New booking request — ${vehicle}`;
  const orderId = String(ctx.orderId || "").trim();
  const reviewUrl = supplierBookingReviewUrl(orderId);
  const orderNumber = String(ctx.orderNumber || "").trim();
  const rows = [
    row("Vehicle", vehicle),
    row("Pickup", formatSupplierEmailWhen(pickupAt, timeZone)),
    row("Return", formatSupplierEmailWhen(returnAt, timeZone)),
    row(
      "Pickup location",
      supplierEmailLocationName(ctx.pickupLeg, ctx.pickupLocation || "")
    ),
    row(
      "Return location",
      supplierEmailLocationName(ctx.returnLeg, ctx.returnLocation || "")
    ),
    row("Total rental price", ctx.totalFormatted),
    row("You collect from the customer", ctx.remainingFormatted),
  ].filter(Boolean);

  const lines = [
    SUPPLIER_NEW_BOOKING_HEADING,
    "",
    SUPPLIER_NEW_BOOKING_INTRO,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    SUPPLIER_NEW_BOOKING_NOTICE,
    "",
    `${SUPPLIER_NEW_BOOKING_CTA}: ${reviewUrl}`,
    "",
    SUPPLIER_NEW_BOOKING_PROMPT,
    "",
    orderNumber ? `Booking #${orderNumber}` : "",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  const text = lines.join("\n").trim() + "\n";
  const html = renderSupplierNewBookingEmailHtml({
    heading: SUPPLIER_NEW_BOOKING_HEADING,
    intro: SUPPLIER_NEW_BOOKING_INTRO,
    rows,
    notice: SUPPLIER_NEW_BOOKING_NOTICE,
    ctaLabel: SUPPLIER_NEW_BOOKING_CTA,
    ctaHref: reviewUrl,
    prompt: SUPPLIER_NEW_BOOKING_PROMPT,
    orderNumber,
  });

  return { subject, text, html };
}
