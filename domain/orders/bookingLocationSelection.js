import {
  ORDER_CREATE_CODE,
  customerMessageForCode,
  persistedOfficeId,
} from "@/domain/orders/orderCreateContract";

export const PICKUP_OFFICE_REQUIRED = "Choose an office.";
export const RETURN_OFFICE_REQUIRED = "Choose an office.";
export const ADDRESS_REQUIRED = "Choose an address from the suggestions.";
export const DELIVERY_AREA_REQUIRED = "Choose a delivery area.";
export const MANUAL_ADDRESS_MIN_LENGTH = 5;

const MANUAL_PLACE_PREFIX = "manual:";

export function isManualPlaceId(placeId) {
  return String(placeId || "").startsWith(MANUAL_PLACE_PREFIX);
}

/** Stable client/server id for a typed address when Places cannot verify it. */
export function buildManualPlaceId(address) {
  const text = String(address || "").trim();
  if (text.length < MANUAL_ADDRESS_MIN_LENGTH) return "";
  return `${MANUAL_PLACE_PREFIX}${encodeURIComponent(text.slice(0, 200))}`;
}

export function addressFromManualPlaceId(placeId) {
  const raw = String(placeId || "");
  if (!raw.startsWith(MANUAL_PLACE_PREFIX)) return "";
  try {
    return decodeURIComponent(raw.slice(MANUAL_PLACE_PREFIX.length));
  } catch {
    return raw.slice(MANUAL_PLACE_PREFIX.length);
  }
}

export function canonicalOfficeId(officeOrId) {
  if (officeOrId && typeof officeOrId === "object") {
    return persistedOfficeId(officeOrId.id || officeOrId._id || officeOrId);
  }
  return persistedOfficeId(officeOrId);
}

/** Keep a valid office id. Auto-select only when there is exactly one office. */
export function resolveSelectedOfficeId(offices, currentId) {
  const ids = (Array.isArray(offices) ? offices : [])
    .map((office) => canonicalOfficeId(office))
    .filter(Boolean);
  const current = canonicalOfficeId(currentId);
  if (current && ids.includes(current)) return current;
  if (ids.length === 1) return ids[0];
  return "";
}

/**
 * Effective pickup/return after "same return location" is applied.
 * Office bookings do not carry a Place ID or address.
 */
export function resolveEffectiveBookingLocation({
  pickupMethod,
  pickupOfficeId,
  pickupPlaceId,
  sameReturnLocation,
  returnMethod,
  returnOfficeId,
  returnPlaceId,
} = {}) {
  const pickup = String(pickupMethod || "").trim().toLowerCase() === "office"
    ? "office"
    : "delivery";
  const same = Boolean(sameReturnLocation);
  const ret = same
    ? pickup
    : String(returnMethod || "").trim().toLowerCase() === "office"
      ? "office"
      : "delivery";
  const pickupId = pickup === "office" ? canonicalOfficeId(pickupOfficeId) : "";
  const returnId =
    ret === "office"
      ? canonicalOfficeId(same ? pickupOfficeId : returnOfficeId)
      : "";
  const pickupPlace = pickup === "delivery" ? String(pickupPlaceId || "").trim() : "";
  const returnPlace =
    ret === "delivery"
      ? String((same ? pickupPlaceId : returnPlaceId) || "").trim()
      : "";

  return {
    pickupMethod: pickup,
    pickupOfficeId: pickupId,
    pickupPlaceId: pickupPlace,
    returnMethod: ret,
    returnOfficeId: returnId,
    returnPlaceId: returnPlace,
    sameReturnLocation: same,
    pickupFee: pickup === "office" ? 0 : null,
    returnFee: ret === "office" ? 0 : null,
  };
}

export function validateCustomerBookingLocation(state) {
  const location = resolveEffectiveBookingLocation(state);
  const errors = {};
  if (location.pickupMethod === "office" && !location.pickupOfficeId) {
    errors.placeIn = PICKUP_OFFICE_REQUIRED;
  }
  if (location.pickupMethod === "delivery") {
    const placeId = String(location.pickupPlaceId || "").trim();
    const manualText = String(state.pickupAddressText || "").trim();
    const ok =
      Boolean(placeId) ||
      (Boolean(state.pickupManualAddress) &&
        manualText.length >= MANUAL_ADDRESS_MIN_LENGTH);
    if (!ok) errors.placeInDetail = ADDRESS_REQUIRED;
  }
  if (
    !location.sameReturnLocation &&
    location.returnMethod === "office" &&
    !location.returnOfficeId
  ) {
    errors.placeOut = RETURN_OFFICE_REQUIRED;
  }
  if (!location.sameReturnLocation && location.returnMethod === "delivery") {
    const placeId = String(location.returnPlaceId || "").trim();
    const manualText = String(state.returnAddressText || "").trim();
    const ok =
      Boolean(placeId) ||
      (Boolean(state.returnManualAddress) &&
        manualText.length >= MANUAL_ADDRESS_MIN_LENGTH);
    if (!ok) errors.placeOutDetail = ADDRESS_REQUIRED;
  }
  return { ok: Object.keys(errors).length === 0, errors, location };
}

/**
 * Server gate. Office id is enough. A Place ID is required only for delivery.
 */
export function assertCustomerLocationMethods(parsed) {
  const location = resolveEffectiveBookingLocation({
    pickupMethod: parsed?.pickup?.kind,
    pickupOfficeId: parsed?.pickup?.officeId,
    pickupPlaceId: parsed?.pickup?.placeId,
    sameReturnLocation: parsed?.dropoff?.sameAsPickup,
    returnMethod: parsed?.dropoff?.kind,
    returnOfficeId: parsed?.dropoff?.officeId,
    returnPlaceId: parsed?.dropoff?.placeId,
  });
  const checked = validateCustomerBookingLocation(location);
  if (checked.ok) return { ok: true, location };
  const message =
    checked.errors.placeIn ||
    checked.errors.placeOut ||
    checked.errors.placeInDetail ||
    checked.errors.placeOutDetail;
  const code = checked.errors.placeIn || checked.errors.placeOut
    ? ORDER_CREATE_CODE.OFFICE_NOT_SELECTED
    : "LOCATION_METHOD_REQUIRED";
  return {
    ok: false,
    code,
    message: message || customerMessageForCode(ORDER_CREATE_CODE.OFFICE_NOT_SELECTED),
    location,
  };
}
