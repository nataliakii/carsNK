import { officeIdString } from "@/domain/company/officeRecord";

export const LOCATION_KIND = Object.freeze({
  OFFICE: "office",
  DELIVERY: "delivery",
});

export function emptyLocationLeg() {
  return {
    kind: LOCATION_KIND.DELIVERY,
    officeId: "",
    name: "",
    address: "",
    city: "",
    country: "",
    locationType: "",
    placeId: "",
    lat: null,
    lon: null,
    instructions: "",
    feeMajor: 0,
    distanceKm: null,
    ruleId: "",
    ruleVersion: "",
    blocked: false,
  };
}

export function buildLocationLeg({
  kind,
  office,
  place,
  feeMajor = 0,
  distanceKm = null,
  ruleId = "",
  ruleVersion = "",
  blocked = false,
} = {}) {
  const isOffice = kind === LOCATION_KIND.OFFICE;
  return {
    kind: isOffice ? LOCATION_KIND.OFFICE : LOCATION_KIND.DELIVERY,
    officeId: isOffice ? officeIdString(office?._id || office?.id) : "",
    name: isOffice
      ? String(office?.publicName || office?.name || "").trim()
      : String(place?.locality || place?.name || "").trim(),
    address: isOffice
      ? String(office?.address || "").trim()
      : String(place?.address || "").trim(),
    city: String(office?.city || place?.locality || "").trim(),
    country: String(office?.country || place?.country || "").trim().toUpperCase(),
    locationType: isOffice
      ? String(office?.locationType || "office")
      : String(place?.locationType || ""),
    placeId: isOffice ? String(office?.placeId || "").trim() : String(place?.placeId || "").trim(),
    lat: isOffice
      ? office?.lat != null && office.lat !== ""
        ? Number(office.lat)
        : null
      : Number.isFinite(Number(place?.lat))
        ? Number(place.lat)
        : null,
    lon: isOffice
      ? office?.lon != null && office.lon !== ""
        ? Number(office.lon)
        : null
      : Number.isFinite(Number(place?.lon))
        ? Number(place.lon)
        : null,
    instructions: isOffice
      ? String(office?.collectionInstructions || office?.returnInstructions || "").trim()
      : "",
    feeMajor: Number.isFinite(Number(feeMajor)) ? Number(feeMajor) : 0,
    distanceKm:
      distanceKm == null || !Number.isFinite(Number(distanceKm))
        ? null
        : Number(distanceKm),
    ruleId: String(ruleId || ""),
    ruleVersion: String(ruleVersion || ""),
    blocked: Boolean(blocked),
  };
}

export function buildLocationSnapshot({
  pickup,
  dropoff,
  currency = "EUR",
  calculatedAt = new Date(),
  pricingVersion = "",
} = {}) {
  return {
    pickup: pickup || emptyLocationLeg(),
    return: dropoff || pickup || emptyLocationLeg(),
    currency: String(currency || "EUR").toUpperCase(),
    calculatedAt:
      calculatedAt instanceof Date ? calculatedAt.toISOString() : String(calculatedAt),
    pricingVersion:
      pricingVersion === "" || pricingVersion == null
        ? ""
        : String(pricingVersion),
  };
}

function finiteNonNeg(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, code: "INVALID_LOCATION_SNAPSHOT", field };
  }
  return { ok: true, value: n };
}

/**
 * Strict parse of a persisted/public locationSnapshot.
 * Rejects unknown kinds and non-finite fees; does not trust client totals.
 */
export function parseLocationSnapshot(raw) {
  if (raw == null) return { ok: true, value: null, legacy: true };
  if (typeof raw !== "object") {
    return { ok: false, code: "INVALID_LOCATION_SNAPSHOT", message: "locationSnapshot must be an object" };
  }
  const pickup = raw.pickup;
  const ret = raw.return || raw.dropoff;
  if (!pickup || typeof pickup !== "object" || !ret || typeof ret !== "object") {
    return {
      ok: false,
      code: "INVALID_LOCATION_SNAPSHOT",
      message: "locationSnapshot requires pickup and return legs",
    };
  }
  for (const [label, leg] of [
    ["pickup", pickup],
    ["return", ret],
  ]) {
    const kind = String(leg.kind || "").toLowerCase();
    if (kind !== LOCATION_KIND.OFFICE && kind !== LOCATION_KIND.DELIVERY) {
      return {
        ok: false,
        code: "INVALID_LOCATION_SNAPSHOT",
        message: `${label}.kind must be office or delivery`,
      };
    }
    const fee = finiteNonNeg(leg.feeMajor ?? 0, `${label}.feeMajor`);
    if (!fee.ok) {
      return {
        ok: false,
        code: fee.code,
        message: `${fee.field} must be a non-negative number`,
      };
    }
    if (kind === LOCATION_KIND.OFFICE && !String(leg.officeId || "").trim()) {
      return {
        ok: false,
        code: "INVALID_LOCATION_SNAPSHOT",
        message: `${label}.officeId is required for office legs`,
      };
    }
    if (kind === LOCATION_KIND.DELIVERY && !String(leg.placeId || "").trim()) {
      return {
        ok: false,
        code: "INVALID_LOCATION_SNAPSHOT",
        message: `${label}.placeId is required for delivery legs`,
      };
    }
    if (
      kind === LOCATION_KIND.DELIVERY &&
      String(leg.placeId || "").startsWith("manual:") &&
      String(leg.address || "").trim().length < 5
    ) {
      return {
        ok: false,
        code: "INVALID_LOCATION_SNAPSHOT",
        message: `${label}.address is required for manual delivery legs`,
      };
    }
  }
  const currency = String(raw.currency || "EUR").trim().toUpperCase();
  if (currency !== "EUR") {
    return {
      ok: false,
      code: "INVALID_LOCATION_SNAPSHOT",
      message: "Only EUR is supported",
    };
  }
  return {
    ok: true,
    value: buildLocationSnapshot({
      pickup,
      dropoff: ret,
      currency,
      calculatedAt: raw.calculatedAt || new Date(),
      pricingVersion: raw.pricingVersion || raw.pickup?.ruleVersion || "",
    }),
  };
}

