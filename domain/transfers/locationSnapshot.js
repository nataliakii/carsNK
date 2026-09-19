/**
 * Normalised location snapshot for transfers (and future rental alignment).
 * Immutable once attached to a transfer / quote.
 */

export const LOCATION_TYPES = [
  "airport",
  "hotel",
  "address",
  "city",
  "port",
  "railway",
  "zone",
  "other",
];

/**
 * @typedef {object} LocationSnapshot
 * @property {string} [providerPlaceId]
 * @property {string} formattedAddress
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string} country
 * @property {string} city
 * @property {string} locationType
 * @property {string} [iataCode]
 * @property {string} [hotelName]
 * @property {string} [placeName]
 * @property {string} [rawInput]
 * @property {Date|string} [capturedAt]
 */

/**
 * Build a normalised location snapshot from partial input.
 * @param {Partial<LocationSnapshot> & { name?: string, lon?: number }} raw
 * @returns {LocationSnapshot}
 */
export function buildLocationSnapshot(raw = {}) {
  const lat = parseCoord(raw.lat);
  const lng = parseCoord(raw.lng ?? raw.lon);
  const locationType = normalizeLocationType(raw.locationType, raw);
  const placeName = String(raw.placeName || raw.name || "").trim();
  const formattedAddress = String(
    raw.formattedAddress || placeName || raw.rawInput || ""
  ).trim();

  return {
    providerPlaceId: String(raw.providerPlaceId || "").trim() || undefined,
    formattedAddress,
    lat,
    lng,
    country: String(raw.country || "")
      .trim()
      .toUpperCase()
      .slice(0, 2),
    city: String(raw.city || "").trim(),
    locationType,
    iataCode: String(raw.iataCode || "")
      .trim()
      .toUpperCase()
      .slice(0, 3) || undefined,
    hotelName: String(raw.hotelName || "").trim() || undefined,
    placeName: placeName || undefined,
    rawInput: String(raw.rawInput || "").trim() || undefined,
    capturedAt: raw.capturedAt ? new Date(raw.capturedAt) : new Date(),
  };
}

export function locationDisplayName(snapshot) {
  if (!snapshot) return "";
  return (
    String(snapshot.hotelName || "").trim() ||
    String(snapshot.placeName || "").trim() ||
    String(snapshot.formattedAddress || "").trim() ||
    String(snapshot.city || "").trim() ||
    ""
  );
}

export function locationCacheKeyPart(snapshot) {
  if (!snapshot) return "unknown";
  if (snapshot.providerPlaceId) return `pid:${snapshot.providerPlaceId}`;
  if (snapshot.iataCode) return `iata:${String(snapshot.iataCode).toUpperCase()}`;
  const lat = Number(snapshot.lat);
  const lng = Number(snapshot.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `geo:${lat.toFixed(5)},${lng.toFixed(5)}`;
  }
  return `name:${normalizeKey(locationDisplayName(snapshot))}`;
}

function parseCoord(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLocationType(raw, ctx = {}) {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  if (LOCATION_TYPES.includes(t)) return t;
  if (ctx.iataCode || /airport/i.test(String(ctx.placeName || ctx.name || ""))) {
    return "airport";
  }
  if (ctx.hotelName || /hotel/i.test(String(ctx.placeName || ""))) {
    return "hotel";
  }
  if (ctx.city && !ctx.formattedAddress) return "city";
  return "address";
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Mongoose subdocument shape (shared by Transfer, quotes, zones). */
export const locationSnapshotSchemaDefinition = {
  providerPlaceId: { type: String, default: "", trim: true },
  formattedAddress: { type: String, default: "", trim: true },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  country: { type: String, default: "", uppercase: true, trim: true },
  city: { type: String, default: "", trim: true },
  locationType: {
    type: String,
    enum: LOCATION_TYPES,
    default: "address",
  },
  iataCode: { type: String, default: "", uppercase: true, trim: true },
  hotelName: { type: String, default: "", trim: true },
  placeName: { type: String, default: "", trim: true },
  rawInput: { type: String, default: "", trim: true },
  capturedAt: { type: Date, default: Date.now },
};
