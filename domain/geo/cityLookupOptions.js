/**
 * Option model for city lookups that mix a local catalog (platform cities with
 * stored coords) with Google Places city predictions.
 *
 * Catalog entries resolve to coordinates instantly; Places entries resolve via
 * /api/public/places/resolve with `coordsOnly`.
 */

/** Strip diacritics / fold case so "Cadaqués" matches "cadaques". */
export function foldCityText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {unknown} city catalog city (`toPublicCity` shape)
 * @returns {{ source: "catalog", id: string, name: string, country: string, secondaryText: string, coords: { lat: string, lon: string } } | null}
 */
export function catalogCityOption(city) {
  const name = String(city?.name || "").trim();
  if (!name) return null;
  const lat = city?.coords?.lat;
  const lon = city?.coords?.lon ?? city?.coords?.lng;
  if (lat == null || lat === "" || lon == null || lon === "") return null;
  const country = String(city?.country || "").trim();
  return {
    source: "catalog",
    id: String(city?._id || city?.slug || name),
    name,
    country,
    secondaryText: country,
    searchText: String(city?.searchText || "").trim(),
    coords: { lat: String(lat), lon: String(lon) },
  };
}

/**
 * @param {unknown} prediction `/api/public/places/autocomplete` prediction
 */
export function placesCityOption(prediction) {
  const placeId = String(prediction?.placeId || "").trim();
  if (!placeId) return null;
  const name = String(
    prediction?.mainText || prediction?.description || ""
  ).trim();
  if (!name) return null;
  return {
    source: "places",
    id: placeId,
    placeId,
    name,
    secondaryText: String(prediction?.secondaryText || "").trim(),
    description: String(prediction?.description || name).trim(),
  };
}

/** Concatenate city lists, keeping the first entry for each name. */
export function dedupeCitiesByName(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const city of Array.isArray(list) ? list : []) {
      const key = foldCityText(city?.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(city);
    }
  }
  return out;
}

export function cityOptionLabel(option) {
  if (!option) return "";
  if (typeof option === "string") return option;
  const name = String(option.name || "").trim();
  const secondary = String(option.secondaryText || "").trim();
  return secondary ? `${name} (${secondary})` : name;
}

export function matchesCityQuery(option, query) {
  const needle = foldCityText(query);
  if (!needle) return true;
  const haystack = foldCityText(
    [option?.name, option?.secondaryText, option?.searchText]
      .filter(Boolean)
      .join(" ")
  );
  return haystack.includes(needle);
}

/**
 * Catalog matches first (instant coords), then Places predictions that are not
 * already represented by a catalog city with the same name.
 */
export function mergeCityLookupOptions({
  catalogOptions = [],
  predictions = [],
  query = "",
  limit = 20,
} = {}) {
  const matched = (Array.isArray(catalogOptions) ? catalogOptions : []).filter(
    (option) => option && matchesCityQuery(option, query)
  );
  const seen = new Set(matched.map((option) => foldCityText(option.name)));
  const fromPlaces = [];
  for (const raw of Array.isArray(predictions) ? predictions : []) {
    const option = placesCityOption(raw);
    if (!option) continue;
    const key = foldCityText(option.name);
    if (seen.has(key)) continue;
    seen.add(key);
    fromPlaces.push(option);
  }
  return [...matched, ...fromPlaces].slice(0, limit);
}
