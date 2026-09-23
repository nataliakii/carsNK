/**
 * Parse customer location payload. Client lat/lon/fee/distance are ignored.
 */
export function parseLocationQuoteInput(body = {}) {
  const loc = body.location && typeof body.location === "object" ? body.location : {};
  const pickup = loc.pickup && typeof loc.pickup === "object" ? loc.pickup : {};
  const dropoff =
    loc.return && typeof loc.return === "object"
      ? loc.return
      : loc.dropoff && typeof loc.dropoff === "object"
        ? loc.dropoff
        : {};

  return {
    pickup: {
      kind: String(pickup.kind || body.pickupMethod || "").trim().toLowerCase(),
      officeId: String(pickup.officeId || body.pickupOfficeId || "").trim(),
      placeId: String(
        pickup.placeId || body.pickupPlaceId || body.placeInId || ""
      ).trim(),
    },
    dropoff: {
      kind: String(dropoff.kind || body.returnMethod || "").trim().toLowerCase(),
      officeId: String(dropoff.officeId || body.returnOfficeId || "").trim(),
      placeId: String(
        dropoff.placeId || body.returnPlaceId || body.placeOutId || ""
      ).trim(),
      sameAsPickup: Boolean(dropoff.sameAsPickup ?? body.sameReturnLocation),
    },
  };
}
