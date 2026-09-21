/**
 * Default insurance for catalog/search quotes and the booking form.
 *
 * TPL is always available (typically free). CDW is included only when the car
 * has a priced CDW (`PriceKacko` > 0) — the same payload BookingModal should
 * send to calculateTotalPrice before the customer changes extras.
 */

export function resolveDefaultInsurance(car) {
  const cdwPerDay = Number(car?.PriceKacko);
  if (Number.isFinite(cdwPerDay) && cdwPerDay > 0) return "CDW";
  return "TPL";
}
