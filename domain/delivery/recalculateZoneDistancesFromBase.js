import { DeliveryZone } from "@models/DeliveryZone";
import { toGooglePlaceQuery } from "@/domain/transfers/transferLocations";
import { getDistancesFromBaseToDestinations } from "@/domain/transfers/getTransferDistance";

function destinationQueryForZone(zone) {
  const lat = Number(zone?.coordinates?.lat);
  const lng = Number(zone?.coordinates?.lng);
  if (
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  ) {
    return `${lat},${lng}`;
  }
  return toGooglePlaceQuery(zone?.name);
}

/**
 * Recalculate DeliveryZone.distanceKm from company base coordinates.
 * @param {{ lat: unknown, lon?: unknown, lng?: unknown }} baseCoords
 */
export async function recalculateZoneDistancesFromBase(baseCoords) {
  const zones = await DeliveryZone.find().lean();
  if (!zones.length) {
    return { updated: [], failed: [] };
  }

  const destinations = zones.map((zone) => ({
    id: String(zone._id),
    name: zone.name,
    query: destinationQueryForZone(zone),
  }));

  const results = await getDistancesFromBaseToDestinations({
    baseCoords,
    destinations,
  });

  const bulk = [];
  const updated = [];
  const failed = [];

  for (const zone of zones) {
    const id = String(zone._id);
    const result = results[id];
    if (result?.ok && Number.isFinite(result.distanceKm) && result.distanceKm >= 0) {
      bulk.push({
        updateOne: {
          filter: { _id: zone._id },
          update: { $set: { distanceKm: result.distanceKm } },
        },
      });
      updated.push({
        id,
        name: zone.name,
        distanceKm: result.distanceKm,
        approximate: Boolean(result.approximate),
      });
    } else {
      failed.push({
        id,
        name: zone.name,
        message: result?.message || "Distance from base unavailable",
      });
    }
  }

  if (bulk.length > 0) {
    await DeliveryZone.bulkWrite(bulk, { ordered: false });
  }

  return { updated, failed };
}
