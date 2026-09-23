/**
 * Single display/reconciliation breakdown for a stored rental price.
 *
 * Integer minor units only. Does not invent a delivery fee from a leftover
 * difference, and does not add the Rovaro Booking Fee on top of gross.
 *
 * Prefer authoritativePrice, then locationSnapshot, then PriceBreakdown.
 */

import { LOCATION_KIND } from "@/domain/orders/locationSnapshot";
import { formatMarketplaceEuro } from "@/domain/orders/marketplaceFinancialSplit";

export const PRICE_BREAKDOWN_MISMATCH = "PRICE_BREAKDOWN_MISMATCH";
export const PRICE_BREAKDOWN_CUSTOMER_MESSAGE =
  "We could not confirm the price. Please contact Rovaro support.";

function integerMinor(value) {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
}

function majorToMinor(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function firstMinor(...candidates) {
  for (const value of candidates) {
    const n = integerMinor(value);
    if (n != null) return n;
  }
  return 0;
}

function firstMinorOrNull(...candidates) {
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const n = integerMinor(value);
    if (n != null) return n;
  }
  return null;
}

function shortLocationLabel(leg) {
  if (!leg || typeof leg !== "object") return "";
  return String(leg.name || leg.city || "").trim();
}

function extraLinesFromSource({ auth, breakdown }) {
  const extras = [];
  const lines = Array.isArray(auth?.lines) ? auth.lines : [];
  const extrasLine = lines.find(
    (line) => String(line?.code || "") === "EXTRAS" && integerMinor(line?.minor) > 0
  );
  if (extrasLine) {
    extras.push({
      code: "EXTRAS",
      label: String(extrasLine.label || "Extras"),
      minor: integerMinor(extrasLine.minor) || 0,
    });
    return extras;
  }

  const childMinor = firstMinor(
    breakdown ? majorToMinor(breakdown.childSeatsTotal) : null
  );
  const secondMinor = firstMinor(
    breakdown ? majorToMinor(breakdown.secondDriverTotal) : null
  );
  const extrasMinor = firstMinor(auth?.extrasMinor);
  if (childMinor > 0) {
    extras.push({ code: "CHILD_SEATS", label: "Child seat", minor: childMinor });
  }
  if (secondMinor > 0) {
    extras.push({
      code: "SECOND_DRIVER",
      label: "Second driver",
      minor: secondMinor,
    });
  }
  const accounted = extras.reduce((sum, row) => sum + row.minor, 0);
  if (extrasMinor > accounted) {
    extras.push({
      code: "EXTRAS",
      label: "Extras",
      minor: extrasMinor - accounted,
    });
  }
  return extras;
}

function copyFor(locale = "en") {
  const lang = String(locale || "en").slice(0, 2);
  if (lang === "es") {
    return {
      rental: "Alquiler",
      childSeat: "Silla infantil",
      secondDriver: "Segundo conductor",
      insurance: "Seguro",
      discount: "Descuento",
      manualAdjustment: "Ajuste manual",
      unclassified: "Ajuste legado sin clasificar",
      pickupOfficeFree: "Recogida en oficina de la empresa",
      returnOfficeFree: "Devolución en oficina de la empresa",
      bothOfficeFree: "Recogida y devolución en oficina",
      deliveryTo: "Entrega a",
      collectionFrom: "Recogida en",
      afterHours: "Recargo por horario nocturno",
      free: "Gratis",
    };
  }
  return {
    rental: "Rental",
    childSeat: "Child seat",
    secondDriver: "Second driver",
    insurance: "Insurance",
    discount: "Discount",
    manualAdjustment: "Manual adjustment",
    unclassified: "Unclassified legacy adjustment",
    pickupOfficeFree: "Pickup at company office",
    returnOfficeFree: "Return at company office",
    bothOfficeFree: "Pickup and return at office",
    deliveryTo: "Delivery to",
    collectionFrom: "Collection from",
    afterHours: "After-hours",
    free: "Free",
  };
}

function extraLabel(row, t) {
  const code = String(row.code || "");
  if (code === "CHILD_SEATS") return t.childSeat;
  if (code === "SECOND_DRIVER") return t.secondDriver;
  const raw = String(row.label || "").toLowerCase();
  if (raw.includes("child")) return t.childSeat;
  if (raw.includes("second")) return t.secondDriver;
  return row.label || "Extras";
}

