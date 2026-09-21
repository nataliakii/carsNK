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

async function fetchGoogleJson(url, { timeoutMs = GOOGLE_PLACES_TIMEOUT_MS, method = "GET", headers, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers,
      body,
    });
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }
}

function googleErrorMessage(data) {
  return (
    data?.error_message ||
    data?.error?.message ||
    data?.status ||
    data?.error?.status ||
    ""
  );
}

function isPlacesPermissionDenied(data) {
  const status = String(data?.status || data?.error?.status || "").toUpperCase();
  if (status === "REQUEST_DENIED" || status === "PERMISSION_DENIED") return true;
  const code = Number(data?.error?.code);
  return code === 403;
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

function mapLegacyPredictions(data) {
  return (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text || p.description,
    secondaryText: p.structured_formatting?.secondary_text || "",
  }));
}

function mapNewPredictions(data) {
  return (data.suggestions || [])
    .map((row) => row?.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      description: p.text?.text || "",
      mainText: p.structuredFormat?.mainText?.text || p.text?.text || "",
      secondaryText: p.structuredFormat?.secondaryText?.text || "",
    }));
}

async function fetchLegacyAutocomplete({ q, country, language, sessionToken, types, apiKey }) {
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
  const data = await fetchGoogleJson(url);
  return { data, predictions: mapLegacyPredictions(data) };
}

async function fetchNewAutocomplete({ q, country, language, sessionToken, apiKey }) {
  const body = {
    input: q,
    languageCode: language || "en",
  };
  if (country) {
    body.includedRegionCodes = [String(country).trim().toLowerCase()];
  }
  if (sessionToken) {
    body.sessionToken = String(sessionToken);
  }
  const data = await fetchGoogleJson(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
    }
  );
  return { data, predictions: mapNewPredictions(data) };
}

/**
 * Google Places Autocomplete via server key.
 * Tries Places API (New), then legacy HTTP, so either GCP API being enabled works.
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

  const params = { q, country, language, sessionToken, types, apiKey };
  try {
    const neu = await fetchNewAutocomplete(params);
    const newDenied = isPlacesPermissionDenied(neu.data);
    if (!newDenied && Array.isArray(neu.data.suggestions)) {
      return { ok: true, configured: true, predictions: neu.predictions };
    }

    const legacy = await fetchLegacyAutocomplete(params);
    if (legacy.data.status === "OK" || legacy.data.status === "ZERO_RESULTS") {
      return { ok: true, configured: true, predictions: legacy.predictions };
    }

    const legacyDenied = isPlacesPermissionDenied(legacy.data);
    if (newDenied && legacyDenied) {
      markPlacesDenied();
      console.warn(
        "[places] autocomplete REQUEST_DENIED",
        redactSecretsForLog(googleErrorMessage(legacy.data) || googleErrorMessage(neu.data))
      );
      return placesDeniedResponse(
        sanitizeProviderErrorMessage(
          googleErrorMessage(legacy.data) ||
            googleErrorMessage(neu.data) ||
            "Places autocomplete denied"
        )
      );
    }

    if (legacy.data.status && !legacyDenied) {
      console.warn(
        "[places] autocomplete status:",
        legacy.data.status,
        redactSecretsForLog(googleErrorMessage(legacy.data))
      );
    }

    return {
      ok: false,
      configured: true,
      unavailable: true,
      predictions: [],
      message: sanitizeProviderErrorMessage(
        googleErrorMessage(legacy.data) ||
          googleErrorMessage(neu.data) ||
          "Places autocomplete failed"
      ),
    };
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

  try {
    const newUrl = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`
    );
    if (language) newUrl.searchParams.set("languageCode", language);
    const neu = await fetchGoogleJson(newUrl, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "formattedAddress,location,addressComponents,displayName",
      },
    });
    const newDenied = isPlacesPermissionDenied(neu);
    if (!newDenied && !neu.error && (neu.formattedAddress || neu.location)) {
      return mapNewPlaceDetails(id, neu);
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
    const data = await fetchGoogleJson(url);
    if (data.status === "OK") {
      return mapLegacyPlaceDetails(id, data.result || {});
    }

    const legacyDenied = isPlacesPermissionDenied(data);
    if (newDenied && legacyDenied) {
      markPlacesDenied();
      return placesDeniedResponse(
        sanitizeProviderErrorMessage(
          googleErrorMessage(data) || googleErrorMessage(neu) || "Place details denied"
        )
      );
    }
    return {
      ok: false,
      configured: true,
      message: sanitizeProviderErrorMessage(
        googleErrorMessage(data) || googleErrorMessage(neu) || "Place details failed"
      ),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: sanitizeProviderErrorMessage(err?.message || "Place details failed"),
    };
  }
}

function mapNewPlaceDetails(id, result) {
  const lat = Number(result.location?.latitude);
  const lon = Number(result.location?.longitude);
  const components = Array.isArray(result.addressComponents)
    ? result.addressComponents
    : [];
  const findComponent = (type) => {
    const row = components.find(
      (c) => Array.isArray(c.types) && c.types.includes(type)
    );
    return row ? String(row.longText || row.shortText || "").trim() : "";
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
    address: String(result.formattedAddress || result.displayName?.text || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    locality,
  };
}

function mapLegacyPlaceDetails(id, result) {
  const lat = Number(result.geometry?.location?.lat);
  const lon = Number(result.geometry?.location?.lng);
  const components = Array.isArray(result.address_components)
    ? result.address_components
    : [];
  const findComponent = (type) => {
    const row = components.find(
      (c) => Array.isArray(c.types) && c.types.includes(type)
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
}
