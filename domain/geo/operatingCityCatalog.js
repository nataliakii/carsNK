import {
  haversineKm,
  isWithinOrderRadius,
  parseLatLon,
} from "@/domain/geo/haversineKm";
import { dedupeCitiesByName, foldCityText } from "@/domain/geo/cityLookupOptions";
import { spainFallbackCities } from "@/domain/geo/spainCityCoords";

/** Mongo ObjectId hex — platform catalog rows. Spain fallback ids are `es:Name`. */
export function isPlatformObjectId(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || "").trim());
}

/**
 * Merge platform catalog cities with the curated Spanish list (coords included).
 * Filters to `country` when it is a real ISO code (not ALL / empty).
 */
export function mergeOperatingCityCatalog(platformCities = [], { country } = {}) {
  const cc = String(country || "")
    .trim()
    .toUpperCase();
  const includeSpain = !cc || cc === "ALL" || cc === "ES";
  const extras = includeSpain ? spainFallbackCities() : [];
  const merged = dedupeCitiesByName(platformCities, extras);
  if (!cc || cc === "ALL") return merged;
  return merged.filter(
    (city) => String(city?.country || "").toUpperCase() === cc
  );
}

export function sortCatalogByDistance(cities, base) {
  const origin = parseLatLon(base);
  return [...(cities || [])].sort((a, b) => {
    if (origin) {
      const da = haversineKm(origin, parseLatLon(a?.coords));
      const db = haversineKm(origin, parseLatLon(b?.coords));
      if (da != null && db != null && da !== db) return da - db;
      if (da != null && db == null) return -1;
      if (db != null && da == null) return 1;
    }
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

export function citiesWithinRadius(cities, base, radiusKm) {
  return citiesWithinRadiusOfOrigins(cities, [base], radiusKm);
}

/**
 * Cities inside `radiusKm` of any origin (each office, or a single base).
 */
export function citiesWithinRadiusOfOrigins(cities, origins, radiusKm) {
  const radius = Number(radiusKm);
  if (!Number.isFinite(radius) || radius < 0) return [];
  const points = (Array.isArray(origins) ? origins : [])
    .map((origin) => parseLatLon(origin))
    .filter(Boolean);
  if (!points.length) return [];
  return (cities || []).filter((city) => {
    const point = parseLatLon(city?.coords);
    if (!point) return false;
    return points.some((origin) =>
      isWithinOrderRadius(radius, haversineKm(origin, point))
    );
  });
}

export function selectedCityIdsFromCatalog(names, catalog) {
  const keys = new Set(
    (Array.isArray(names) ? names : []).map((name) => foldCityText(name))
  );
  return (catalog || [])
    .filter(
      (city) =>
        keys.has(foldCityText(city?.name)) && isPlatformObjectId(city?._id)
    )
    .map((city) => String(city._id));
}

export function cityNamesFromCityIds(cityIds, catalog) {
  const ids = new Set((cityIds || []).map((id) => String(id)));
  return (catalog || [])
    .filter((city) => ids.has(String(city?._id)))
    .map((city) => city.name)
    .filter(Boolean);
}

export function findCatalogCityByName(catalog, name) {
  const key = foldCityText(name);
  if (!key) return null;
  return (catalog || []).find((city) => foldCityText(city?.name) === key) || null;
}