export function marketplaceDeliveryDisplayLines({
  locationSnapshot,
  pickupFeeMinor = 0,
  returnFeeMinor = 0,
  locale = "en",
} = {}) {
  const t = copyFor(locale);
  const pickup = locationSnapshot?.pickup || null;
  const ret = locationSnapshot?.return || locationSnapshot?.dropoff || null;
  const pickupOffice = pickup?.kind === LOCATION_KIND.OFFICE;
  const returnOffice = !ret || ret.kind === LOCATION_KIND.OFFICE;
  const pickupPaid = pickupFeeMinor > 0;
  const returnPaid = returnFeeMinor > 0;

  if (
    pickupOffice &&
    returnOffice &&
    !pickupPaid &&
    !returnPaid
  ) {
    return [
      {
        code: "OFFICE_BOTH",
        label: t.bothOfficeFree,
        minor: 0,
        free: true,
      },
    ];
  }

  const lines = [];
  if (pickupOffice && !pickupPaid) {
    lines.push({
      code: "PICKUP_OFFICE",
      label: t.pickupOfficeFree,
      minor: 0,
      free: true,
    });
  } else if (pickupPaid || pickup?.kind === LOCATION_KIND.DELIVERY) {
    const place = shortLocationLabel(pickup);
    lines.push({
      code: "PICKUP_DELIVERY",
      label: place ? `${t.deliveryTo} ${place}` : t.deliveryTo,
      minor: pickupFeeMinor,
      free: pickupFeeMinor === 0,
    });
  }

  if (returnOffice && !returnPaid) {
    lines.push({
      code: "RETURN_OFFICE",
      label: t.returnOfficeFree,
      minor: 0,
      free: true,
    });
  } else if (returnPaid || ret?.kind === LOCATION_KIND.DELIVERY) {
    const place = shortLocationLabel(ret);
    lines.push({
      code: "RETURN_DELIVERY",
      label: place ? `${t.collectionFrom} ${place}` : t.collectionFrom,
      minor: returnFeeMinor,
      free: returnFeeMinor === 0,
    });
  }

  return lines;
}

/**
 * @param {object} source order, quote, or { authoritativePrice, locationSnapshot, priceBreakdown, totalPrice }
 * @param {{ locale?: string }} [opts]
 */
