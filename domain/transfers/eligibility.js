import Company from "@models/company";
import { locationDisplayName } from "@/domain/transfers/locationSnapshot";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function servesPlace(ts, location, country) {
  if (!ts) return false;
  const countries = (ts.serviceCountries || []).map((c) =>
    String(c).toUpperCase()
  );
  if (countries.length && !countries.includes(String(country || "").toUpperCase())) {
    return false;
  }

  const cities = (ts.serviceCities || []).map(normalize);
  const city = normalize(location?.city);
  const name = normalize(locationDisplayName(location));
  if (cities.length) {
    const cityOk =
      (city && cities.includes(city)) ||
      (name && cities.some((c) => name.includes(c) || c.includes(name)));
    if (!cityOk) {
      // still allow if airport is listed
      const iata = String(location?.iataCode || "").toUpperCase();
      const airports = (ts.airportsServed || []).map((a) =>
        String(a).toUpperCase()
      );
      if (!iata || !airports.includes(iata)) {
        if (location?.locationType === "airport") {
          const airportNames = airports.map(normalize);
          if (!airportNames.some((a) => name.includes(a) || a.includes(name))) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
  }

  if (location?.locationType === "airport" || location?.iataCode) {
    const airports = (ts.airportsServed || []).map((a) =>
      String(a).toUpperCase()
    );
    if (airports.length) {
      const iata = String(location?.iataCode || "").toUpperCase();
      const nameOk = airports.some((a) =>
        normalize(a).includes(name) || name.includes(normalize(a))
      );
      if (iata && !airports.includes(iata) && !nameOk) return false;
    }
  }

  return true;
}

function withinOperatingHours(ts, datetime) {
  const hours = ts?.operatingHours;
  if (!hours?.start || !hours?.end) return true;
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return true;
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  const parse = (v) => {
    const m = String(v).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const start = parse(hours.start);
  const end = parse(hours.end);
  if (start == null || end == null) return true;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

function notBlackedOut(ts, datetime) {
  const dates = ts?.blackoutDates || [];
  if (!dates.length) return true;
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return true;
  const key = d.toISOString().slice(0, 10);
  return !dates.includes(key);
}

function meetsNotice(ts, datetime) {
  const minH = Number(ts?.minimumNoticeHours);
  if (!Number.isFinite(minH) || minH <= 0) return true;
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return true;
  const hours = (d.getTime() - Date.now()) / (60 * 60 * 1000);
  if (hours < minH && !ts.acceptUrgentRequests) return false;
  return true;
}

/**
 * Check whether a company can fulfil a transfer request.
 */
export function isCompanyEligibleForTransfer(company, transfer) {
  const reasons = [];
  const ts = company?.transferServices;

  if (!ts?.enabled) reasons.push("transfer_services_disabled");
  if (ts?.suspended) reasons.push("suspended");
  if (ts?.blockedByAdmin) reasons.push("blocked");
  if (!ts?.supplierAgreementAcceptedAt) {
    reasons.push("supplier_agreement_required");
  }

  const country = String(transfer.country || company?.country || "").toUpperCase();
  if (
    String(company?.country || "").toUpperCase() &&
    String(company.country).toUpperCase() !== country &&
    !(ts?.serviceCountries || []).map((c) => String(c).toUpperCase()).includes(country)
  ) {
    reasons.push("country_mismatch");
  }

  const origin = transfer.origin || {
    placeName: transfer.from,
    city: transfer.from,
    country,
  };
  const destination = transfer.destination || {
    placeName: transfer.to,
    city: transfer.to,
    country,
  };

  if (!servesPlace(ts, origin, country)) reasons.push("pickup_area");
  if (!servesPlace(ts, destination, country)) reasons.push("destination_area");

  const category = String(transfer.vehicleCategory || "STANDARD").toUpperCase();
  const cats = (ts?.vehicleCategories || []).map((c) => String(c).toUpperCase());
  if (cats.length && !cats.includes(category) && !cats.includes("*")) {
    reasons.push("vehicle_category");
  }

  const pax = Number(transfer.passengers || transfer.adults || 0);
  if (ts?.maxPassengers != null && pax > Number(ts.maxPassengers)) {
    reasons.push("passenger_capacity");
  }
  if (
    ts?.maxStandardLuggage != null &&
    Number(transfer.standardSuitcases || 0) > Number(ts.maxStandardLuggage)
  ) {
    reasons.push("luggage_capacity");
  }
  if (
    ts?.maxCabinBags != null &&
    Number(transfer.cabinBags || 0) > Number(ts.maxCabinBags)
  ) {
    reasons.push("cabin_bags_capacity");
  }
  if (
    Number(transfer.childSeats || 0) > Number(ts?.childSeatsAvailable || 0)
  ) {
    reasons.push("child_seats");
  }
  if (
    Number(transfer.boosterSeats || 0) > Number(ts?.boosterSeatsAvailable || 0)
  ) {
    reasons.push("booster_seats");
  }

  const access = String(transfer.accessibilityRequirements || "").toLowerCase();
  if (access && !(ts?.accessibilityOptions || []).length) {
    if (/wheelchair|accessible/.test(access)) {
      reasons.push("accessibility");
    }
  }

  if (
    ts?.maxOperatingDistanceKm != null &&
    transfer.distanceKm != null &&
    Number(transfer.distanceKm) > Number(ts.maxOperatingDistanceKm)
  ) {
    reasons.push("max_distance");
  }

  if (!withinOperatingHours(ts, transfer.datetime)) {
    reasons.push("operating_hours");
  }
  if (!notBlackedOut(ts, transfer.datetime)) {
    reasons.push("blackout");
  }
  if (!meetsNotice(ts, transfer.datetime)) {
    reasons.push("minimum_notice");
  }

  if (!company?.email && !(ts?.contactEmails || []).length) {
    reasons.push("no_contact_email");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    companyId: company?._id ? String(company._id) : null,
  };
}

/**
 * Find eligible transfer companies for a transfer request.
 * @param {object} transfer
 * @param {{ excludeCompanyIds?: string[] }} [opts]
 */
export async function findEligibleTransferCompanies(transfer, opts = {}) {
  const country = String(transfer.country || "").toUpperCase();
  const excluded = new Set(
    (opts.excludeCompanyIds || transfer.excludedSupplierIds || []).map(String)
  );

  const companies = await Company.find({
    country,
    "transferServices.enabled": true,
    "transferServices.suspended": { $ne: true },
    "transferServices.blockedByAdmin": { $ne: true },
  })
    .select("name email country transferServices")
    .lean();

  // Fallback during migration: if no company has transferServices.enabled,
  // do not silently notify everyone — return empty (admin must enable).
  const eligible = [];
  for (const company of companies) {
    if (excluded.has(String(company._id))) continue;
    const check = isCompanyEligibleForTransfer(company, transfer);
    if (check.ok) {
      eligible.push({ company, check });
    }
  }
  return eligible;
}

/**
 * Legacy-compatible: companies that can receive offer emails.
 * Prefer findEligibleTransferCompanies; this helper also returns contact emails.
 */
export function partnerNotifyEmails(company) {
  const ts = company?.transferServices;
  const list = [];
  for (const e of ts?.contactEmails || []) {
    if (e && String(e).includes("@")) list.push(String(e).trim().toLowerCase());
  }
  if (company?.email && String(company.email).includes("@")) {
    list.push(String(company.email).trim().toLowerCase());
  }
  return [...new Set(list)];
}
