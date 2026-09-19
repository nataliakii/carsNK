/**
 * Resolve booking mode, timezone, currency, and country once for a rental.
 * Domain layer does not read hostname; callers pass company / city / country.
 */

import { getSiteCountryCode } from "@config/siteCountry";
import {
  BOOKING_MODES,
  resolveBookingMode,
} from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { resolveCurrency } from "@/domain/orders/rentalPricingService";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";

export function resolveRentalBookingContext({
  order,
  company,
  city,
  countryCode,
  platformSettings,
  forNewOrder = false,
} = {}) {
  const country =
    String(countryCode || company?.country || "").trim().toUpperCase() ||
    (forNewOrder ? getSiteCountryCode() : "GR");

  const bookingMode = resolveBookingMode({
    order,
    company,
    platformSettings,
    countryCode: country,
    forNewOrder,
  });

  const timezone = resolveBusinessTimezone({
    order,
    company,
    city,
    countryCode: country,
    platformSettings,
    forNewOrder,
  });

  const currency =
    String(order?.currency || company?.currency || "")
      .trim()
      .toUpperCase() || resolveCurrency();

  const initialBookingStatus =
    forNewOrder && bookingMode === BOOKING_MODES.MARKETPLACE_REQUEST
      ? BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
      : undefined;

  return {
    countryCode: country,
    bookingMode,
    timezone,
    currency,
    initialBookingStatus,
  };
}
