import { resolveDeliveryZoneName } from "@/domain/delivery/resolveDeliveryZoneName";
import { haversineKm, parseLatLon } from "@/domain/geo/haversineKm";
import { SPAIN_CITY_COORDS } from "@/domain/geo/spainCityCoords";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { ORDERED_LOCATION_OPTIONS } from "@/domain/orders/locationOptions";
import {
  DEFAULT_SPAIN_BOOKING_LOCATION,
  isSpainCityOption,
} from "@/domain/orders/spainCityOptions";

/**
 * Per-car office locations: booking place names (optionally with street address)
 * where pickup/return delivery fee is free (€0) for that car.
 *
 * Accepted shapes:
 * - "Nea Kallikratia"
 * - { name: "Barcelona", address: "Calle X 1", lat?, lon? }
 */

const GREECE_PLACE_MARKERS =
  /kallikratia|thessaloniki|halkidiki|chalkidiki|kassandra|sithonia|nea moudania|greece|ελλ(?:ά|α)?δα|630\s*80|leoforos|kato galini/i;

const SPAIN_PLACE_MARKERS =
  /spain|espa(?:ñ|n)a|catalunya|catalonia|barcelona|madrid|girona/i;

const SPAIN_NEAR_CITY_KM = 40;

export function normalizeOfficeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const GREECE_CATALOG_KEYS = new Set(
  ORDERED_LOCATION_OPTIONS.filter((name) => name !== "Airport").map((name) =>
    normalizeOfficeKey(name)
  )
);

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
 * Offices shown to the client: car offices first, otherwise company base.
 * On Spain / cities-strategy / ES site, never fall back to a leftover Greek HQ.
 *
 * @param {object|null} car
 * @param {object|null} company
 * @param {{ countryCode?: string, selectedCity?: string }} [options]
 * @returns {{ name: string, address: string, lat: string, lon: string, addressUnset?: boolean }[]}
 */
export function resolveBookingDisplayOffices(
  car,
  company = null,
  options = {}
) {
  const countryCode = options.countryCode;
  const selectedCity = String(options.selectedCity || "").trim();
  const spainMarket = isSpainOfficeMarket(countryCode, company);
  const enrichCompany = spainMarket ? spainSafeCompany(company) : company;

  const decorate = (office) => {
    const enriched = enrichOfficeWithCompany(office, enrichCompany);
    if (!spainMarket) return enriched;
    const street = String(enriched.address || "").trim();
    return {
      ...enriched,
      addressUnset: !street || looksLikeGreecePlace({ address: street }),
    };
  };

  const fromCar = normalizeCarOffices(car?.offices)
    .map((office) =>
      spainMarket ? sanitizeOfficeForSpainMarket(office) : office
    )
    .filter(Boolean)
    .map(decorate);
  if (fromCar.length) return fromCar;

  const fromCompany = normalizeCarOffices(company?.offices)
    .map((office) =>
      spainMarket ? sanitizeOfficeForSpainMarket(office) : office
    )
    .filter(Boolean)
    .map(decorate);
  if (fromCompany.length) return fromCompany;

  if (spainMarket) {
    return resolveSpainFallbackOffices(company, selectedCity);
  }

  return resolveLegacyCompanyBaseOffice(company);
}

