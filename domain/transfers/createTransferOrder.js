import Transfer, {
  TRANSFER_STATUS,
  defaultTransferCommissionPercent,
  defaultOfferTtlHours,
} from "@models/Transfer";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { buildLocationSnapshot } from "@/domain/transfers/locationSnapshot";
import { calculateTransferQuote } from "@/domain/transfers/pricingEngine";
import { getTransferBaseDistances } from "@/domain/transfers/getTransferDistance";
import { getSiteCountryCode } from "@config/siteCountry";
import { getSiteCountryConfig } from "@config/siteCountry";
import { parseRequiredCustomerEmail } from "@/domain/validation/customerEmail";

/**
 * Drop client-supplied distance, duration, and price fields.
 * Server always recomputes via getTransferDistance / pricing engine.
 */
export function omitUntrustedTransferMetrics(payload) {
  const {
    distanceKm: _d,
    durationMinutes: _dm,
    baseFromDistanceKm: _bf,
    baseFromDurationMinutes: _bfm,
    baseToDistanceKm: _bt,
    baseToDurationMinutes: _btm,
    quoteSnapshot: _q,
    customerPriceMinor: _c,
    supplierPayoutMinor: _s,
    ...safePayload
  } = payload || {};
  return safePayload;
}

/**
 * Create a transfer order with server-side quote (never trust browser distance/price).
 */
