import { ORDERED_LOCATION_OPTIONS } from "@/domain/orders/locationOptions";

export function normalizeBookingLocationKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function buildBookingLocationIndex(names) {
  const list = (Array.isArray(names) ? names : [])
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  const byKey = new Map();
  for (const name of list) {
    byKey.set(normalizeBookingLocationKey(name), name);
  }
  return { names: list, byKey };
}

export function isAllowedBookingLocation(value, names) {
  const { byKey } = buildBookingLocationIndex(names);
  return byKey.has(normalizeBookingLocationKey(value));
}

export function canonicalizeBookingLocation(value, names) {
  const { byKey } = buildBookingLocationIndex(names);
  return byKey.get(normalizeBookingLocationKey(value)) ?? null;
}

export function locationRequiresAddressDetail(value, cities = []) {
  const key = normalizeBookingLocationKey(value);
  if (!key) return false;
  const fromCatalog = cities.find(
    (city) => normalizeBookingLocationKey(city?.name) === key
  );
  if (fromCatalog?.requiresAddressDetail) return true;
  // Greece: Thessaloniki needs hotel/address. Spain hubs also (filter bar cities
  // use spainCityRequiresAddressDetail in catalogPlaceOptions for the full list).
  return key === "thessaloniki" || key === "madrid" || key === "barcelona";
}

export function isAirportBookingLocation(value, cities = []) {
  const key = normalizeBookingLocationKey(value);
  if (!key) return false;
  if (key === "airport" || key.includes("airport")) return true;
  const fromCatalog = cities.find(
    (city) => normalizeBookingLocationKey(city?.name) === key
  );
  return fromCatalog?.kind === "airport";
}

export function resolveBookingLocationOrDefault(
  raw,
  names,
  defaultLocation
) {
  const list = Array.isArray(names) ? names : [];
  const fromRaw = canonicalizeBookingLocation(raw, list);
  if (fromRaw) return fromRaw;
  const fromDefault = canonicalizeBookingLocation(defaultLocation, list);
  return fromDefault ?? list[0] ?? "";
}

export function fallbackBookingLocationNames() {
  return [...ORDERED_LOCATION_OPTIONS];
}
