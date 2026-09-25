import { parseLatLon } from "@/domain/geo/haversineKm";
import {
  isSpainOfficeMarket,
  looksLikeGreecePlace,
  looksLikeSpainPlace,
  normalizeCarOfficeEntry,
  normalizeCarOffices,
} from "@/domain/orders/carOffices";
import { persistOfficeShape } from "@/domain/company/officeRecord";

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
  const base = normalizeCarOfficeEntry({
    ...raw,
    name:
      String(raw.name || raw.label || raw.value || "").trim() ||
      DEFAULT_OFFICE_NAME,
  });
  if (!base) return null;
  const extra = {};
  if (raw._id) extra._id = raw._id;
  if (raw.id) extra.id = raw.id;
  if (raw.clientId) extra.clientId = raw.clientId;
  if (raw.publicName) extra.publicName = raw.publicName;
  if (raw.city) extra.city = raw.city;
  if (raw.country) extra.country = raw.country;
  if (raw.placeId) extra.placeId = raw.placeId;
  if (raw.locationType) extra.locationType = raw.locationType;
  if (raw.collectionInstructions) extra.collectionInstructions = raw.collectionInstructions;
  if (raw.returnInstructions) extra.returnInstructions = raw.returnInstructions;
  if (raw.status) extra.status = raw.status;
  if (raw.active != null) extra.active = raw.active;
  if (raw.openingHours && typeof raw.openingHours === "object") {
    extra.openingHours = {
      start: raw.openingHours.start || "",
      end: raw.openingHours.end || "",
    };
  }
  if (raw.freePickup != null) extra.freePickup = raw.freePickup;
  if (raw.freeReturn != null) extra.freeReturn = raw.freeReturn;
  return { ...base, ...extra };
}

export function normalizeCompanyOffices(offices) {
  const list = Array.isArray(offices) ? offices : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeCompanyOfficeEntry(raw);
    if (!entry) continue;
    const identity = getOfficeKey(entry);
    const key = identity
      ? `id:${identity}`
      : `${entry.name}\0${entry.address}\0${entry.lat}\0${entry.lon}`
          .trim()
          .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function newClientOfficeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `office_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable React/form key: saved offices use the database id; drafts use clientId. */
export function getOfficeKey(office) {
  return String(office?._id || office?.id || office?.clientId || "").trim();
}

/**
 * Fresh default office. Always a new object — never reuse a module-level
 * DEFAULT_OFFICE reference.
 */
export function createDefaultOffice() {
  return {
    name: DEFAULT_OFFICE_NAME,
    address: "",
    city: "",
    country: "",
    placeId: "",
    lat: "",
    lon: "",
    locationType: "office",
    collectionInstructions: "",
    returnInstructions: "",
    openingHours: { start: "", end: "" },
    status: "active",
    clientId: newClientOfficeId(),
  };
}

export function emptyCompanyOffice() {
  return createDefaultOffice();
}

function cloneOfficeRecord(office) {
  if (!office || typeof office !== "object") return createDefaultOffice();
  return {
    ...office,
    openingHours: {
      start: office.openingHours?.start || "",
      end: office.openingHours?.end || "",
    },
    carIds: Array.isArray(office.carIds) ? [...office.carIds] : office.carIds,
  };
}

/** Assign a clientId once to unsaved rows so cards never share identity. */
export function ensureOfficeIdentity(office) {
  const clone = cloneOfficeRecord(office);
  if (!getOfficeKey(clone)) {
    clone.clientId = newClientOfficeId();
  }
  return clone;
}

export function ensureOfficeIdentities(offices) {
  if (!Array.isArray(offices) || !offices.length) return [];
  return offices.map((row) => ensureOfficeIdentity(row));
}

export function updateOfficeByKey(offices, officeId, changes) {
  const id = String(officeId || "").trim();
  return (Array.isArray(offices) ? offices : []).map((office) => {
    if (getOfficeKey(office) !== id) return office;
    const next = cloneOfficeRecord(office);
    for (const [key, value] of Object.entries(changes || {})) {
      if (Array.isArray(value)) {
        next[key] = [...value];
      } else if (value && typeof value === "object") {
        next[key] = { ...(office[key] || {}), ...value };
      } else {
        next[key] = value;
      }
    }
    return next;
  });
}

export function removeOfficeByKey(offices, officeId) {
  const id = String(officeId || "").trim();
  const next = (Array.isArray(offices) ? offices : []).filter(
    (office) => getOfficeKey(office) !== id
  );
  return next.length ? next : [createDefaultOffice()];
}

export function addOfficeToList(offices) {
  return [...(Array.isArray(offices) ? offices : []), createDefaultOffice()];
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
  const stored = ensureOfficeIdentities(normalizeCompanyOffices(company?.offices));
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
    return [createDefaultOffice()];
  }
  return [
    ensureOfficeIdentity({
      name: name || DEFAULT_OFFICE_NAME,
      address: "",
      lat,
      lon,
    }),
  ];
}

export function companyOfficesForBooking(company) {
  return normalizeCompanyOffices(company?.offices);
}

/**
 * Default pickup/return place for offline / admin stubs:
 * office city → office name → company.locations[0] → "".
 * Never invents a Greece market default (e.g. Nea Kallikratia).
 */
export function resolveCompanyDefaultPlaceName(company) {
  if (!company || typeof company !== "object") return "";

  const offices = resolveCompanyOffices(company);
  const companyLabel = String(company.name || "").trim().toLowerCase();

  for (const office of offices) {
    const city = String(office?.city || "").trim();
    if (city) return city;
    const name = String(office?.publicName || office?.name || "").trim();
    if (!name) continue;
    if (name.toLowerCase() === "office") continue;
    if (companyLabel && name.toLowerCase() === companyLabel) continue;
    return name;
  }

  const loc = Array.isArray(company.locations) ? company.locations[0] : null;
  const locName = String(loc?.name || "").trim();
  if (locName) return locName;

  return "";
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

/** Persist shape — keeps `_id` and new office fields when present. */
export function companyOfficesPatchValue(rawOffices) {
  const list = Array.isArray(rawOffices) ? rawOffices : [];
  return list
    .map((office) => persistOfficeShape(office, { assignId: !office?._id && !office?.id }))
    .filter(Boolean);
}

/**
 * Superadmin whole-array patch helper: keep existing `_id`s when the client
 * sends the same office (by id or stable name), assign ids only to new rows.
 */
export function mergeOfficesPreservingIds(existingOffices, incomingOffices) {
  const existing = Array.isArray(existingOffices) ? existingOffices : [];
  const byId = new Map(
    existing
      .filter((row) => row && (row._id || row.id))
      .map((row) => [String(row._id || row.id), row])
  );
  const list = Array.isArray(incomingOffices) ? incomingOffices : [];
  return list
    .map((raw) => {
      const id = String(raw?._id || raw?.id || "").trim();
      const prior = id && byId.has(id) ? byId.get(id) : null;
      return persistOfficeShape(
        prior ? { ...prior, ...raw, _id: prior._id } : raw,
        { assignId: !prior }
      );
    })
    .filter(Boolean);
}

export { normalizeCarOffices };
