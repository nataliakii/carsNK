import {
  redactSecretsForLog,
  sanitizeProviderErrorMessage,
} from "@/domain/transfers/sanitizeProviderError";

const GOOGLE_PLACES_TIMEOUT_MS = Number(
  process.env.GOOGLE_PLACES_TIMEOUT_MS || 8000
);
/**
 * Skip Google for a short window after REQUEST_DENIED so a burst of keystrokes
 * does not hammer a blocked key. Short enough that a GCP restriction fix is
 * picked up on the next search without restarting the server.
 */
export const PLACES_DENIED_COOLDOWN_MS = 15 * 1000;

export const PLACES_FAIL_REASON = {
  NOT_CONFIGURED: "not_configured",
  REFERER_RESTRICTED: "referer_restricted",
  IP_RESTRICTED: "ip_restricted",
  API_NOT_ENABLED: "api_not_enabled",
  BILLING_DISABLED: "billing_disabled",
  QUOTA_EXCEEDED: "quota_exceeded",
  INVALID_REQUEST: "invalid_request",
  TIMEOUT: "provider_timeout",
  ZERO_RESULTS: "zero_results",
  UNSUPPORTED_AREA: "unsupported_area",
  REQUEST_DENIED: "request_denied",
  GOOGLE_ERROR: "google_error",
};

/** Skip further Google calls after REQUEST_DENIED (referer-restricted key, etc.). */
let placesDeniedUntil = 0;
let lastDeniedReason = PLACES_FAIL_REASON.REQUEST_DENIED;
let lastDeniedPublicMessage =
  "Places API denied this server key (need a server key without HTTP-referrer restriction)";

function getMapsApiKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
}

/** Map Google country long names / ISO2 onto the 2-letter codes stored on companies. */
const COUNTRY_NAME_TO_ISO = Object.freeze({
  spain: "ES",
  espana: "ES",
  españa: "ES",
  greece: "GR",
  hellas: "GR",
  ελλάδα: "GR",
  ελλαδα: "GR",
});

export function placeCountryCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_ISO[raw.toLowerCase()] || raw.toUpperCase();
}

export function isGooglePlacesConfigured() {
  return Boolean(getMapsApiKey());
}

export function resetGooglePlacesDeniedState() {
  placesDeniedUntil = 0;
  lastDeniedReason = PLACES_FAIL_REASON.REQUEST_DENIED;
  lastDeniedPublicMessage =
    "Places API denied this server key (need a server key without HTTP-referrer restriction)";
}

function markPlacesDenied(reason, publicMessage) {
  placesDeniedUntil = Date.now() + PLACES_DENIED_COOLDOWN_MS;
  lastDeniedReason = reason || PLACES_FAIL_REASON.REQUEST_DENIED;
  if (publicMessage) lastDeniedPublicMessage = publicMessage;
}

function placesDeniedResponse(message, reason) {
  return {
    ok: false,
    configured: true,
    unavailable: true,
    reason: reason || lastDeniedReason,
    predictions: [],
    message:
      message ||
      lastDeniedPublicMessage ||
      "Places API denied this server key (need a server key without HTTP-referrer restriction)",
  };
}

/**
 * Map Google status / error text → stable server-side reason codes.
 * Never include API key material in the returned reason.
 */
export function classifyPlacesFailure(dataOrMessage) {
  const status = String(
    typeof dataOrMessage === "object" && dataOrMessage
      ? dataOrMessage.status || dataOrMessage?.error?.status || ""
      : ""
  ).toUpperCase();
  const raw = (
    typeof dataOrMessage === "string"
      ? dataOrMessage
      : googleErrorMessage(dataOrMessage)
  ).toLowerCase();

  if (status === "ZERO_RESULTS" || /zero[_ ]?results/.test(raw)) {
    return PLACES_FAIL_REASON.ZERO_RESULTS;
  }
  if (
    status === "OVER_QUERY_LIMIT" ||
    status === "RESOURCE_EXHAUSTED" ||
    /quota|rate.?limit|over.?query|resource.?exhausted/.test(raw)
  ) {
    return PLACES_FAIL_REASON.QUOTA_EXCEEDED;
  }
  if (
    status === "INVALID_REQUEST" ||
    /invalid[_ ]?request|invalid argument/.test(raw)
  ) {
    return PLACES_FAIL_REASON.INVALID_REQUEST;
  }
  if (
    /timeout|timed out|abort|deadline.?exceeded|etimedout/.test(raw) ||
    status === "TIMEOUT"
  ) {
    return PLACES_FAIL_REASON.TIMEOUT;
  }
  if (/referer|referrer/.test(raw)) {
    return PLACES_FAIL_REASON.REFERER_RESTRICTED;
  }
  if (
    /ip address|ip.?restrict|not authorized from this ip|requests from this ip/.test(
      raw
    )
  ) {
    return PLACES_FAIL_REASON.IP_RESTRICTED;
  }
  if (/billing/.test(raw)) return PLACES_FAIL_REASON.BILLING_DISABLED;
  if (
    /not been used|has not been enabled|api not activated|not authorized to use this api|access not configured|permission.?denied.*api/.test(
      raw
    )
  ) {
    return PLACES_FAIL_REASON.API_NOT_ENABLED;
  }
  if (
    /unsupported.*(country|region|area)|outside.*(service|coverage)|not available in this (country|region)/.test(
      raw
    )
  ) {
    return PLACES_FAIL_REASON.UNSUPPORTED_AREA;
  }
  if (status === "REQUEST_DENIED" || status === "PERMISSION_DENIED") {
    return PLACES_FAIL_REASON.REQUEST_DENIED;
  }
  if (status || raw) return PLACES_FAIL_REASON.REQUEST_DENIED;
  return PLACES_FAIL_REASON.GOOGLE_ERROR;
}