export function reconcileAuthoritativePriceBreakdown(source = {}, opts = {}) {
  const locale = opts.locale || "en";
  const t = copyFor(locale);
  const auth = source.authoritativePrice || (source.grossMinor != null ? source : {});
  const snapshot = source.locationSnapshot || null;
  const breakdown = source.priceBreakdown || source.breakdown || null;
  const currency = String(auth.currency || source.currency || "EUR")
    .trim()
    .toUpperCase() || "EUR";

  const rentalMinor = firstMinor(auth.baseRentalMinor, majorToMinor(breakdown?.baseRentalTotal));
  const insuranceMinor = firstMinor(
    auth.insuranceMinor,
    majorToMinor(breakdown?.kaskoTotal)
  );
  const extras = extraLinesFromSource({ auth, breakdown });
  const extrasMinor = extras.reduce((sum, row) => sum + row.minor, 0);
  const pickupFeeMinor = firstMinor(
    auth.pickupFeeMinor,
    majorToMinor(snapshot?.pickup?.feeMajor),
    majorToMinor(breakdown?.deliveryIn)
  );
  const returnFeeMinor = firstMinor(
    auth.returnFeeMinor,
    majorToMinor(snapshot?.return?.feeMajor ?? snapshot?.dropoff?.feeMajor),
    majorToMinor(breakdown?.deliveryOut)
  );
  const afterHoursMinor = firstMinor(auth.afterHoursMinor);
  const discountMinor = firstMinor(auth.discountMinor, majorToMinor(breakdown?.discountMinor));
  const otherFeesMinor = firstMinor(auth.otherFeesMinor);
  const explicitManual = firstMinorOrNull(
    auth.manualAdjustmentMinor,
    source.manualAdjustmentMinor
  );

  const otherKnownCharges = [];
  if (afterHoursMinor > 0) {
    otherKnownCharges.push({
      code: "AFTER_HOURS",
      label: t.afterHours,
      minor: afterHoursMinor,
    });
  }
  if (otherFeesMinor > 0) {
    otherKnownCharges.push({
      code: "OTHER",
      label: "Other charges",
      minor: otherFeesMinor,
    });
  }

  const knownPositive =
    rentalMinor +
    extrasMinor +
    pickupFeeMinor +
    returnFeeMinor +
    insuranceMinor +
    afterHoursMinor +
    otherFeesMinor;
  const knownNet = knownPositive - (discountMinor > 0 ? discountMinor : 0);

  const storedTotalMinor = firstMinor(
    auth.grossMinor,
    majorToMinor(source.OverridePrice),
    majorToMinor(source.totalPrice),
    majorToMinor(breakdown?.totalPrice)
  );

  let manualAdjustmentMinor = explicitManual || 0;
  let unclassifiedLegacyMinor = 0;
  const remainder = storedTotalMinor - knownNet - manualAdjustmentMinor;
  if (remainder !== 0) {
    if (explicitManual != null) {
      manualAdjustmentMinor += remainder;
    } else if (source.priceCorrection === true || auth.manualAdjustmentMinor != null) {
      manualAdjustmentMinor += remainder;
    } else {
      unclassifiedLegacyMinor = remainder;
    }
  }

  const calculatedComponentsMinor =
    knownNet + manualAdjustmentMinor + unclassifiedLegacyMinor;
  const unexplainedDifferenceMinor = storedTotalMinor - calculatedComponentsMinor;
  const isDisplayReconciled = unexplainedDifferenceMinor === 0;
  const isReconciled =
    isDisplayReconciled && unclassifiedLegacyMinor === 0;

  const deliveryLines = marketplaceDeliveryDisplayLines({
    locationSnapshot: snapshot,
    pickupFeeMinor,
    returnFeeMinor,
    locale,
  });

  return {
    currency,
    rentalMinor,
    extras,
    extrasMinor,
    pickupFeeMinor,
    returnFeeMinor,
    afterHoursMinor,
    insuranceMinor,
    discountMinor,
    manualAdjustmentMinor,
    unclassifiedLegacyMinor,
    otherKnownCharges,
    deliveryLines,
    totalMinor: storedTotalMinor,
    calculatedComponentsMinor,
    unexplainedDifferenceMinor,
    isReconciled,
    isDisplayReconciled,
    platformFeeIsSplitNotCharge: true,
    labels: t,
  };
}

export function formatReconciledBreakdownRows(reconciliation, locale = "en") {
  const t = copyFor(locale);
  const rec = reconciliation || {};
  const rows = [];
  if (rec.rentalMinor > 0 || rec.totalMinor > 0) {
    rows.push({ code: "RENTAL", label: t.rental, minor: rec.rentalMinor || 0 });
  }
  for (const extra of rec.extras || []) {
    rows.push({
      code: extra.code,
      label: extraLabel(extra, t),
      minor: extra.minor,
    });
  }
  if (rec.insuranceMinor > 0) {
    rows.push({ code: "INSURANCE", label: t.insurance, minor: rec.insuranceMinor });
  }
  for (const line of rec.deliveryLines || []) {
    rows.push(line);
  }
  if (rec.discountMinor > 0) {
    rows.push({ code: "DISCOUNT", label: t.discount, minor: -rec.discountMinor });
  }
  for (const other of rec.otherKnownCharges || []) {
    rows.push(other);
  }
  if (rec.manualAdjustmentMinor) {
    rows.push({
      code: "MANUAL_ADJUSTMENT",
      label: t.manualAdjustment,
      minor: rec.manualAdjustmentMinor,
    });
  }
  if (rec.unclassifiedLegacyMinor) {
    rows.push({
      code: "UNCLASSIFIED_LEGACY",
      label: t.unclassified,
      minor: rec.unclassifiedLegacyMinor,
      legacy: true,
    });
  }
  return rows;
}

export function formatReconciledEuro(minor) {
  return formatMarketplaceEuro(minor);
}

