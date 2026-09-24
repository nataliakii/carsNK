import { persistedOfficeId } from "@/domain/orders/orderCreateContract";

function legKind(leg, fallback) {
  return String(leg?.kind || leg?.method || fallback || "")
    .trim()
    .toLowerCase();
}

/**
 * Parse customer location payload. Client lat/lon/fee/distance are ignored.
 * `method: "OFFICE"` and `kind: "office"` are the same.
 * Same-return office bookings copy the pickup office id.
 */
export function parseLocationQuoteInput(body = {}) {
  const loc = body.location && typeof body.location === "object" ? body.location : {};
  const pickupSource =
    (loc.pickup && typeof loc.pickup === "object" && loc.pickup) ||
    (body.pickup && typeof body.pickup === "object" && body.pickup) ||
    {};
  const dropoffSource =
    (loc.return && typeof loc.return === "object" && loc.return) ||
    (loc.dropoff && typeof loc.dropoff === "object" && loc.dropoff) ||
    (body.return && typeof body.return === "object" && body.return) ||
    (body.dropoff && typeof body.dropoff === "object" && body.dropoff) ||
    {};
  const pickup = pickupSource;
  const dropoff = dropoffSource;

  const pickupKind = legKind(pickup, body.pickupMethod);
  const sameAsPickup = Boolean(dropoff.sameAsPickup ?? body.sameReturnLocation);
  const pickupOfficeId = persistedOfficeId(
    pickup.officeId || body.pickupOfficeId
  );
  let dropoffKind = legKind(dropoff, body.returnMethod);
  let dropoffOfficeId = persistedOfficeId(
    dropoff.officeId || body.returnOfficeId
  );
  if (sameAsPickup && pickupKind === "office") {
    dropoffKind = "office";
    dropoffOfficeId = dropoffOfficeId || pickupOfficeId;
  }

  return {
    pickup: {
      kind: pickupKind,
      officeId: pickupOfficeId,
      placeId: String(
        pickup.placeId || body.pickupPlaceId || body.placeInId || ""
      ).trim(),
      cityName: String(pickup.cityName || body.placeIn || "").trim(),
    },
    dropoff: {
      kind: dropoffKind,
      officeId: dropoffOfficeId,
      placeId: sameAsPickup
        ? String(pickup.placeId || body.pickupPlaceId || body.placeInId || "").trim()
        : String(
            dropoff.placeId || body.returnPlaceId || body.placeOutId || ""
          ).trim(),
      cityName: String(
        (sameAsPickup ? pickup.cityName : dropoff.cityName) ||
          (sameAsPickup ? body.placeIn : body.placeOut) ||
          ""
      ).trim(),
      sameAsPickup,
    },
  };
}