function publicDeniedMessage(reason) {
  if (reason === PLACES_FAIL_REASON.REFERER_RESTRICTED) {
    return "Places server key is blocked by HTTP-referrer restrictions";
  }
  if (reason === PLACES_FAIL_REASON.IP_RESTRICTED) {
    return "Places server key is blocked by IP address restrictions";
  }
  if (reason === PLACES_FAIL_REASON.BILLING_DISABLED) {
    return "Places API billing is not enabled";
  }
  if (reason === PLACES_FAIL_REASON.API_NOT_ENABLED) {
    return "Places API is not enabled for this key";
  }
  if (reason === PLACES_FAIL_REASON.QUOTA_EXCEEDED) {
    return "Places API quota exceeded";
  }
  if (reason === PLACES_FAIL_REASON.INVALID_REQUEST) {
    return "Places request was invalid";
  }
  if (reason === PLACES_FAIL_REASON.TIMEOUT) {
    return "Places provider timed out";
  }
  if (reason === PLACES_FAIL_REASON.UNSUPPORTED_AREA) {
    return "Address is outside the supported service area";
  }
  if (reason === PLACES_FAIL_REASON.ZERO_RESULTS) {
    return "No matching places found";
  }
  return "Places API denied this server key (need a server key without HTTP-referrer restriction)";
}

/** Safe public message — never include provider key or raw Google payloads. */
export function publicPlacesMessage(reason, fallback) {
  switch (reason) {
    case PLACES_FAIL_REASON.NOT_CONFIGURED:
      return "Places API is not configured";
    case PLACES_FAIL_REASON.REFERER_RESTRICTED:
    case PLACES_FAIL_REASON.IP_RESTRICTED:
    case PLACES_FAIL_REASON.BILLING_DISABLED:
    case PLACES_FAIL_REASON.API_NOT_ENABLED:
    case PLACES_FAIL_REASON.QUOTA_EXCEEDED:
    case PLACES_FAIL_REASON.INVALID_REQUEST:
    case PLACES_FAIL_REASON.TIMEOUT:
    case PLACES_FAIL_REASON.UNSUPPORTED_AREA:
    case PLACES_FAIL_REASON.ZERO_RESULTS:
    case PLACES_FAIL_REASON.REQUEST_DENIED:
      return publicDeniedMessage(reason);
    case PLACES_FAIL_REASON.GOOGLE_ERROR:
      return "Places lookup is temporarily unavailable";
    default:
      return fallback || "Places lookup is temporarily unavailable";
  }
}

