import { parseLatLon } from "@/domain/geo/haversineKm";
import {
  isSpainOfficeMarket,
  looksLikeGreecePlace,
  looksLikeSpainPlace,
  normalizeCarOfficeEntry,
  normalizeCarOffices,
} from "@/domain/orders/carOffices";

const DEFAULT_OFFICE_NAME = "Office";

function coordsFromOffice(office) {
  if (!office) return null;
  const lat = String(office.lat ?? "").trim();
  const lon = String(office.lon ?? office.lng ?? "").trim();
  if (!lat || !lon) return null;
  return parseLatLon({ lat, lon });
}

/**
 * Company-level pickup/return offices: `{ name, address, lat, lon }`.
 * Accepts `lng` as an alias for `lon`. Empty address is allowed until typed.
 */
export function normalizeCompanyOfficeEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return normalizeCarOfficeEntry(raw);
  }
  if (typeof raw !== "object") return null;
  return normalizeCarOfficeEntry({
    ...raw,
    name:
      String(raw.name || raw.label || raw.value || "").trim() ||
      DEFAULT_OFFICE_NAME,
  });
}

export function normalizeCompanyOffices(offices) {
  const list = Array.isArray(offices) ? offices : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeCompanyOfficeEntry(raw);
    if (!entry) continue;
    const key = `${entry.name}\0${entry.address}\0${entry.lat}\0${entry.lon}`
      .trim()
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function emptyCompanyOffice() {
  return { name: DEFAULT_OFFICE_NAME, address: "", lat: "", lon: "" };
}

export function primaryOfficePoint(offices) {
  for (const office of normalizeCompanyOffices(offices)) {
    const point = coordsFromOffice(office);
    if (point) {
      return {
        ...point,
        name: office.name,
        address: office.address,
      };
    }
  }
  return null;
}

function companyContactPlace(company) {
  const loc = Array.isArray(company?.locations) ? company.locations[0] : null;
  return {
    name: String(loc?.name || company?.name || "").trim(),
    address: String(company?.address || "").trim(),
    lat: String(company?.coords?.lat || loc?.coords?.lat || "").trim(),
    lon: String(
      company?.coords?.lon ||
        company?.coords?.lng ||
        loc?.coords?.lon ||
        loc?.lon ||
        ""
    ).trim(),
  };
}

/**
 * Offices for the admin editor. Stored `company.offices` win.
 * Legacy companies with only coords get one row — address stays empty
 * until someone types a street (never invent a legal address).
 */
export function resolveCompanyOffices(company) {
  const stored = normalizeCompanyOffices(company?.offices);
  if (stored.length) return stored;

  const spain = isSpainOfficeMarket(undefined, company);
  const contact = companyContactPlace(company);
  let address = contact.address;
  let lat = contact.lat;
  let lon = contact.lon;
  let name = contact.name;

  if (spain) {
    if (looksLikeGreecePlace({ address })) address = "";
    if (looksLikeGreecePlace({ lat, lon })) {
      lat = "";
      lon = "";
    }
    if (looksLikeGreecePlace({ name }) && !looksLikeSpainPlace({ name })) {
      name = "";
    }
  }

  const companyLabel = String(company?.name || "").trim();
  if (
    !name &&
    companyLabel &&
    !(spain && looksLikeGreecePlace({ name: companyLabel }))
  ) {
    name = companyLabel;
  }

  if (!name && !address && !lat && !lon) {
    return [emptyCompanyOffice()];
  }
  return [
    {
      name: name || DEFAULT_OFFICE_NAME,
      address: "",
      lat,
      lon,
    },
  ];
}

export function companyOfficesForBooking(company) {
  return normalizeCompanyOffices(company?.offices);
}

export function officeHasStreet(office) {
  return Boolean(String(office?.address || "").trim());
}

export function officeOrigins(offices, fallbackCoords) {
  const origins = [];
  for (const office of normalizeCompanyOffices(offices)) {
    const point = coordsFromOffice(office);
    if (point) origins.push(point);
  }
  if (!origins.length) {
    const fallback = parseLatLon(fallbackCoords);
    if (fallback) origins.push(fallback);
  }
  return origins;
}

/** Persist shape: `{ name, address, lat, lon }` — lng accepted on input. */
export function companyOfficesPatchValue(rawOffices) {
  return normalizeCompanyOffices(rawOffices).map((office) => ({
    name: office.name,
    address: office.address,
    lat: office.lat,
    lon: office.lon,
  }));
}

export { normalizeCarOffices };