export async function createTransferOrder(rawPayload = {}) {
  const payload = omitUntrustedTransferMetrics(rawPayload);
  const from = String(payload?.from || payload?.origin?.placeName || "").trim();
  const to = String(payload?.to || payload?.destination?.placeName || "").trim();
  const notes = String(payload?.notes || "").trim();
  const customerFirstName = String(payload?.customerFirstName || "").trim();
  const customerLastName = String(payload?.customerLastName || "").trim();
  const customerName =
    String(payload?.customerName || "").trim() ||
    [customerFirstName, customerLastName].filter(Boolean).join(" ");
  const phone = String(payload?.phone || "").trim();
  const phoneCountryCode = String(payload?.phoneCountryCode || "").trim();
  const email = String(payload?.email || "").trim();
  const locale = String(payload?.locale || payload?.preferredLanguage || "").trim();
  const preferredLanguage = String(
    payload?.preferredLanguage || payload?.locale || ""
  ).trim();

  const adults = Math.max(
    1,
    Math.floor(Number(payload?.adults ?? payload?.passengers) || 1)
  );
  const children = Array.isArray(payload?.children)
    ? payload.children
        .map((c) => ({ age: Number(c.age) }))
        .filter((c) => Number.isFinite(c.age) && c.age >= 0 && c.age <= 17)
    : [];
  const passengers = adults + children.length;

  const datetimeRaw = payload?.datetime;
  const datetime = datetimeRaw ? new Date(datetimeRaw) : null;

  if (!from || !to) {
    return { ok: false, message: "from and to are required", status: 400 };
  }
  const emailCheck = parseRequiredCustomerEmail(email);
  if (!emailCheck.ok) {
    return { ok: false, message: emailCheck.message, status: 400 };
  }
  const normalizedEmail = emailCheck.email;
  if (!Number.isFinite(passengers) || passengers < 1) {
    return { ok: false, message: "passengers must be >= 1", status: 400 };
  }
  if (!datetime || Number.isNaN(datetime.getTime())) {
    return { ok: false, message: "datetime is required", status: 400 };
  }

  const country = String(
    payload?.country || payload?.origin?.country || getSiteCountryCode()
  )
    .trim()
    .toUpperCase();

  const origin = buildLocationSnapshot({
    ...(payload.origin || {}),
    placeName: payload.origin?.placeName || from,
    rawInput: from,
    country: payload.origin?.country || country,
    city: payload.origin?.city || payload.pickupCity || "",
    locationType: payload.origin?.locationType,
    iataCode: payload.origin?.iataCode,
    hotelName: payload.origin?.hotelName || payload.hotelName,
  });
  const destination = buildLocationSnapshot({
    ...(payload.destination || {}),
    placeName: payload.destination?.placeName || to,
    rawInput: to,
    country: payload.destination?.country || country,
    city: payload.destination?.city || payload.destinationCity || "",
    locationType: payload.destination?.locationType,
    hotelName: payload.destination?.hotelName,
  });

  // If airport pickup inferred from flight number / name
  if (
    origin.locationType === "address" &&
    (/airport/i.test(from) || payload.flightNumber)
  ) {
    origin.locationType = "airport";
  }

  const quoteResult = await calculateTransferQuote({
    country,
    origin,
    destination,
    from,
    to,
    datetime,
    adults,
    children,
    passengers,
    standardSuitcases: Number(payload.standardSuitcases || 0),
    cabinBags: Number(payload.cabinBags || 0),
    oversizedLuggage: Number(payload.oversizedLuggage || 0),
    specialLuggage: payload.specialLuggage || [],
    childSeats: Number(payload.childSeats || 0),
    boosterSeats: Number(payload.boosterSeats || 0),
    additionalStops: payload.additionalStops || [],
    vehicleCategory: payload.vehicleCategory,
    needsAccessible: Boolean(payload.needsAccessible),
    accessibilityRequirements: payload.accessibilityRequirements,
    isReturn: Boolean(payload.returnRequested),
  });

  if (!quoteResult.ok && quoteResult.code === "capacity") {
    return {
      ok: false,
      message: quoteResult.message,
      code: "capacity",
      status: 422,
    };
  }

  const requiresManual = Boolean(quoteResult.requiresManualQuote);
  const status = requiresManual
    ? TRANSFER_STATUS.MANUAL_QUOTE_REQUIRED
    : TRANSFER_STATUS.OPEN_FOR_CLAIM;

  // Admin may override price with mandatory reason
  let quoteSnapshot = quoteResult.quote;
  if (
    payload.adminPriceOverrideMinor != null &&
    payload.adminOverrideReason
  ) {
    const customerPriceMinor = Math.round(Number(payload.adminPriceOverrideMinor));
    const supplierPayoutMinor =
      payload.adminSupplierPayoutMinor != null
        ? Math.round(Number(payload.adminSupplierPayoutMinor))
        : quoteSnapshot.supplierPayoutMinor;
    quoteSnapshot = {
      ...quoteSnapshot,
      customerPriceMinor,
      supplierPayoutMinor,
      platformMarginMinor:
        customerPriceMinor -
        supplierPayoutMinor -
        Number(quoteSnapshot.paymentProcessingAmountMinor || 0),
      adminOverrideReason: String(payload.adminOverrideReason),
      isProvisional: false,
    };
  }

  const route = quoteResult.route;
  const currency = getSiteCountryConfig().currency || "EUR";

  let baseFromDistanceKm = null;
  let baseFromDurationMinutes = null;
  let baseToDistanceKm = null;
  let baseToDurationMinutes = null;
  try {
    const company = await Company.findById(COMPANY_ID).select("coords").lean();
    const baseResult = await getTransferBaseDistances({
      baseCoords: {
        lat: company?.coords?.lat,
        lon: company?.coords?.lon,
      },
      from,
      to,
      country,
    });
    if (baseResult.baseToFrom?.ok) {
      baseFromDistanceKm = baseResult.baseToFrom.distanceKm ?? null;
      baseFromDurationMinutes = baseResult.baseToFrom.durationMinutes ?? null;
    }
    if (baseResult.baseToTo?.ok) {
      baseToDistanceKm = baseResult.baseToTo.distanceKm ?? null;
      baseToDurationMinutes = baseResult.baseToTo.durationMinutes ?? null;
    }
  } catch (err) {
    console.error("[transfer] base distances failed", err?.message || err);
  }

  const doc = await Transfer.create({
    from,
    to,
    origin,
    destination,
    distanceKm: route?.distanceKm ?? null,
    durationMinutes: route?.durationMinutes ?? null,
    routeProvider: route?.provider || "",
    routeCalculatedAt: route?.calculatedAt || null,
    routeCacheKey: route?.cacheKey || "",
    routeWarnings: route?.warnings || [],
    tollsMinor: route?.tollsMinor ?? null,
    baseFromDistanceKm,
    baseFromDurationMinutes,
    baseToDistanceKm,
    baseToDurationMinutes,
    adults,
    children,
    passengers: Math.min(50, passengers),
    standardSuitcases: Number(payload.standardSuitcases || 0),
    cabinBags: Number(payload.cabinBags || 0),
    oversizedLuggage: Number(payload.oversizedLuggage || 0),
    specialLuggage: payload.specialLuggage || [],
    childSeats: Number(payload.childSeats || 0),
    boosterSeats: Number(payload.boosterSeats || 0),
    vehicleCategory: quoteResult.vehicleCategory || "STANDARD",
    datetime,
    returnRequested: Boolean(payload.returnRequested),
    returnDatetime: payload.returnDatetime
      ? new Date(payload.returnDatetime)
      : null,
    flightNumber: String(payload.flightNumber || "").trim(),
    flightArrivalTime: String(payload.flightArrivalTime || "").trim(),
    hotelName: String(payload.hotelName || "").trim(),
    signText: String(payload.signText || "").trim(),
    additionalStops: payload.additionalStops || [],
    accessibilityRequirements: String(
      payload.accessibilityRequirements || ""
    ).trim(),
    notes,
    customerFirstName,
    customerLastName,
    customerName,
    phone,
    phoneCountryCode,
    email: normalizedEmail,
    preferredLanguage,
    locale,
    status,
    country,
    quoteSnapshot,
    platformCommissionPercent: defaultTransferCommissionPercent(),
    offerExpiresAt: requiresManual
      ? null
      : new Date(Date.now() + defaultOfferTtlHours() * 60 * 60 * 1000),
    payment: {
      method: "pay_after_claim",
      status: "not_required",
      currency,
    },
    statusEvents: [
      {
        from: "",
        to: status,
        at: new Date(),
        actor: payload.createdByAdmin ? "admin" : "customer",
        actorEmail: normalizedEmail,
      },
    ],
  });

  return {
    ok: true,
    transfer: doc,
    requiresManualQuote: requiresManual,
    quote: quoteSnapshot,
  };
}