function hasComponentFields(source = {}) {
  const auth = source.authoritativePrice || (source.grossMinor != null ? source : {});
  return (
    auth.baseRentalMinor != null ||
    auth.pickupFeeMinor != null ||
    auth.returnFeeMinor != null ||
    auth.extrasMinor != null ||
    auth.insuranceMinor != null ||
    (Array.isArray(auth.lines) && auth.lines.length > 0)
  );
}

function splitAddsUp(source = {}) {
  const auth = source.authoritativePrice || source;
  const gross = integerMinor(auth.grossMinor);
  const prepay = integerMinor(auth.prepaymentMinor ?? auth.platformAmountMinor);
  const balance = integerMinor(auth.balanceMinor ?? auth.supplierBalanceMinor);
  if (gross == null || prepay == null || balance == null) return null;
  return prepay + balance === gross;
}

export function assertAuthoritativePriceReconciled(source, opts = {}) {
  const breakdown = reconcileAuthoritativePriceBreakdown(source, opts);
  if (hasComponentFields(source)) {
    if (breakdown.isReconciled && breakdown.totalMinor >= 0) {
      return { ok: true, breakdown };
    }
    return {
      ok: false,
      code: PRICE_BREAKDOWN_MISMATCH,
      message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
      breakdown,
    };
  }
  const splitOk = splitAddsUp(source);
  if (splitOk === false) {
    return {
      ok: false,
      code: PRICE_BREAKDOWN_MISMATCH,
      message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
      breakdown,
    };
  }
  if (breakdown.totalMinor >= 0) {
    return { ok: true, breakdown, legacySplitOnly: true };
  }
  return {
    ok: false,
    code: PRICE_BREAKDOWN_MISMATCH,
    message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
    breakdown,
  };
}

export function logPriceBreakdownMismatch({
  orderId,
  companyId,
  breakdown,
  stage,
} = {}) {
  const rec = breakdown || {};
  console.error("[PRICE_BREAKDOWN_MISMATCH]", {
    stage: stage || "",
    orderId: orderId ? String(orderId) : "",
    companyId: companyId ? String(companyId) : "",
    rentalMinor: rec.rentalMinor,
    extrasMinor: rec.extrasMinor,
    pickupFeeMinor: rec.pickupFeeMinor,
    returnFeeMinor: rec.returnFeeMinor,
    insuranceMinor: rec.insuranceMinor,
    discountMinor: rec.discountMinor,
    manualAdjustmentMinor: rec.manualAdjustmentMinor,
    unclassifiedLegacyMinor: rec.unclassifiedLegacyMinor,
    totalMinor: rec.totalMinor,
    calculatedComponentsMinor: rec.calculatedComponentsMinor,
    unexplainedDifferenceMinor: rec.unexplainedDifferenceMinor,
  });
}

/**
 * Delivery slice for PriceBreakdown writes. Prefers stored Spain snapshot
 * fees so a Greece zone recalc cannot zero a known delivery line.
 */
export function deliverySliceFromStoredSnapshot(orderLike = {}) {
  const auth = orderLike.authoritativePrice;
  const snap = orderLike.locationSnapshot;
  if (auth && (auth.pickupFeeMinor != null || auth.returnFeeMinor != null)) {
    const deliveryIn = (integerMinor(auth.pickupFeeMinor) || 0) / 100;
    const deliveryOut = (integerMinor(auth.returnFeeMinor) || 0) / 100;
    return {
      deliveryIn,
      deliveryOut,
      deliveryTotal: deliveryIn + deliveryOut,
      placeIn: orderLike.placeIn || "",
      placeOut: orderLike.placeOut || "",
    };
  }
  if (snap?.pickup || snap?.return) {
    const deliveryIn = Number(snap.pickup?.feeMajor) || 0;
    const deliveryOut = Number(snap.return?.feeMajor ?? snap.dropoff?.feeMajor) || 0;
    return {
      deliveryIn,
      deliveryOut,
      deliveryTotal: deliveryIn + deliveryOut,
      placeIn: orderLike.placeIn || "",
      placeOut: orderLike.placeOut || "",
    };
  }
  return null;
}
