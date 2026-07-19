import { toGooglePlaceQuery } from "@/domain/transfers/transferLocations";

/**
 * Driving distance via Google Distance Matrix API.
 * Requires GOOGLE_MAPS_API_KEY (server-only).
 *
 * @param {{ from: string, to: string }} params
 * @returns {Promise<{
 *   ok: boolean,
 *   distanceKm?: number,
 *   durationMinutes?: number,
 *   distanceText?: string,
 *   durationText?: string,
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
    };
  }

  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  if (!apiKey) {
    return {
      ok: false,
      message: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  const origins = toGooglePlaceQuery(originName);
  const destinations = toGooglePlaceQuery(destName);
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

  const element = payload?.rows?.[0]?.elements?.[0];
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
  };
}

export default getTransferDistance;