/**
 * Public quote preview — no persistence.
 * @param {object} payload
 * @param {{ includeInternal?: boolean }} [opts]
 */
export async function previewTransferQuote(
  payload = {},
  { includeInternal = false } = {}
) {
  const country = String(
    payload?.country || payload?.origin?.country || getSiteCountryCode()
  )
    .trim()
    .toUpperCase();
  const from = String(payload?.from || payload?.origin?.placeName || "").trim();
  const to = String(payload?.to || payload?.destination?.placeName || "").trim();
  const origin = buildLocationSnapshot({
    ...(payload.origin || {}),
    placeName: payload.origin?.placeName || from,
    rawInput: from,
    country,
  });
  const destination = buildLocationSnapshot({
    ...(payload.destination || {}),
    placeName: payload.destination?.placeName || to,
    rawInput: to,
    country,
  });

  const adults = Math.max(
    1,
    Math.floor(Number(payload?.adults ?? payload?.passengers) || 1)
  );
  const children = Array.isArray(payload?.children) ? payload.children : [];

  const result = await calculateTransferQuote({
    country,
    origin,
    destination,
    from,
    to,
    datetime: payload.datetime,
    adults,
    children,
    standardSuitcases: Number(payload.standardSuitcases || 0),
    cabinBags: Number(payload.cabinBags || 0),
    oversizedLuggage: Number(payload.oversizedLuggage || 0),
    specialLuggage: payload.specialLuggage || [],
    childSeats: Number(payload.childSeats || 0),
    boosterSeats: Number(payload.boosterSeats || 0),
    additionalStops: payload.additionalStops || [],
    vehicleCategory: payload.vehicleCategory,
    needsAccessible: Boolean(payload.needsAccessible),
    accessibilityRequirements: payload.accessibilityRequirements,
    isReturn: Boolean(payload.returnRequested),
  });

  if (!result.ok) {
    return result;
  }

  // Customer-facing: strip supplier payout / margin
  const publicQuote = {
    customerPriceMinor: result.quote.customerPriceMinor,
    currency: result.quote.currency,
    pricingMethod: result.quote.pricingMethod,
    pricingExplanation: result.quote.isProvisional
      ? "A team member will confirm your price shortly."
      : result.quote.pricingExplanation?.startsWith("Fixed")
        ? "Fixed route price"
        : result.quote.pricingExplanation?.startsWith("Zone")
          ? "Zone-based price"
          : result.quote.pricingExplanation?.startsWith("City")
            ? "Distance-based price"
            : result.quote.pricingExplanation,
    distanceKm: result.quote.distanceKm,
    durationMinutes: result.quote.durationMinutes,
    vehicleCategory: result.vehicleCategory,
    appliedSurcharges: (result.quote.appliedSurcharges || []).map((s) => ({
      code: s.code,
      amountMinor: s.amountMinor,
    })),
    isProvisional: result.quote.isProvisional,
    requiresManualQuote: Boolean(result.requiresManualQuote),
  };

  return {
    ok: true,
    quote: publicQuote,
    ...(includeInternal ? { internalQuote: result.quote } : {}),
    route: result.route
      ? {
          distanceKm: result.route.distanceKm,
          durationMinutes: result.route.durationMinutes,
          approximate: result.route.approximate,
          fromCache: result.route.fromCache,
        }
      : null,
    vehicleCategory: result.vehicleCategory,
  };
}
