import { normalizeDrivingLicenceUrls } from "./normalizeDrivingLicenceUrls";

/**
 * Public booking-request creates must not persist client licence URLs.
 * Admin creates may keep normalized Cloudinary URLs.
 */
export function resolveCreateDrivingLicenceUrls({ isAdminSession, raw }) {
  if (!isAdminSession) return [];
  return normalizeDrivingLicenceUrls(raw);
}

/**
 * Public creates ignore client totalPrice and use server rental + delivery.
 * Admin creates may keep an explicit client total when it is > 0.
 */
export function resolveCreateTotalPrice({
  isAdminSession,
  clientTotalPrice,
  rentalTotal,
  deliveryTotal = 0,
}) {
  const rental = Number(rentalTotal);
  const delivery = Number(deliveryTotal);
  const serverTotal =
    Math.round(
      ((Number.isFinite(rental) ? rental : 0) +
        (Number.isFinite(delivery) ? delivery : 0)) *
        100
    ) / 100;

  if (
    isAdminSession &&
    typeof clientTotalPrice === "number" &&
    clientTotalPrice > 0
  ) {
    return clientTotalPrice;
  }

  return serverTotal;
}
