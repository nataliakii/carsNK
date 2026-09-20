import { resolveDeliveryZoneName } from "@/domain/delivery/resolveDeliveryZoneName";

/**
 * Per-car office locations: booking place names (optionally with street address)
 * where pickup/return delivery fee is free (€0) for that car.
 *
 * Accepted shapes:
 * - "Nea Kallikratia"
 * - { name: "Barcelona", address: "Calle X 1", lat?, lon? }
 */

export function normalizeOfficeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown} raw
 * @returns {{ name: string, address: string, lat: string, lon: string } | null}
 */
export function normalizeCarOfficeEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return { name, address: "", lat: "", lon: "" };
  }
  if (typeof raw !== "object") return null;
  const name = String(raw.name || raw.label || raw.value || "").trim();
  if (!name) return null;
  return {
    name,
    address: String(raw.address || "").trim(),
    lat: raw.lat != null && raw.lat !== "" ? String(raw.lat).trim() : "",
    lon:
      raw.lon != null && raw.lon !== ""
        ? String(raw.lon).trim()
        : raw.lng != null && raw.lng !== ""
          ? String(raw.lng).trim()
          : "",
  };
}

/**
 * @param {unknown} offices
 * @returns {{ name: string, address: string, lat: string, lon: string }[]}
 */
export function normalizeCarOffices(offices) {
  const list = Array.isArray(offices) ? offices : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeCarOfficeEntry(raw);
    if (!entry) continue;
    const key = normalizeOfficeKey(entry.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function collectOfficeMatchKeys(offices) {
  const keys = new Set();
  for (const office of normalizeCarOffices(offices)) {
    keys.add(normalizeOfficeKey(office.name));
    const resolved = resolveDeliveryZoneName(office.name);
    if (resolved) keys.add(normalizeOfficeKey(resolved));
  }
  return keys;
}

/**
 * True when the selected pickup/return place matches a car office
 * (case-insensitive; includes delivery-zone aliases e.g. Airport).
 */
export function isPlaceMatchingCarOffice(place, offices) {
  const placeRaw = String(place || "").trim();
  if (!placeRaw) return false;
  const officeKeys = collectOfficeMatchKeys(offices);
  if (!officeKeys.size) return false;

  const placeKey = normalizeOfficeKey(placeRaw);
  if (officeKeys.has(placeKey)) return true;

  const resolvedPlace = resolveDeliveryZoneName(placeRaw);
  if (resolvedPlace && officeKeys.has(normalizeOfficeKey(resolvedPlace))) {
    return true;
  }
  return false;
}

/**
 * Find the office entry matching a place name.
 */
export function findCarOfficeForPlace(place, offices) {
  const placeRaw = String(place || "").trim();
  if (!placeRaw) return null;
  const placeKey = normalizeOfficeKey(placeRaw);
  const resolvedKey = normalizeOfficeKey(resolveDeliveryZoneName(placeRaw));
  for (const office of normalizeCarOffices(offices)) {
    const nameKey = normalizeOfficeKey(office.name);
    const officeResolved = normalizeOfficeKey(
      resolveDeliveryZoneName(office.name)
    );
    if (
      nameKey === placeKey ||
      nameKey === resolvedKey ||
      officeResolved === placeKey ||
      (resolvedKey && officeResolved === resolvedKey)
    ) {
      return office;
    }
  }
  return null;
}

/**
 * Enrich office with company.address when office has no street address.
 */
export function enrichOfficeWithCompany(office, company) {
  if (!office) return null;
  const address =
    String(office.address || "").trim() ||
    String(company?.address || "").trim() ||
    "";
  const lat =
    String(office.lat || "").trim() ||
    String(company?.coords?.lat || "").trim() ||
    "";
  const lon =
    String(office.lon || "").trim() ||
    String(company?.coords?.lon || company?.coords?.lng || "").trim() ||
    "";
  return { ...office, address, lat, lon };
}

/**
 * Build Autocomplete options: offices first (with address + free flag), then cities.
 */
export function buildBookingPlaceOptionsWithOffices({
  cityNames,
  carOffices,
  company = null,
  freeNote = "",
} = {}) {
  const cities = (Array.isArray(cityNames) ? cityNames : [])
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const offices = normalizeCarOffices(carOffices).map((o) =>
    enrichOfficeWithCompany(o, company)
  );

  const officeKeys = new Set(offices.map((o) => normalizeOfficeKey(o.name)));
  const officeOpts = offices.map((o) => {
    const address = o.address || "";
    const label = address ? `${o.name} — ${address}` : o.name;
    return {
      value: o.name,
      label,
      kind: "office",
      address,
      free: true,
      freeNote: freeNote || "",
      searchText: `${o.name} ${address} office офис oficina`.trim(),
    };
  });

  const cityOpts = cities
    .filter((name) => !officeKeys.has(normalizeOfficeKey(name)))
    .map((name) => ({
      value: name,
      label: name,
      kind: "city",
      address: "",
      free: false,
      freeNote: "",
      searchText: name,
    }));

  return [...officeOpts, ...cityOpts];
}

/**
 * Zero delivery fees for legs that match car offices.
 */
export function applyCarOfficeFreeDelivery(deliveryResult, offices) {
  if (!deliveryResult || typeof deliveryResult !== "object") {
    return deliveryResult;
  }
  const officeFreeIn = isPlaceMatchingCarOffice(
    deliveryResult.placeIn || deliveryResult.resolvedPlaceIn,
    offices
  );
  const officeFreeOut = isPlaceMatchingCarOffice(
    deliveryResult.placeOut || deliveryResult.resolvedPlaceOut,
    offices
  );
  if (!officeFreeIn && !officeFreeOut) {
    return {
      ...deliveryResult,
      officeFreeIn: false,
      officeFreeOut: false,
    };
  }

  const deliveryIn = officeFreeIn ? 0 : Number(deliveryResult.deliveryIn) || 0;
  const deliveryOut = officeFreeOut
    ? 0
    : Number(deliveryResult.deliveryOut) || 0;

  return {
    ...deliveryResult,
    deliveryIn,
    deliveryOut,
    deliveryTotal: deliveryIn + deliveryOut,
    officeFreeIn,
    officeFreeOut,
  };
}
