/**
 * Read-only customer booking page model.
 * Friendly labels only. No Mongo id, numeric order number, Stripe id, or enum.
 */

import { absoluteUrl } from "@config/domain";
import { ROVARO_MAILBOX } from "@config/email";
import { isValidPublicBookingReference } from "@/domain/booking/publicBookingReferenceValidate";
import {
  bookingAccessAttemptLimited,
  consumeInvalidBookingAccessAttempt,
  customerBookingAccessRateKey,
  verifyCustomerBookingAccess,
} from "@/domain/booking/customerBookingAccess";
import {
  formatSnapshotMoney,
  resolveBookingFinancialSnapshot,
} from "@/domain/orders/bookingFinancialSnapshot";
import { publicCompanyRentalTermsView } from "@/domain/company/customerRentalTerms";

const STATUS_LABELS = Object.freeze({
  BOOKING_CONFIRMED: "Booking confirmed",
  RENTAL_IN_PROGRESS: "Rental in progress",
  COMPLETION_PENDING: "Awaiting completion",
  COMPLETED: "Completed",
  CUSTOMER_CANCELLED: "Cancelled",
  SUPPLIER_CANCELLED: "Cancelled",
  ADMIN_CANCELLED: "Cancelled",
  SUPPLIER_DECLINED: "Not confirmed",
  PAYMENT_EXPIRED: "Payment link expired",
  PENDING_SUPPLIER_CONFIRMATION: "Waiting for the rental company",
  PAYMENT_PROCESSING: "Waiting for payment",
  CONFIRMED_AWAITING_PAYMENT: "Waiting for payment",
  ALTERNATIVE_PROPOSED: "Replacement offered",
});

export function friendlyBookingStatus(order) {
  const status = String(order?.bookingStatus || "");
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  const paid =
    String(order?.payment?.status || "") === "paid" ||
    String(order?.bookingFeePaymentStatus || "").toUpperCase() === "PAID";
  return paid ? "Booking confirmed" : "Booking update";
}