async function fetchGoogleJson(url, { timeoutMs = GOOGLE_PLACES_TIMEOUT_MS, method = "GET", headers, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Server-to-server: do not set Referer. Browser-restricted keys fail here by design.
    const res = await fetch(url.toString(), {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers,
      body,
    });
    return await res.json().catch(() => ({}));
  } catch (err) {
    const msg = String(err?.name || err?.message || err || "");
    if (/abort|timeout|etimedout/i.test(msg)) {
      const timeoutErr = new Error("Places provider timed out");
      timeoutErr.code = PLACES_FAIL_REASON.TIMEOUT;
      throw timeoutErr;
    }
    throw err;
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
    const iso = placeCountryCode(country);
    if (/^[A-Za-z]{2}$/.test(iso)) {
      url.searchParams.set("components", `country:${iso.toLowerCase()}`);
    }
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
    const iso = placeCountryCode(country);
    if (/^[A-Za-z]{2}$/.test(iso)) {
      body.includedRegionCodes = [iso.toLowerCase()];
    }
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
      unavailable: true,
      reason: PLACES_FAIL_REASON.NOT_CONFIGURED,
      predictions: [],
      message: "Places API is not configured",
    };
  }

  const params = {
    q,
    country: placeCountryCode(country) || "",
    language,
    sessionToken,
    types,
    apiKey,
  };
  try {
    let neu = { data: {}, predictions: [] };
    try {
      neu = await fetchNewAutocomplete(params);
    } catch (err) {
      console.warn(
        "[places] Places API (New) failed, trying legacy",
        redactSecretsForLog(err?.message || err)
      );
    }
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
      const googleMsg =
        googleErrorMessage(legacy.data) || googleErrorMessage(neu.data);
      const reason = classifyPlacesFailure(
        `${googleErrorMessage(legacy.data)} ${googleErrorMessage(neu.data)}`
      );
      const publicMessage = publicDeniedMessage(reason);
      markPlacesDenied(reason, publicMessage);
      console.warn(
        "[places] autocomplete REQUEST_DENIED",
        reason,
        redactSecretsForLog(googleMsg)
      );
      if (reason === PLACES_FAIL_REASON.REFERER_RESTRICTED) {
        console.warn(
          "[places] HTTP-referrer restrictions cannot be used with this server call. Adding a website domain will not enable autocomplete. Use a server key with no referrer restriction (IP restriction is OK), enable Places API (New) and/or Places API, and billing."
        );
      }
      return placesDeniedResponse(publicMessage, reason);
    }

    if (legacy.data.status && !legacyDenied) {
      const reason = classifyPlacesFailure(legacy.data);
      console.warn(
        "[places] autocomplete status:",
        legacy.data.status,
        reason,
        redactSecretsForLog(googleErrorMessage(legacy.data))
      );
      return {
        ok: false,
        configured: true,
        unavailable: true,
        reason,
        predictions: [],
        message: publicPlacesMessage(reason),
      };
    }

    return {
      ok: false,
      configured: true,
      unavailable: true,
      reason: PLACES_FAIL_REASON.GOOGLE_ERROR,
      predictions: [],
      message: publicPlacesMessage(PLACES_FAIL_REASON.GOOGLE_ERROR),
    };
  } catch (err) {
    const reason =
      err?.code === PLACES_FAIL_REASON.TIMEOUT
        ? PLACES_FAIL_REASON.TIMEOUT
        : classifyPlacesFailure(err?.message || err);
    console.error(
      "[places] autocomplete error:",
      reason,
      redactSecretsForLog(err?.message || err)
    );
    return {
      ok: false,
      configured: true,
      unavailable: true,
      reason,
      predictions: [],
      message: publicPlacesMessage(
        reason,
        sanitizeProviderErrorMessage(err?.message || "Places request failed")
      ),
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
      unavailable: true,
      reason: PLACES_FAIL_REASON.NOT_CONFIGURED,
      message: "Places API is not configured",
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
      const googleMsg = googleErrorMessage(data) || googleErrorMessage(neu);
      const reason = classifyPlacesFailure(
        `${googleErrorMessage(data)} ${googleErrorMessage(neu)}`
      );
      const publicMessage = publicDeniedMessage(reason);
      markPlacesDenied(reason, publicMessage);
      console.warn(
        "[places] details REQUEST_DENIED",
        reason,
        redactSecretsForLog(googleMsg)
      );
      return placesDeniedResponse(publicMessage, reason);
    }
    const detailsReason = classifyPlacesFailure(data || neu);
    return {
      ok: false,
      configured: true,
      unavailable: true,
      reason: detailsReason || PLACES_FAIL_REASON.GOOGLE_ERROR,
      message: publicPlacesMessage(
        detailsReason || PLACES_FAIL_REASON.GOOGLE_ERROR
      ),
    };
  } catch (err) {
    const reason =
      err?.code === PLACES_FAIL_REASON.TIMEOUT
        ? PLACES_FAIL_REASON.TIMEOUT
        : classifyPlacesFailure(err?.message || err);
    console.warn(
      "[places] details error:",
      reason,
      redactSecretsForLog(err?.message || err)
    );
    return {
      ok: false,
      configured: true,
      unavailable: true,
      reason,
      message: publicPlacesMessage(
        reason,
        sanitizeProviderErrorMessage(err?.message || "Place details failed")
      ),
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
  const countryRow = components.find(
    (c) => Array.isArray(c.types) && c.types.includes("country")
  );
  const country = placeCountryCode(
    (countryRow && (countryRow.shortText || countryRow.longText)) || ""
  );
  return {
    ok: true,
    configured: true,
    placeId: id,
    address: String(result.formattedAddress || result.displayName?.text || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    locality,
    country,
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
  const countryRow = components.find(
    (c) => Array.isArray(c.types) && c.types.includes("country")
  );
  const country = placeCountryCode(
    (countryRow && (countryRow.short_name || countryRow.long_name)) || ""
  );
  return {
    ok: true,
    configured: true,
    placeId: id,
    address: String(result.formatted_address || result.name || "").trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    locality,
    country,
  };
}
