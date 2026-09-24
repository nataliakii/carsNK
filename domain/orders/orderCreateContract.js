/**
 * Stable customer-facing results for POST /api/order/add.
 * The generic "temporarily blocked" sentence is only for an explicit
 * platform maintenance lock, not for per-client auto-bans.
 */

export const ORDER_CREATE_CODE = Object.freeze({
  OFFICE_NOT_SELECTED: "OFFICE_NOT_SELECTED",
  OFFICE_NOT_AVAILABLE: "OFFICE_NOT_AVAILABLE",
  CAR_NOT_AVAILABLE: "CAR_NOT_AVAILABLE",
  COMPANY_NOT_READY: "COMPANY_NOT_READY",
  BOOKING_TERMS_NOT_PUBLISHED: "BOOKING_TERMS_NOT_PUBLISHED",
  BOOKING_TERMS_NOT_ACCEPTED: "BOOKING_TERMS_NOT_ACCEPTED",
  SUPPLIER_TERMS_NOT_ACCEPTED: "SUPPLIER_TERMS_NOT_ACCEPTED",
  PRICE_CHANGED: "PRICE_CHANGED",
  ORDER_CREATE_FAILED: "ORDER_CREATE_FAILED",
  PLATFORM_MAINTENANCE: "PLATFORM_MAINTENANCE",
});

const CUSTOMER_MESSAGE = Object.freeze({
  [ORDER_CREATE_CODE.OFFICE_NOT_SELECTED]:
    "Choose an office for pickup and return.",
  [ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE]:
    "The selected office is no longer available. Please choose another office.",
  [ORDER_CREATE_CODE.CAR_NOT_AVAILABLE]:
    "This car is no longer available for the selected dates.",
  [ORDER_CREATE_CODE.COMPANY_NOT_READY]:
    "This supplier is not ready to take bookings yet.",
  [ORDER_CREATE_CODE.BOOKING_TERMS_NOT_PUBLISHED]:
    "Booking terms are not available yet. Please try again later.",
  [ORDER_CREATE_CODE.BOOKING_TERMS_NOT_ACCEPTED]:
    "Please read and accept the booking terms.",
  [ORDER_CREATE_CODE.SUPPLIER_TERMS_NOT_ACCEPTED]:
    "Please read and accept the supplier rental terms.",
  [ORDER_CREATE_CODE.PRICE_CHANGED]:
    "The price has changed. Please review the updated total.",
  [ORDER_CREATE_CODE.ORDER_CREATE_FAILED]:
    "We couldn’t create your booking. Please try again.",
  [ORDER_CREATE_CODE.PLATFORM_MAINTENANCE]:
    "Order creation is temporarily blocked",
});

export function customerMessageForCode(code) {
  return (
    CUSTOMER_MESSAGE[code] ||
    CUSTOMER_MESSAGE[ORDER_CREATE_CODE.ORDER_CREATE_FAILED]
  );
}

export function createCorrelationId() {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPlatformMaintenanceLock(ban) {
  const type = String(ban?.type || "").trim().toLowerCase();
  const reason = String(ban?.reason || "").trim();
  return type === "maintenance" || reason === "PLATFORM_MAINTENANCE";
}

/** Manual bans and maintenance locks stop the request. Auto-bans do not replace the real error. */
export function shouldHardBlockBan(ban) {
  if (!ban) return false;
  if (isPlatformMaintenanceLock(ban)) return true;
  return String(ban.type || "").trim().toLowerCase() === "manual";
}

export function attemptOutcome(status) {
  const code = Number(status);
  if (code === 201 || code === 202) return "success";
  if (code === 409) return "conflict";
  if (code >= 400 && code < 500) return "rejected";
  return "error";
}

export function mapTermsErrorCode(code) {
  if (code === "platform_terms_unavailable") {
    return ORDER_CREATE_CODE.BOOKING_TERMS_NOT_PUBLISHED;
  }
  if (code === "platform_terms_required" || code === "platform_terms_stale") {
    return ORDER_CREATE_CODE.BOOKING_TERMS_NOT_ACCEPTED;
  }
  if (code === "company_terms_required" || code === "company_terms_stale") {
    return ORDER_CREATE_CODE.SUPPLIER_TERMS_NOT_ACCEPTED;
  }
  return ORDER_CREATE_CODE.ORDER_CREATE_FAILED;
}

export function mapLocationQuoteCode(code) {
  if (
    code === "UNKNOWN_OFFICE" ||
    code === "OFFICE_NOT_OWNED_BY_COMPANY" ||
    code === "OFFICE_FORBIDDEN"
  ) {
    return ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE;
  }
  if (code === "CAR_REQUIRED") return ORDER_CREATE_CODE.CAR_NOT_AVAILABLE;
  return code || ORDER_CREATE_CODE.ORDER_CREATE_FAILED;
}

export function persistedOfficeId(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    const id = value._id || value.id;
    if (id && typeof id === "object" && id.toString) {
      const text = String(id.toString());
      return text === "[object Object]" ? "" : text;
    }
    const text = String(id || "");
    return text === "[object Object]" ? "" : text.trim();
  }
  const text = String(value).trim();
  return text === "[object Object]" ? "" : text;
}
