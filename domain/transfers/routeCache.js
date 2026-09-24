import TransferRouteCache, {
  defaultRouteCacheTtlMs,
} from "@models/TransferRouteCache";
import { getTransferDistance } from "@/domain/transfers/getTransferDistance";
import {
  locationCacheKeyPart,
  locationDisplayName,
} from "@/domain/transfers/locationSnapshot";
import { getSiteCountryCode } from "@config/siteCountry";

/**
 * Stable cache key for a driving route between two normalised locations.
 */
export function buildRouteCacheKey(origin, destination, { mode = "driving" } = {}) {
  return [
    mode,
    locationCacheKeyPart(origin),
    locationCacheKeyPart(destination),
  ].join("|");
}

/**
 * Server-side route calculation with DB cache.
 * Never prices from straight-line distance.
 */
export async function getCachedDrivingRoute({
  origin,
  destination,
  fromLabel,
  toLabel,
  skipCache = false,
}) {
  const originLabel =
    fromLabel || locationDisplayName(origin) || String(origin?.rawInput || "");
  const destLabel =
    toLabel ||
    locationDisplayName(destination) ||
    String(destination?.rawInput || "");

  if (!originLabel || !destLabel) {
    return { ok: false, message: "origin and destination are required" };
  }

  const cacheKey = buildRouteCacheKey(
    origin || { placeName: originLabel },
    destination || { placeName: destLabel }
  );

  // Poisoned keys from Number(null)===0 — never reuse Null Island routes.
  const cachePoisoned = /(?:^|\|)geo:0(?:\.0+)?,\s*0(?:\.0+)?(?:\||$)/.test(
    cacheKey
  );

  if (!skipCache && !cachePoisoned) {
    const cached = await TransferRouteCache.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (cached) {
      return {
        ok: true,
        distanceKm: cached.distanceKm,
        durationMinutes: cached.durationMinutes,
        provider: cached.provider,
        calculatedAt: cached.calculatedAt,
        cacheKey,
        tollsMinor: cached.tollsMinor,
        warnings: cached.warnings || [],
        approximate: Boolean(cached.approximate),
        fromCache: true,
        originCoords: { lat: cached.originLat, lng: cached.originLng },
        destinationCoords: {
          lat: cached.destinationLat,
          lng: cached.destinationLng,
        },
      };
    }
  } else if (cachePoisoned) {
    TransferRouteCache.deleteMany({
      cacheKey: { $regex: /geo:0(\.0+)?,0(\.0+)?/ },
    }).catch(() => {});
  }

  const computed = await getTransferDistance({
    from: originLabel,
    to: destLabel,
    country:
      origin?.country ||
      destination?.country ||
      getSiteCountryCode() ||
      undefined,
  });
  if (!computed.ok) {
    return computed;
  }

  const calculatedAt = new Date();
  const expiresAt = new Date(calculatedAt.getTime() + defaultRouteCacheTtlMs());
  const originLat = origin?.lat ?? null;
  const originLng = origin?.lng ?? null;
  const destinationLat = destination?.lat ?? null;
  const destinationLng = destination?.lng ?? null;

  try {
    await TransferRouteCache.findOneAndUpdate(
      { cacheKey },
      {
        $set: {
          cacheKey,
          originLat,
          originLng,
          destinationLat,
          destinationLng,
          originLabel,
          destinationLabel: destLabel,
          distanceKm: computed.distanceKm,
          durationMinutes: computed.durationMinutes ?? null,
          provider: computed.approximate
            ? "catalog_estimate"
            : "google_distance_matrix",
          tollsMinor: null,
          warnings: computed.approximate
            ? ["approximate_catalog_fallback"]
            : [],
          approximate: Boolean(computed.approximate),
          calculatedAt,
          expiresAt,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn("[transfer route cache] write failed", err?.message || err);
  }

  return {
    ok: true,
    distanceKm: computed.distanceKm,
    durationMinutes: computed.durationMinutes,
    provider: computed.approximate
      ? "catalog_estimate"
      : "google_distance_matrix",
    calculatedAt,
    cacheKey,
    tollsMinor: null,
    warnings: computed.approximate ? ["approximate_catalog_fallback"] : [],
    approximate: Boolean(computed.approximate),
    fromCache: false,
    originCoords: { lat: originLat, lng: originLng },
    destinationCoords: { lat: destinationLat, lng: destinationLng },
  };
}