function whenLabel(local, utc) {
  if (local?.date) return [local.date, local.time].filter(Boolean).join(" ");
  if (!utc) return "—";
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function locationLabel(order, leg) {
  const snapLeg =
    leg === "pickup"
      ? order?.locationSnapshot?.pickup
      : order?.locationSnapshot?.return || order?.locationSnapshot?.dropoff;
  if (snapLeg) {
    const line = [snapLeg.name, snapLeg.address, snapLeg.city].filter(Boolean).join(", ");
    if (line) return line;
  }
  if (leg === "pickup") return order?.placeInDetail || order?.placeIn || "—";
  return order?.placeOutDetail || order?.placeOut || "—";
}

function supplierPhone(company) {
  const direct = String(company?.meetingContactPhone || "").trim();
  if (direct) return direct;
  const first = Array.isArray(company?.meetingContacts)
    ? company.meetingContacts.find((row) => String(row?.phone || "").trim())
    : null;
  return String(first?.phone || "").trim();
}

function feePaid(order) {
  return (
    String(order?.payment?.status || "") === "paid" ||
    String(order?.bookingFeePaymentStatus || "").toUpperCase() === "PAID"
  );
}

export function acceptedTermsLinks(order, locale = "en") {
  const lang = String(locale || "en").split("-")[0] || "en";
  const platform = order?.legalSnapshot?.customerBookingTerms || {};
  const supplier = order?.legalSnapshot?.supplierRentalTerms || {};
  const params = new URLSearchParams();
  if (platform.version) params.set("version", String(platform.version));
  if (platform.checksum) params.set("checksum", String(platform.checksum));
  const qs = params.toString();
  return {
    rovaroTermsHref: absoluteUrl(`/${lang}/terms${qs ? `?${qs}` : ""}`),
    rovaroTermsLabel: "Rovaro Booking Terms",
    supplierTermsLabel: "Rental company terms",
    supplierTermsVersion: supplier.version ? Number(supplier.version) : null,
    supplierTermsChecksum: String(supplier.checksum || ""),
  };
}

/**
 * @returns {object|null}
 */
export function buildPublicBookingView(order, company, { locale = "en", supplierTerms = null } = {}) {
  if (!order || !isValidPublicBookingReference(order.publicReference)) return null;
  const snap = resolveBookingFinancialSnapshot(order);
  const currency = snap.currency || "EUR";
  const paid = feePaid(order);
  const original = String(order?.originalRequestSnapshot?.carModel || "").trim();
  const current = String(order?.carModel || "").trim();
  const replacement = Boolean(original && current && original !== current);
  const terms = acceptedTermsLinks(order, locale);
  const instructions = String(
    order?.locationSnapshot?.pickup?.instructions ||
      order?.locationSnapshot?.pickup?.collectionInstructions ||
      ""
  ).trim();

  return {
    readOnly: true,
    publicReference: order.publicReference,
    statusLabel: friendlyBookingStatus(order),
    vehicleName: current || "Vehicle",
    replacement,
    replacementNote: replacement ? `Accepted replacement for ${original}` : "",
    pickupWhen: whenLabel(order.localPickup, order.pickupAtUtc || order.timeIn),
    returnWhen: whenLabel(order.localReturn, order.returnAtUtc || order.timeOut),
    pickupLocation: locationLabel(order, "pickup"),
    returnLocation: locationLabel(order, "return"),
    total: formatSnapshotMoney(snap.grossMinor, currency),
    bookingFee: formatSnapshotMoney(snap.bookingFeeMinor, currency),
    supplierBalance: formatSnapshotMoney(snap.supplierBalanceMinor, currency),
    supplierName: company?.name || "",
    supplierPhone: paid ? supplierPhone(company) : "",
    supplierEmail: paid ? String(company?.email || "").trim() : "",
    collectionInstructions: instructions,
    rovaroTermsHref: terms.rovaroTermsHref,
    rovaroTermsLabel: terms.rovaroTermsLabel,
    supplierTermsLabel: terms.supplierTermsLabel,
    supplierTermsVersion: terms.supplierTermsVersion,
    supplierTermsBody: supplierTerms?.matched ? supplierTerms.body : "",
    supplierTermsMatched: Boolean(supplierTerms?.matched),
    supportEmail: ROVARO_MAILBOX,
    cancellationNote:
      "To cancel this booking or ask for help, contact Rovaro support and quote your booking reference.",
  };
}

export function supplierTermsForBooking(order, company, locale = "en") {
  const expected = String(order?.legalSnapshot?.supplierRentalTerms?.checksum || "");
  if (!company?.customerRentalTerms) {
    return { matched: false, body: "" };
  }
  const view = publicCompanyRentalTermsView(
    company.customerRentalTerms,
    locale,
    company.name
  );
  const checksum = String(view.checksum || view.sourceHash || "");
  if (!expected || !checksum || checksum !== expected) {
    return { matched: false, body: "" };
  }
  return { matched: true, body: view.body || "" };
}

/**
 * Validate the public reference and opaque token. Invalid, expired, revoked,
 * and rate-limited reads all return null. The raw token is not logged.
 */
export async function loadPublicBookingPage({
  publicReference,
  accessToken,
  ip = "unknown",
  locale = "en",
  now = new Date(),
  findOrder,
  findCompany,
} = {}) {
  const reference = String(publicReference || "").trim();
  const key = customerBookingAccessRateKey(ip, reference);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!isValidPublicBookingReference(reference)) {
    consumeInvalidBookingAccessAttempt(key, { now: nowMs });
    return null;
  }
  if (bookingAccessAttemptLimited(key, { now: nowMs })) return null;

  const order = typeof findOrder === "function" ? await findOrder(reference) : null;
  const accessOk = verifyCustomerBookingAccess(order?.customerBookingAccess, accessToken, {
    now: now instanceof Date ? now : new Date(nowMs),
  });
  if (!order || !accessOk.ok || order.publicReference !== reference) {
    consumeInvalidBookingAccessAttempt(key, { now: nowMs });
    return null;
  }

  const company = typeof findCompany === "function" ? await findCompany(order) : null;
  const supplierTerms = supplierTermsForBooking(order, company, locale);
  return buildPublicBookingView(order, company, { locale, supplierTerms });
}
