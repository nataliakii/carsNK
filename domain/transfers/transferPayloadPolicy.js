/**
 * Who is allowed to set what on a transfer submission.
 *
 * Public submissions are filtered with an allow-list, not a deny-list. A field
 * a browser is not explicitly listed here as allowed to send is dropped, so a
 * field added to the schema or read by createTransferOrder later starts out
 * untrusted instead of starting out exposed.
 *
 * Money and route metrics are never taken from a submission: the pricing engine
 * and the distance provider produce them server-side.
 */

/**
 * Request-body keys that carry admin authority. A public caller must never be
 * able to set these, and createTransferOrder must never read them from the
 * body — it reads them from its trusted `context` argument instead, via
 * adminOverrideFromTrustedBody below.
 *
 * This is the single declared set: the public allow-list is checked against it,
 * and the admin path maps a body into a context through the same names.
 */
export const ADMIN_ONLY_TRANSFER_KEYS = Object.freeze({
  priceOverrideMinor: "adminPriceOverrideMinor",
  supplierPayoutMinor: "adminSupplierPayoutMinor",
  overrideReason: "adminOverrideReason",
  createdByAdmin: "createdByAdmin",
});

/** @type {ReadonlyArray<string>} */
export const ADMIN_ONLY_TRANSFER_FIELDS = Object.freeze(
  Object.values(ADMIN_ONLY_TRANSFER_KEYS)
);

/**
 * Route metrics and money the server always recomputes. Listed separately from
 * the admin fields because a submission that carries them is not necessarily
 * malicious — the browser echoes back the quote it was shown.
 */
export const SERVER_COMPUTED_TRANSFER_FIELDS = Object.freeze([
  "distanceKm",
  "durationMinutes",
  "baseFromDistanceKm",
  "baseFromDurationMinutes",
  "baseToDistanceKm",
  "baseToDurationMinutes",
  "quoteSnapshot",
  "customerPriceMinor",
  "supplierPayoutMinor",
]);

/** Everything a public caller may send at the top level of a submission. */
export const PUBLIC_TRANSFER_FIELDS = Object.freeze([
  // Route
  "from",
  "to",
  "origin",
  "destination",
  "pickupCity",
  "destinationCity",
  "additionalStops",
  "country",
  // When
  "datetime",
  "returnRequested",
  "returnDatetime",
  // Who travels
  "adults",
  "children",
  "passengers",
  // Luggage and seats
  "standardSuitcases",
  "cabinBags",
  "oversizedLuggage",
  "specialLuggage",
  "childSeats",
  "boosterSeats",
  // Vehicle and access
  "vehicleCategory",
  "needsAccessible",
  "accessibilityRequirements",
  // Trip details
  "flightNumber",
  "flightArrivalTime",
  "hotelName",
  "signText",
  "notes",
  // Contact
  "customerFirstName",
  "customerLastName",
  "customerName",
  "phone",
  "phoneCountryCode",
  "email",
  "locale",
  "preferredLanguage",
]);

/**
 * Location fields a public caller may send. `capturedAt` is deliberately absent:
 * the snapshot timestamp is an audit value the server stamps.
 */
export const PUBLIC_LOCATION_FIELDS = Object.freeze([
  "placeName",
  "name",
  "formattedAddress",
  "rawInput",
  "lat",
  "lng",
  "lon",
  "country",
  "city",
  "locationType",
  "iataCode",
  "hotelName",
  "providerPlaceId",
]);

export const PUBLIC_CHILD_FIELDS = Object.freeze(["age"]);
export const PUBLIC_SPECIAL_LUGGAGE_FIELDS = Object.freeze([
  "type",
  "quantity",
  "notes",
]);
/**
 * `placeName` / `name` are accepted alongside the modelled `location` because
 * the market check reads a stop written either way; only `location` is stored.
 */
export const PUBLIC_ADDITIONAL_STOP_FIELDS = Object.freeze([
  "location",
  "notes",
  "placeName",
  "name",
]);

