import {
  toGooglePlaceQuery,
  estimateTransferDistanceFromCatalog,
  getCuratedDistanceKm,
} from "@/domain/transfers/transferLocations";

/**
 * Driving distance via Google Distance Matrix API.
 * Requires GOOGLE_MAPS_API_KEY (server-only) with Distance Matrix enabled
 * and IP (or no) restrictions — HTTP referrer keys will be rejected.
 *
 * Falls back to curated delivery-locations distances when Google fails.
 *
 * @param {{ from: string, to: string }} params
 * @returns {Promise<{
 *   ok: boolean,
 *   distanceKm?: number,
 *   durationMinutes?: number,
 *   distanceText?: string,
 *   durationText?: string,
 *   approximate?: boolean,
 *   message?: string,
 * }>}
 */
export async function getTransferDistance({ from, to }) {
  const originName = String(from || "").trim();
  const destName = String(to || "").trim();
  if (!originName || !destName) {
    return { ok: false, message: "from and to are required" };
  }
  if (originName.toLowerCase() === destName.toLowerCase()) {
    return {
      ok: true,
      distanceKm: 0,
      durationMinutes: 0,
      distanceText: "0 km",
      durationText: "0 min",
      approximate: false,
    };
  }

  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (apiKey) {
    const google = await fetchGoogleDistance(originName, destName, apiKey);
    if (google.ok) return google;
  }

  const estimate = estimateTransferDistanceFromCatalog(originName, destName);
  if (estimate.ok) {
    return {
      ok: true,
      distanceKm: estimate.distanceKm,
      durationMinutes: estimate.durationMinutes,
      distanceText: `~${estimate.distanceKm} km`,
      durationText: `~${estimate.durationMinutes} min`,
      approximate: true,
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      message: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  return {
    ok: false,
    message:
      "Distance unavailable. Use a server Google Maps key (Distance Matrix API, IP restriction — not HTTP referrer).",
  };
}

export async function getDistanceFromBase({ baseCoords, place }) {
  const placeName = String(place || "").trim();
  if (!placeName) {
    return { ok: false, message: "place is required" };
  }

  const lat = Number(baseCoords?.lat);
  const lon = Number(baseCoords?.lon ?? baseCoords?.lng);
  const hasBaseCoords =
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180;

  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (apiKey && hasBaseCoords) {
    const google = await fetchGoogleDistanceQuery(
      `${lat},${lon}`,
      toGooglePlaceQuery(placeName),
      apiKey
    );
    if (google.ok) return google;
  }

  const curatedKm = getCuratedDistanceKm(placeName);
  if (curatedKm != null) {
    return {
      ok: true,
      distanceKm: curatedKm,
      durationMinutes: Math.max(5, Math.round((Math.max(curatedKm, 1) / 55) * 60)),
      distanceText: `~${curatedKm} km`,
      durationText: undefined,
      approximate: true,
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      message: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  if (!hasBaseCoords) {
    return {
      ok: false,
      message: "Base coordinates are not configured",
    };
  }

  return {
    ok: false,
    message: "Distance from base unavailable",
  };
}

export async function getTransferBaseDistances({ baseCoords, from, to }) {
  const [baseToFrom, baseToTo] = await Promise.all([
    getDistanceFromBase({ baseCoords, place: from }),
    getDistanceFromBase({ baseCoords, place: to }),
  ]);

  return { baseToFrom, baseToTo };
}

async function fetchGoogleDistance(originName, destName, apiKey) {
  return fetchGoogleDistanceQuery(
    toGooglePlaceQuery(originName),
    toGooglePlaceQuery(destName),
    apiKey
  );
}

const MATRIX_DESTINATION_BATCH = 25;

function parseDistanceElement(element) {
  if (!element || element.status !== "OK") {
    return {
      ok: false,
      message: element?.status
        ? `Route not found (${element.status})`
        : "Route not found",
    };
  }

  const meters = Number(element.distance?.value);
  const seconds = Number(element.duration?.value);
  if (!Number.isFinite(meters) || meters < 0) {
    return { ok: false, message: "Invalid distance from Google" };
  }

  return {
    ok: true,
    distanceKm: Math.round((meters / 1000) * 10) / 10,
    durationMinutes: Number.isFinite(seconds)
      ? Math.max(1, Math.round(seconds / 60))
      : undefined,
    distanceText: element.distance?.text || undefined,
    durationText: element.duration?.text || undefined,
    approximate: false,
  };
}

async function fetchGoogleDistanceMatrix(origins, destinations, apiKey) {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json"
  );
  url.searchParams.set("origins", origins);
  url.searchParams.set("destinations", destinations);
  url.searchParams.set("units", "metric");
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", apiKey);

  let payload;
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    payload = await res.json();
  } catch (err) {
    return {
      ok: false,
      message: err?.message || "Distance request failed",
    };
  }

  if (payload?.status && payload.status !== "OK") {
    return {
      ok: false,
      message: payload.error_message || `Google status: ${payload.status}`,
    };
  }

  const elements = payload?.rows?.[0]?.elements;
  if (!Array.isArray(elements) || elements.length === 0) {
    return { ok: false, message: "Route not found" };
  }

  return { ok: true, elements };
}

async function fetchGoogleDistanceQuery(origins, destinations, apiKey) {
  const matrix = await fetchGoogleDistanceMatrix(origins, destinations, apiKey);
  if (!matrix.ok) return matrix;
  return parseDistanceElement(matrix.elements[0]);
}

/**
 * Driving distances from base coordinates to many destinations (Google Matrix + catalog fallback).
 * @param {{
 *   baseCoords: { lat?: unknown, lon?: unknown, lng?: unknown },
 *   destinations: { id: string, query: string, name?: string }[],
 * }} params
 * @returns {Promise<Record<string, { ok: boolean, distanceKm?: number, approximate?: boolean, message?: string }>>}
 */
export async function getDistancesFromBaseToDestinations({
  baseCoords,
  destinations,
}) {
  const byId = {};
  const list = Array.isArray(destinations) ? destinations : [];
  if (list.length === 0) return byId;

  const lat = Number(baseCoords?.lat);
  const lon = Number(baseCoords?.lon ?? baseCoords?.lng);
  const hasBaseCoords =
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lon) &&
    lon >= -180 &&
    lon <= 180;

  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  const origin = `${lat},${lon}`;
  const pending = [...list];

  if (apiKey && hasBaseCoords) {
    for (let i = 0; i < pending.length; i += MATRIX_DESTINATION_BATCH) {
      const batch = pending.slice(i, i + MATRIX_DESTINATION_BATCH);
      const destinationsParam = batch.map((item) => item.query).join("|");
      const matrix = await fetchGoogleDistanceMatrix(
        origin,
        destinationsParam,
        apiKey
      );
      if (!matrix.ok) continue;
      batch.forEach((item, index) => {
        byId[item.id] = parseDistanceElement(matrix.elements[index]);
      });
    }
  }

  for (const item of list) {
    if (byId[item.id]?.ok) continue;
    const placeName = String(item.name || item.query || "").trim();
    const curatedKm = getCuratedDistanceKm(placeName);
    if (curatedKm != null) {
      byId[item.id] = {
        ok: true,
        distanceKm: curatedKm,
        approximate: true,
      };
      continue;
    }
    byId[item.id] = byId[item.id] || {
      ok: false,
      message: !apiKey
        ? "GOOGLE_MAPS_API_KEY is not configured"
        : !hasBaseCoords
          ? "Base coordinates are not configured"
          : "Distance from base unavailable",
    };
  }

  return byId;
}

export default getTransferDistance;
