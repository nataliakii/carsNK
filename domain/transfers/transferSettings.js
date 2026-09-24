/**
 * Transfer-services settings: defaults, coverage reuse, notify email,
 * and payment-edit gating. Existing saved filters are never wiped.
 */

import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { serviceAreasFromCompany } from "@/domain/geo/coverageNormalization";
import {
  compactServiceAreas,
  emptyServiceAreas,
  normalizeServiceAreasInput,
} from "@/domain/geo/spainAdminDivisions";

export const TRANSFER_ELIGIBILITY_PURPOSE = Object.freeze({
  VISIBILITY: "visibility",
  FULFILLMENT: "fulfillment",
});

export function resolveUseRentalFleet(ts) {
  return ts?.useRentalFleet === true;
}

/** Form default: recommend fleet when the company already has cars. */
export function defaultUseRentalFleetForForm(ts, hasActiveCars) {
  if (ts?.useRentalFleet === true) return true;
  if (ts?.useRentalFleet === false) return false;
  return Boolean(hasActiveCars);
}

export function resolveAcceptAllTransferRequests(ts) {
  return ts?.acceptAllTransferRequests === true;
}

export function resolveTransferCoverageFollowsCompany(ts) {
  if (ts?.transferCoverageFollowsCompany === true) return true;
  if (ts?.transferCoverageFollowsCompany === false) return false;
  const hasOwnArea =
    (Array.isArray(ts?.serviceCities) &&
      ts.serviceCities.some((c) => String(c || "").trim())) ||
    (Array.isArray(ts?.airportsServed) &&
      ts.airportsServed.some((a) => String(a || "").trim()));
  return !hasOwnArea;
}

function uniqueNorm(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function airportsFromCompanyOffices(company) {
  const out = [];
  for (const office of company?.offices || []) {
    if (!office) continue;
    if (String(office.status || "").toLowerCase() === "archived") continue;
    const type = String(office.locationType || "").toLowerCase();
    const name = String(
      office.publicName || office.name || office.city || ""
    ).trim();
    const isAirport = type === "airport" || /airport/i.test(name);
    if (!isAirport) continue;
    if (office.iataCode) out.push(String(office.iataCode).toUpperCase());
    if (name) out.push(name);
  }
  return uniqueNorm(out);
}

export function resolveTransferServiceArea(company) {
  const ts = company?.transferServices || {};
  if (resolveTransferCoverageFollowsCompany(ts)) {
    const coverage = serviceAreasFromCompany(company);
    return {
      serviceCities: normalizeOperatingCities(coverage.cities),
      airportsServed: airportsFromCompanyOffices(company),
      communityCodes: coverage.communityCodes || [],
      provinceCodes: coverage.provinceCodes || [],
      radiusKm: coverage.radiusKm,
    };
  }
  const ownAreas = normalizeServiceAreasInput(ts.serviceAreas);
  const areas = ownAreas.ok ? ownAreas.value : emptyServiceAreas();
  return {
    serviceCities: uniqueNorm(ts.serviceCities),
    airportsServed: uniqueNorm(ts.airportsServed),
    communityCodes: areas.communityCodes,
    provinceCodes: areas.provinceCodes,
    radiusKm: null,
  };
}

export function formatTransferCoverageSummary(area) {
  const parts = [];
  const compacted = compactServiceAreas(area || {});
  if (compacted.communityCodes?.length) {
    parts.push(`${compacted.communityCodes.length} communities`);
  }
  if (compacted.provinceCodes?.length) {
    parts.push(`${compacted.provinceCodes.length} provinces`);
  }
  const cities = uniqueNorm(area?.serviceCities);
  if (cities.length) parts.push(`${cities.length} cities`);
  const airports = uniqueNorm(area?.airportsServed);
  if (airports.length) parts.push(`${airports.length} airports`);
  return parts.join(" · ");
}

export function resolveTransferNotifyEmail(company) {
  const ts = company?.transferServices || {};
  const override = String(ts.transferNotifyEmail || "").trim();
  if (override.includes("@")) return override.toLowerCase();
  const firstContact = (ts.contactEmails || []).find((e) =>
    String(e || "").includes("@")
  );
  if (firstContact) return String(firstContact).trim().toLowerCase();
  const email = String(company?.email || "").trim();
  return email.includes("@") ? email.toLowerCase() : "";
}

export function usesCustomTransferEmail(company) {
  const override = String(
    company?.transferServices?.transferNotifyEmail || ""
  ).trim();
  if (!override.includes("@")) return false;
  const standard = String(company?.email || "")
    .trim()
    .toLowerCase();
  return override.toLowerCase() !== standard;
}

export function canEditTransferPayments(viewMode) {
  return viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN;
}

export function incomingWantsPaymentEdit(incomingTs) {
  return Boolean(
    incomingTs &&
      Object.prototype.hasOwnProperty.call(incomingTs, "payments")
  );
}

export function paymentEditForbiddenResult() {
  return {
    ok: false,
    status: 403,
    message: "Payment configuration is managed by the platform",
  };
}

export function assertCanEditTransferPayments(viewMode, incomingTs) {
  if (!incomingWantsPaymentEdit(incomingTs)) return { ok: true };
  if (canEditTransferPayments(viewMode)) return { ok: true };
  return paymentEditForbiddenResult();
}

const PRESERVED_IF_OMITTED = [
  "vehicleCategories",
  "serviceCities",
  "airportsServed",
  "serviceAreas",
  "maxPassengers",
  "maxStandardLuggage",
  "maxCabinBags",
  "childSeatsAvailable",
  "boosterSeatsAvailable",
  "contactEmails",
  "serviceCountries",
  "serviceZoneIds",
  "accessibilityOptions",
  "operatingHours",
  "blackoutDates",
  "payments",
];

function isOmitted(value) {
  return value === undefined;
}

/**
 * Merge a PATCH into saved transferServices without dropping existing filters
 * or letting a company-mode caller change Stripe flags.
 */
export function mergeTransferServices(existing, incoming, { canEditPayments } = {}) {
  const prev = existing && typeof existing === "object" ? existing : {};
  const nextIn = incoming && typeof incoming === "object" ? incoming : {};
  const merged = { ...prev };

  for (const [key, value] of Object.entries(nextIn)) {
    if (key === "payments" || key === "customerPrices" || key === "pricingRules") {
      continue;
    }
    if (isOmitted(value)) continue;
    merged[key] = value;
  }

  for (const key of PRESERVED_IF_OMITTED) {
    if (key === "payments") continue;
    if (!Object.prototype.hasOwnProperty.call(nextIn, key)) {
      if (Object.prototype.hasOwnProperty.call(prev, key)) {
        merged[key] = prev[key];
      }
    }
  }

  const prevPayments = prev.payments && typeof prev.payments === "object"
    ? prev.payments
    : {};
  if (canEditPayments && incomingWantsPaymentEdit(nextIn)) {
    merged.payments = {
      ...prevPayments,
      ...(nextIn.payments || {}),
    };
  } else {
    merged.payments = prevPayments;
  }

  return merged;
}

export function redactTransferPayments(ts) {
  if (!ts || typeof ts !== "object") return ts || { enabled: false };
  const { payments: _payments, ...rest } = ts;
  return rest;
}

export function normalizeVehicleCategoryCodes(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((s) => s.trim());
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const code = String(raw || "")
      .trim()
      .toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function normalizeStringList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((s) => s.trim());
  return uniqueNorm(list);
}
