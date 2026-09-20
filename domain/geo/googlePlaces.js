import {
  redactSecretsForLog,
  sanitizeProviderErrorMessage,
} from "@/domain/transfers/sanitizeProviderError";

const GOOGLE_PLACES_TIMEOUT_MS = Number(
  process.env.GOOGLE_PLACES_TIMEOUT_MS || 8000
);
const PLACES_DENIED_COOLDOWN_MS = 10 * 60 * 1000;

/** Skip further Google calls after REQUEST_DENIED (referer-restricted key, etc.). */
let placesDeniedUntil = 0;

function getMapsApiKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

export function isGooglePlacesConfigured() {
  if (Date.now() < placesDeniedUntil) return false;
  return Boolean(getMapsApiKey());
}

export function resetGooglePlacesDeniedState() {
  placesDeniedUntil = 0;
}

function markPlacesDenied() {
  placesDeniedUntil = Date.now() + PLACES_DENIED_COOLDOWN_MS;
}

function placesDeniedResponse(message) {
  return {
    ok: false,
    configured: false,
    unavailable: true,
    predictions: [],
    message:
      message ||
      "Places API denied this server key (need an unrestricted server key)",
  };
}

async function fetchGoogleJson(url, timeoutMs = GOOGLE_PLACES_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }
}

/** Prediction filters accepted by the legacy Autocomplete endpoint. */
export const PLACE_AUTOCOMPLETE_TYPES = [
  "address",
  "(cities)",
  "(regions)",
  "geocode",
  "establishment",
];

export function normalizePlaceAutocompleteTypes(value, fallback = "address") {
  if (value === "" || value == null) {
    const fb = String(fallback || "").trim();
    return PLACE_AUTOCOMPLETE_TYPES.includes(fb) ? fb : "";
  }
  const raw = String(value || "").trim();
  return PLACE_AUTOCOMPLETE_TYPES.includes(raw) ? raw : fallback;
}

/**
 * Google Places Autocomplete (legacy HTTP) via server key.
 * Requires Places API enabled on the Google Cloud project.
 *
 * @param {{ input: string, country?: string, language?: string, sessionToken?: string, types?: string }} params
 */
export async function fetchPlaceAutocomplete({
  input,
  country,
  language = "en",
  sessionToken,
  types,
} = {}) {
  const q = String(input || "").trim();
  if (q.length < 2) {
    return { ok: true, predictions: [], configured: isGooglePlacesConfigured() };
  }

  if (Date.now() < placesDeniedUntil) {
    return placesDeniedResponse();
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      predictions: [],
      message: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json"
  );
  url.searchParams.set("input", q);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", language || "en");
  const typeFilter = normalizePlaceAutocompleteTypes(types, "");
  if (typeFilter) {
    url.searchParams.set("types", typeFilter);
  }
  if (country) {
    url.searchParams.set(
      "components",
      `country:${String(country).trim().toLowerCase()}`
    );
  }
  if (sessionToken) {
    url.searchParams.set("sessiontoken", String(sessionToken));
  }

  try {
    const data = await fetchGoogleJson(url);
    if (data.status === "REQUEST_DENIED") {
      markPlacesDenied();
      console.warn(
        "[places] autocomplete REQUEST_DENIED",
        redactSecretsForLog(data.error_message || "")
      );
      return placesDeniedResponse(
        sanitizeProviderErrorMessage(
          data.error_message || "Places autocomplete denied"
        )
      );
    }
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn(
        "[places] autocomplete status:",
        data.status,
        redactSecretsForLog(data.error_message || "")
      );
      return {
        ok: false,
        configured: true,
        unavailable: true,
        predictions: [],
        message: sanitizeProviderErrorMessage(
          data.error_message || data.status || "Places autocomplete failed"
        ),
      };
    }
    const predictions = (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || "",
    }));
    return { ok: true, configured: true, predictions };
  } catch (err) {
    console.error(
      "[places] autocomplete error:",
      redactSecretsForLog(err?.message || err)
    );
    return {
      ok: false,
      configured: true,
      unavailable: true,
      predictions: [],
      message: sanitizeProviderErrorMessage(err?.message || "Places request failed"),
    };
  }
}

/**
 * Place Details → formatted address + lat/lng.
 */
export async function fetchPlaceDetails({
  placeId,
  language = "en",
  sessionToken,
} = {}) {
  const id = String(placeId || "").trim();
  if (!id) {
    return { ok: false, message: "placeId is required" };
  }

  if (Date.now() < placesDeniedUntil) {
    return placesDeniedResponse();
  }

  const apiKey = getMapsApiKey();
  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      message: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/details/json"
  );
  url.searchParams.set("place_id", id);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", language || "en");
  url.searchParams.set("fields", "formatted_address,geometry,name,address_component");
  if (sessionToken) {
    url.searchParams.set("sessiontoken", String(sessionToken));
  }

  try {
    const data = await fetchGoogleJson(url);
    if (data.status === "REQUEST_DENIED") {
      markPlacesDenied();
      return placesDeniedResponse(
        sanitizeProviderErrorMessage(
          data.error_message || "Place details denied"
        )
      );
    }
    if (data.status && data.status !== "OK") {
      return {
        ok: false,
        configured: true,
        message: sanitizeProviderErrorMessage(
          data.error_message || data.status || "Place details failed"
        ),
      };
    }
    const result = data.result || {};
    const lat = Number(result.geometry?.location?.lat);
    const lon = Number(result.geometry?.location?.lng);
    const components = Array.isArray(result.address_components)
      ? result.address_components
      : [];
    const findComponent = (type) => {
      const row = components.find((c) =>
        Array.isArray(c.types) && c.types.includes(type)
      );
      return row ? String(row.long_name || row.short_name || "").trim() : "";
    };
    const locality =
      findComponent("locality") ||
      findComponent("postal_town") ||
      findComponent("administrative_area_level_2") ||
      "";
    return {
      ok: true,
      configured: true,
      placeId: id,
      address: String(result.formatted_address || result.name || "").trim(),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      locality,
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: sanitizeProviderErrorMessage(err?.message || "Place details failed"),
    };
  }
}
