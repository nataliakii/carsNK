function roundCurrency(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(numericValue * 100) / 100;
}

function buildBookingPriceSummaryFromNormalizedInput({
  days,
  rentalPrice,
  breakdown,
}) {
  const normalizedDays = Number(days);
  const normalizedRentalPrice = roundCurrency(rentalPrice);
  const rawPickupDeliveryCost = Number(breakdown?.deliveryIn);
  const hasPickupDeliveryCost =
    breakdown?.deliveryIn !== undefined &&
    breakdown?.deliveryIn !== null &&
    Number.isFinite(rawPickupDeliveryCost);
  const pickupDeliveryCost = hasPickupDeliveryCost
    ? roundCurrency(rawPickupDeliveryCost)
    : null;
  const rawReturnDeliveryCost = Number(breakdown?.deliveryOut);
  const hasReturnDeliveryCost =
    breakdown?.deliveryOut !== undefined &&
    breakdown?.deliveryOut !== null &&
    Number.isFinite(rawReturnDeliveryCost);
  const returnDeliveryCost = hasReturnDeliveryCost
    ? roundCurrency(rawReturnDeliveryCost)
    : null;
  const rawDeliveryCost = Number(breakdown?.deliveryTotal);
  const hasDeliveryCost =
    breakdown?.deliveryTotal !== undefined &&
    breakdown?.deliveryTotal !== null &&
    Number.isFinite(rawDeliveryCost);
  const deliveryCost = hasDeliveryCost ? roundCurrency(rawDeliveryCost) : null;

  return {
    days:
      Number.isFinite(normalizedDays) && normalizedDays > 0
        ? normalizedDays
        : 0,
    rentalPrice: normalizedRentalPrice,
    deliveryCost,
    pickupDeliveryCost,
    returnDeliveryCost,
    totalPrice: roundCurrency(normalizedRentalPrice + (deliveryCost ?? 0)),
    deliveryStatus: hasDeliveryCost ? "ready" : "unavailable",
  };
}

export function createEmptyBookingPriceSummary() {
  return {
    days: 0,
    rentalPrice: 0,
    deliveryCost: null,
    pickupDeliveryCost: null,
    returnDeliveryCost: null,
    totalPrice: 0,
    deliveryStatus: "unavailable",
  };
}

export function buildBookingPriceSummary(result) {
  if (!result || typeof result !== "object") {
    return createEmptyBookingPriceSummary();
  }

  return buildBookingPriceSummaryFromNormalizedInput({
    days: result.days,
    rentalPrice: result.totalPrice,
    breakdown: result.breakdown,
  });
}

export function buildBookingPriceSummaryFromBreakdown({
  days = 0,
  rentalPrice = 0,
  breakdown = null,
} = {}) {
  if (!breakdown || typeof breakdown !== "object") {
    return buildBookingPriceSummaryFromNormalizedInput({
      days,
      rentalPrice,
      breakdown: null,
    });
  }

  return buildBookingPriceSummaryFromNormalizedInput({
    days,
    rentalPrice,
    breakdown,
  });
}
