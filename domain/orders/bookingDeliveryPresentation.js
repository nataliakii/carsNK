function formatEuroAmount(value, locale) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  const roundedValue = Math.round(numericValue * 100) / 100;
  return new Intl.NumberFormat(locale || undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(roundedValue);
}

export function buildDeliveryHelperText({
  locationValue,
  deliveryCost,
  locale,
  deliveryLabel,
  isLoading = false,
  hideWhenZero = false,
}) {
  if (!String(locationValue || "").trim()) return "";
  if (isLoading) return "";
  if (!deliveryLabel) return "";
  if (deliveryCost === null || deliveryCost === undefined) return "";

  const numericDeliveryCost = Number(deliveryCost);
  if (!Number.isFinite(numericDeliveryCost) || numericDeliveryCost < 0) {
    return "";
  }
  if (hideWhenZero && numericDeliveryCost === 0) {
    return "";
  }

  return `${deliveryLabel} – ${formatEuroAmount(numericDeliveryCost, locale)} €`;
}