/** A public submission may not chain an unbounded number of stops. */
export const MAX_PUBLIC_ADDITIONAL_STOPS = 8;

/** Arrays a public caller sends are capped so one body cannot fan out. */
const MAX_PUBLIC_CHILDREN = 20;
const MAX_PUBLIC_SPECIAL_LUGGAGE = 20;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pick(source, allowedFields) {
  if (!isPlainObject(source)) return undefined;
  const result = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }
  return result;
}

function pickList(source, allowedFields, max) {
  if (!Array.isArray(source)) return undefined;
  return source.slice(0, max).map((entry) => pick(entry, allowedFields) || {});
}

/** @param {unknown} raw */
export function pickPublicLocation(raw) {
  return pick(raw, PUBLIC_LOCATION_FIELDS);
}

/**
 * Reduce a submitted body to the fields a public caller is allowed to set.
 * Nested locations, children, luggage and stops are filtered the same way, so
 * an admin-only or server-computed field cannot hide inside a subdocument.
 *
 * @param {unknown} raw
 * @returns {object}
 */
export function pickPublicTransferPayload(raw) {
  const payload = pick(raw, PUBLIC_TRANSFER_FIELDS);
  if (!payload) return {};

  if ("origin" in payload) payload.origin = pickPublicLocation(payload.origin);
  if ("destination" in payload) {
    payload.destination = pickPublicLocation(payload.destination);
  }
  if ("children" in payload) {
    payload.children = pickList(
      payload.children,
      PUBLIC_CHILD_FIELDS,
      MAX_PUBLIC_CHILDREN
    );
  }
  if ("specialLuggage" in payload) {
    payload.specialLuggage = Array.isArray(payload.specialLuggage)
      ? payload.specialLuggage
          .slice(0, MAX_PUBLIC_SPECIAL_LUGGAGE)
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : pick(entry, PUBLIC_SPECIAL_LUGGAGE_FIELDS) || {}
          )
      : undefined;
  }
  if ("additionalStops" in payload) {
    const stops = pickList(
      payload.additionalStops,
      PUBLIC_ADDITIONAL_STOP_FIELDS,
      // One over the cap so the caller still gets a refusal rather than a
      // silently shortened itinerary.
      MAX_PUBLIC_ADDITIONAL_STOPS + 1
    );
    payload.additionalStops = stops?.map((stop) => ({
      ...stop,
      ...("location" in stop
        ? { location: pickPublicLocation(stop.location) }
        : {}),
    }));
  }

  return payload;
}

/**
 * Map an already-authorised admin request body into the trusted override that
 * createTransferOrder accepts. Only a caller that has checked the session may
 * call this; it reads exactly the keys declared in ADMIN_ONLY_TRANSFER_KEYS.
 *
 * @param {object} body
 * @returns {{ customerPriceMinor: number, supplierPayoutMinor: number|null, reason: string }|null}
 */
export function adminOverrideFromTrustedBody(body) {
  if (!isPlainObject(body)) return null;

  const priceRaw = body[ADMIN_ONLY_TRANSFER_KEYS.priceOverrideMinor];
  const reason = String(
    body[ADMIN_ONLY_TRANSFER_KEYS.overrideReason] || ""
  ).trim();
  if (priceRaw == null || !reason) return null;

  const customerPriceMinor = Math.round(Number(priceRaw));
  if (!Number.isFinite(customerPriceMinor) || customerPriceMinor < 0) {
    return null;
  }

  const payoutRaw = body[ADMIN_ONLY_TRANSFER_KEYS.supplierPayoutMinor];
  const supplierPayoutMinor =
    payoutRaw == null ? null : Math.round(Number(payoutRaw));

  return {
    customerPriceMinor,
    supplierPayoutMinor: Number.isFinite(supplierPayoutMinor)
      ? supplierPayoutMinor
      : null,
    reason,
  };
}