export function googleMapsSearchUrl({ address, lat, lon, lng, name } = {}) {
  const lonVal = String(lon || lng || "").trim();
  const coords =
    String(lat || "").trim() && lonVal
      ? `${String(lat).trim()},${lonVal}`
      : "";
  const query = coords || String(address || name || "").trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Key-free Maps embed. Used when Maps JS cannot run on a server-restricted key.
 * Empty query → empty string (caller shows a list / Open in Maps instead).
 */
export function googleMapsEmbedUrl({ address, lat, lon, lng, name } = {}) {
  const lonVal = String(lon || lng || "").trim();
  const coords =
    String(lat || "").trim() && lonVal
      ? `${String(lat).trim()},${lonVal}`
      : "";
  const query = coords || String(address || name || "").trim();
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=12&output=embed`;
}

/**
 * Enrich office with company.address when office has no street address.
 * Does not copy a Greek HQ onto a Spanish office (or the reverse).
 */
export function enrichOfficeWithCompany(office, company) {
  if (!office) return null;
  const canCopy = canCopyCompanyContactOntoOffice(office, company);
  const address =
    String(office.address || "").trim() ||
    (canCopy ? String(company?.address || "").trim() : "") ||
    "";
  const lat =
    String(office.lat || "").trim() ||
    (canCopy ? String(company?.coords?.lat || "").trim() : "") ||
    "";
  const lon =
    String(office.lon || "").trim() ||
    (canCopy
      ? String(company?.coords?.lon || company?.coords?.lng || "").trim()
      : "") ||
    "";
  return { ...office, address, lat, lon };
}

/**
 * Street to prefill in the booking form. Never copies a leftover Greek HQ
 * onto a Spain office card.
 */
export function resolveOfficeFormAddress(office, company) {
  const officeAddr = String(office?.address || "").trim();
  if (officeAddr) {
    if (
      looksLikeGreecePlace({ address: officeAddr }) &&
      looksLikeSpainPlace(office)
    ) {
      return "";
    }
    if (isCompanyNameOnlyAddress(officeAddr, company)) return "";
    return officeAddr;
  }
  if (!canCopyCompanyContactOntoOffice(office || {}, company)) return "";
  return String(company?.address || "").trim();
}

export function looksLikeGreecePlace(place) {
  if (!place) return false;
  const name = String(place.name || "").trim();
  const address = String(place.address || "").trim();
  if (coordsCountry(place) === "GR") return true;
  if (name && GREECE_CATALOG_KEYS.has(normalizeOfficeKey(name))) return true;
  return GREECE_PLACE_MARKERS.test(`${name} ${address}`);
}

export function looksLikeSpainPlace(place) {
  if (!place) return false;
  const name = String(place.name || "").trim();
  const address = String(place.address || "").trim();
  if (coordsCountry(place) === "ES") return true;
  if (name && isSpainCityOption(name)) return true;
  if (address && isSpainCityOption(address)) return true;
  return SPAIN_PLACE_MARKERS.test(`${name} ${address}`);
}

function normalizeOfficeKeySafe(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function operatingCityNames(company) {
  const raw = company?.deliveryPricing?.operatingCities;
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const name =
      typeof item === "string"
        ? item.trim()
        : String(item?.name || item?.label || "").trim();
    if (!name) continue;
    const key = normalizeOfficeKeySafe(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function isOperatingCity(cityName, operatingCities) {
  const key = normalizeOfficeKeySafe(cityName);
  if (!key) return false;
  return (operatingCities || []).some(
    (city) => normalizeOfficeKeySafe(city) === key
  );
}

function namesMatch(a, b) {
  const left = normalizeOfficeKeySafe(a);
  const right = normalizeOfficeKeySafe(b);
  return Boolean(left && right && left === right);
}

function companyContactPlace(company) {
  const loc = Array.isArray(company?.locations) ? company.locations[0] : null;
  return {
    name: String(loc?.name || "").trim(),
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

function coordsCountry(place) {
  const point = parseLatLon({
    lat: place?.lat ?? place?.coords?.lat,
    lon: place?.lon ?? place?.lng ?? place?.coords?.lon ?? place?.coords?.lng,
  });
  if (!point) return "";
  if (
    point.lat >= 34.8 &&
    point.lat <= 41.8 &&
    point.lon >= 19.3 &&
    point.lon <= 29.7
  ) {
    return "GR";
  }
  if (
    point.lat >= 27.5 &&
    point.lat <= 43.9 &&
    point.lon >= -18.3 &&
    point.lon <= 4.5
  ) {
    return "ES";
  }
  return "";
}

function nearestSpainCityName(lat, lon, maxKm = SPAIN_NEAR_CITY_KM) {
  const point = parseLatLon({ lat, lon });
  if (!point) return "";
  let best = "";
  let bestKm = Infinity;
  for (const [name, coords] of Object.entries(SPAIN_CITY_COORDS)) {
    const km = haversineKm(point, coords);
    if (km != null && km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return bestKm <= maxKm ? best : "";
}

export function isSpainOfficeMarket(countryCode, company) {
  if (isSpainBookingSite(countryCode)) return true;
  if (String(company?.country || "").toUpperCase() === "ES") return true;
  return operatingCityNames(company).some((city) => isSpainCityOption(city));
}

function canCopyCompanyContactOntoOffice(office, company) {
  if (!company) return false;
  const contact = companyContactPlace(company);
  const officeSpain = looksLikeSpainPlace(office);
  const officeGreek = looksLikeGreecePlace(office);
  const companyGreek = looksLikeGreecePlace(contact);
  const companySpain = looksLikeSpainPlace(contact);
  if (officeSpain && companyGreek) return false;
  if (officeGreek && companySpain) return false;
  return true;
}

function spainSafeCompany(company) {
  if (!company) return null;
  const contact = companyContactPlace(company);
  if (!looksLikeGreecePlace(contact)) return company;
  const coordsAreGreek = coordsCountry(contact) === "GR";
  return {
    ...company,
    address: "",
    coords: coordsAreGreek ? null : company.coords,
  };
}

function sanitizeOfficeForSpainMarket(office) {
  if (!office) return null;
  if (looksLikeGreecePlace({ name: office.name }) && !looksLikeSpainPlace({ name: office.name })) {
    return null;
  }
  let address = String(office.address || "").trim();
  let lat = String(office.lat || "").trim();
  let lon = String(office.lon || "").trim();
  if (looksLikeGreecePlace({ address, lat, lon })) {
    address = "";
    if (coordsCountry({ lat, lon }) === "GR") {
      lat = "";
      lon = "";
    }
  }
  return { ...office, address, lat, lon };
}

function isCompanyNameOnlyAddress(address, company) {
  const addr = normalizeOfficeKeySafe(address);
  const name = normalizeOfficeKeySafe(company?.name);
  return Boolean(addr && name && addr === name);
}

function companyLabelWithoutGreekStreet(company) {
  const name = String(company?.name || "").trim();
  if (!name) return "";
  if (looksLikeGreecePlace({ name, address: name })) return "";
  return name;
}

function locationToOffice(loc) {
  return {
    name: String(loc?.name || "").trim(),
    address: String(loc?.address || "").trim(),
    lat: String(loc?.coords?.lat || loc?.lat || "").trim(),
    lon: String(
      loc?.coords?.lon || loc?.coords?.lng || loc?.lon || loc?.lng || ""
    ).trim(),
  };
}

function finalizeSpainOffice(office, company, { keepCompanyStreet = false } = {}) {
  let address = String(office.address || "").trim();
  if (keepCompanyStreet && !address) {
    address = String(company?.address || "").trim();
  }
  if (!keepCompanyStreet || looksLikeGreecePlace({ address })) {
    address = "";
  }
  const companyLabel = companyLabelWithoutGreekStreet(company);
  if (!address && companyLabel && !namesMatch(companyLabel, office.name)) {
    address = companyLabel;
  }
  const streetMissing =
    !address || isCompanyNameOnlyAddress(address, company);
  let lat = String(office.lat || "").trim();
  let lon = String(office.lon || "").trim();
  if (coordsCountry({ lat, lon }) === "GR") {
    lat = "";
    lon = "";
  }
  return {
    name: office.name,
    address,
    lat,
    lon,
    addressUnset: streetMissing,
  };
}

function resolveSpainFallbackOffices(company, selectedCity) {
  const operating = operatingCityNames(company);
  const contact = companyContactPlace(company);
  const companySpain = looksLikeSpainPlace(contact);
  const coords = {
    lat: String(company?.coords?.lat || "").trim(),
    lon: String(company?.coords?.lon || company?.coords?.lng || "").trim(),
  };
  const nearest = nearestSpainCityName(coords.lat, coords.lon);

  const spainLocations = (Array.isArray(company?.locations)
    ? company.locations
    : [])
    .map(locationToOffice)
    .filter((loc) => loc.name)
    .filter(
      (loc) =>
        looksLikeSpainPlace(loc) || isOperatingCity(loc.name, operating)
    )
    .filter((loc) => !looksLikeGreecePlace({ name: loc.name }));

  let locations = spainLocations;
  if (selectedCity) {
    const matching = locations.filter((loc) => namesMatch(loc.name, selectedCity));
    if (matching.length) locations = matching;
  }
  if (locations.length) {
    return locations.map((loc) =>
      finalizeSpainOffice(loc, company, { keepCompanyStreet: companySpain })
    );
  }

  if (companySpain || nearest) {
    const title =
      (selectedCity &&
        isOperatingCity(selectedCity, operating) &&
        selectedCity) ||
      (nearest && isOperatingCity(nearest, operating) ? nearest : "") ||
      nearest ||
      (selectedCity && isSpainCityOption(selectedCity) ? selectedCity : "") ||
      operating.find((city) => isSpainCityOption(city)) ||
      String(company?.name || "").trim() ||
      DEFAULT_SPAIN_BOOKING_LOCATION;
    return [
      finalizeSpainOffice(
        {
          name: title,
          address: companySpain ? String(company?.address || "").trim() : "",
          lat: nearest ? coords.lat : "",
          lon: nearest ? coords.lon : "",
        },
        company,
        { keepCompanyStreet: companySpain }
      ),
    ];
  }

  const cityTitle =
    (selectedCity && isOperatingCity(selectedCity, operating) && selectedCity) ||
    (isOperatingCity(DEFAULT_SPAIN_BOOKING_LOCATION, operating)
      ? DEFAULT_SPAIN_BOOKING_LOCATION
      : "");
  if (!cityTitle) return [];

  return [
    finalizeSpainOffice(
      { name: cityTitle, address: "", lat: "", lon: "" },
      company,
      { keepCompanyStreet: false }
    ),
  ];
}

function resolveLegacyCompanyBaseOffice(company) {
  const locName = Array.isArray(company?.locations)
    ? String(company.locations[0]?.name || "").trim()
    : "";
  const name = locName || String(company?.name || "").trim() || "";
  const address = String(company?.address || "").trim();
  const lat = String(company?.coords?.lat || "").trim();
  const lon = String(
    company?.coords?.lon || company?.coords?.lng || ""
  ).trim();
  if (!name && !address && !lat) return [];
  return [
    enrichOfficeWithCompany(
      { name: name || "Office", address, lat, lon },
      company
    ),
  ];
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