/**
 * Validate authoritativePrice minor-unit document.
 */
export function parseAuthoritativePrice(raw) {
  if (raw == null) return { ok: true, value: null, legacy: true };
  if (typeof raw !== "object") {
    return { ok: false, code: "INVALID_AUTHORITATIVE_PRICE", message: "authoritativePrice must be an object" };
  }
  const required = [
    "grossMinor",
    "prepaymentMinor",
    "balanceMinor",
    "pickupFeeMinor",
    "returnFeeMinor",
  ];
  const out = { ...raw };
  for (const key of required) {
    const n = Number(raw[key]);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return {
        ok: false,
        code: "INVALID_AUTHORITATIVE_PRICE",
        message: `${key} must be a non-negative integer`,
      };
    }
    out[key] = n;
  }
  const currency = String(raw.currency || "EUR").trim().toUpperCase();
  if (currency !== "EUR") {
    return {
      ok: false,
      code: "INVALID_AUTHORITATIVE_PRICE",
      message: "Only EUR is supported",
    };
  }
  if (out.prepaymentMinor + out.balanceMinor !== out.grossMinor) {
    return {
      ok: false,
      code: "INVALID_AUTHORITATIVE_PRICE",
      message: "prepaymentMinor + balanceMinor must equal grossMinor",
    };
  }
  if (out.pickupFeeMinor + out.returnFeeMinor > out.grossMinor) {
    return {
      ok: false,
      code: "INVALID_AUTHORITATIVE_PRICE",
      message: "delivery fees exceed grossMinor",
    };
  }
  out.currency = currency;
  return { ok: true, value: out };
}

export function locationLine(leg) {
  if (!leg) return "";
  if (leg.kind === LOCATION_KIND.OFFICE) {
    return [leg.name, leg.address].filter(Boolean).join(" — ");
  }
  return [leg.address || leg.name, leg.city, leg.country].filter(Boolean).join(", ");
}

export function formatLocationLegLine(leg, { officeLabel = "Office", deliveryLabel = "Delivery" } = {}) {
  if (!leg) return "";
  const prefix = leg.kind === LOCATION_KIND.OFFICE ? officeLabel : deliveryLabel;
  const line = locationLine(leg);
  const fee =
    Number(leg.feeMajor) > 0 ? ` · €${Number(leg.feeMajor).toFixed(2)}` : " · €0";
  return line ? `${prefix}: ${line}${fee}` : `${prefix}${fee}`;
}

export function orderFieldsFromSnapshot(snapshot) {
  if (!snapshot?.pickup) return {};
  return {
    placeIn: snapshot.pickup.city || snapshot.pickup.name || "",
    placeOut: snapshot.return?.city || snapshot.return?.name || snapshot.pickup.city || "",
    placeInDetail: snapshot.pickup.address || "",
    placeOutDetail: snapshot.return?.address || snapshot.pickup.address || "",
    pickupMethod: snapshot.pickup.kind || "",
    returnMethod: snapshot.return?.kind || snapshot.pickup.kind || "",
  };
}

export function snapshotFeesMatchAuthoritativePrice(snapshot, auth) {
  if (!snapshot || !auth) return false;
  const pickupMinor = Math.round((Number(snapshot.pickup?.feeMajor) || 0) * 100);
  const returnMinor = Math.round((Number(snapshot.return?.feeMajor) || 0) * 100);
  return (
    pickupMinor === Math.round(Number(auth.pickupFeeMinor) || 0) &&
    returnMinor === Math.round(Number(auth.returnFeeMinor) || 0)
  );
}

/**
 * Existing orders without a snapshot stay confirmable.
 * When a snapshot exists it must still match the stored authoritative price.
 */
export function assertLocationSnapshotForConfirm(order) {
  const snap = order?.locationSnapshot;
  if (!snap) return { ok: true, legacy: true };
  const auth = order?.authoritativePrice;
  if (!auth || !Number.isFinite(Number(auth.grossMinor))) {
    return {
      ok: false,
      code: "PRICE_SNAPSHOT_INVALID",
      message:
        "This booking is missing an authoritative price. Confirm the quote with the customer before accepting.",
    };
  }
  if (!snapshotFeesMatchAuthoritativePrice(snap, auth)) {
    return {
      ok: false,
      code: "PRICE_SNAPSHOT_INVALID",
      message:
        "Location pricing no longer matches the stored quote. Do not recalculate silently — confirm with the customer.",
    };
  }
  return { ok: true };
}
