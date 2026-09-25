/**
 * Resolve official INE codes to bundled Spain GeoJSON features and map bounds.
 * Geometry lives in /public/geo and is cached after the first load.
 */

import { foldCityText } from "@/domain/geo/cityLookupOptions";
import {
  communityByCode,
  compactServiceAreas,
  coveredProvinceCodes,
  padAdminCode,
  provinceByCode,
} from "@/domain/geo/spainAdminDivisions";

export const SPAIN_COMMUNITY_GEO_PATH = "/geo/spain-communities.geojson";
export const SPAIN_PROVINCE_GEO_PATH = "/geo/spain-provinces.geojson";

export const ROVARO_COVERAGE_MAGENTA = "#E9004F";

const DEFAULT_OFFICE_ZOOM = 11;
const EMPTY_SPAIN_CENTER = { lat: 40.2, lon: -3.7 };
const EMPTY_SPAIN_ZOOM = 5;

let cachedGeo = null;
let cachedPromise = null;

export function featureAdminCode(feature) {
  const props = feature?.properties || {};
  return padAdminCode(props.code || props.cod_ccaa || props.cod_prov);
}

export function featureKind(feature) {
  const kind = String(feature?.properties?.kind || "").trim();
  if (kind === "community" || kind === "province") return kind;
  if (feature?.properties?.cod_prov && !feature?.properties?.kind) {
    return "province";
  }
  return "community";
}

export function featureDisplayName(feature) {
  const code = featureAdminCode(feature);
  const kind = featureKind(feature);
  if (kind === "province") return provinceByCode(code)?.name || feature?.properties?.name || "";
  return communityByCode(code)?.name || feature?.properties?.name || "";
}

export function indexGeoJsonByCode(collection) {
  const byCode = new Map();
  for (const feature of collection?.features || []) {
    const code = featureAdminCode(feature);
    if (!code) continue;
    byCode.set(code, feature);
  }
  return byCode;
}

export function featureBBox(feature) {
  const listed = feature?.bbox || feature?.properties?.bbox;
  if (Array.isArray(listed) && listed.length === 4) {
    const [w, s, e, n] = listed.map(Number);
    if ([w, s, e, n].every(Number.isFinite)) return [w, s, e, n];
  }
  return bboxFromGeometry(feature?.geometry);
}

export function bboxFromGeometry(geometry) {
  if (!geometry) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      const lon = value[0];
      const lat = value[1];
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    for (const child of value) visit(child);
  };

  visit(geometry.coordinates);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [west, south, east, north];
}

export function mergeBBoxes(boxes) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let found = false;
  for (const box of boxes || []) {
    if (!box || box.length !== 4) continue;
    const [w, s, e, n] = box.map(Number);
    if (![w, s, e, n].every(Number.isFinite)) continue;
    found = true;
    if (w < west) west = w;
    if (s < south) south = s;
    if (e > east) east = e;
    if (n > north) north = n;
  }
  return found ? [west, south, east, north] : null;
}

export function radiusBBox(origin, radiusKm) {
  const lat = Number(origin?.lat);
  const lon = Number(origin?.lon ?? origin?.lng);
  const radius = Number(radiusKm);
  if (![lat, lon, radius].every(Number.isFinite) || radius < 0) return null;
  const dLat = radius / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLon = radius / (111.32 * (Math.abs(cos) < 0.1 ? 0.1 : cos));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

export function pointBBox(point, padDeg = 0.08) {
  const lat = Number(point?.lat);
  const lon = Number(point?.lon ?? point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lon - padDeg, lat - padDeg, lon + padDeg, lat + padDeg];
}

export function indexSpainCoverageGeo({ communities, provinces } = {}) {
  return {
    communities: indexGeoJsonByCode(communities),
    provinces: indexGeoJsonByCode(provinces),
  };
}

export function featuresForServiceAreas(areas, geo) {
  const compact = compactServiceAreas(areas || {});
  const communityFeatures = [];
  for (const code of compact.communityCodes) {
    const feature = geo?.communities?.get(code);
    if (feature) communityFeatures.push(feature);
  }
  const implied = new Set(coveredProvinceCodes({ communityCodes: compact.communityCodes }));
  const provinceFeatures = [];
  for (const code of compact.provinceCodes) {
    if (implied.has(code)) continue;
    const feature = geo?.provinces?.get(code);
    if (feature) provinceFeatures.push(feature);
  }
  return { communityFeatures, provinceFeatures };
}

/**
 * Leaflet-friendly bounds: [[south, west], [north, east]] plus a center fallback.
 * `offices` (array) wins over a single `office` when both are passed.
 */
export function coverageMapBounds({
  communityCodes = [],
  provinceCodes = [],
  cityPoints = [],
  office = null,
  offices = null,
  radiusKm = null,
  geo = null,
} = {}) {
  const { communityFeatures, provinceFeatures } = featuresForServiceAreas(
    { communityCodes, provinceCodes },
    geo
  );
  const officeList =
    Array.isArray(offices) && offices.length
      ? offices
      : office
        ? [office]
        : [];
  const hasAreaLayers =
    communityFeatures.length > 0 ||
    provinceFeatures.length > 0 ||
    cityPoints.length > 0;
  const boxes = [
    ...communityFeatures.map(featureBBox),
    ...provinceFeatures.map(featureBBox),
    ...cityPoints.map((point) => pointBBox(point)),
  ];
  // Include office pins in the fit when there is coverage, or several offices.
  // A lone office still uses center+zoom so the pin isn't padded-tiny.
  if (hasAreaLayers || officeList.length > 1) {
    boxes.push(...officeList.map((point) => pointBBox(point)));
  }
  const radius =
    radiusKm === "" || radiusKm == null ? NaN : Number(radiusKm);
  const primaryOffice = officeList[0] || null;
  if (Number.isFinite(radius) && radius >= 0 && primaryOffice) {
    boxes.push(radiusBBox(primaryOffice, radius));
  }

  const merged = mergeBBoxes(boxes);
  if (merged) {
    const [west, south, east, north] = merged;
    return {
      bounds: [
        [south, west],
        [north, east],
      ],
      center: { lat: (south + north) / 2, lon: (west + east) / 2 },
      zoom: null,
    };
  }

  const lat = Number(primaryOffice?.lat);
  const lon = Number(primaryOffice?.lon ?? primaryOffice?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return {
      bounds: null,
      center: { lat, lon },
      zoom: DEFAULT_OFFICE_ZOOM,
    };
  }

  return {
    bounds: null,
    center: EMPTY_SPAIN_CENTER,
    zoom: EMPTY_SPAIN_ZOOM,
  };
}

export function resolveCoverageCityPoints(names = [], catalog = [], coordsByName = {}) {
  const points = [];
  const seen = new Set();
  const catalogList = Array.isArray(catalog) ? catalog : [];
  for (const raw of names || []) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = foldCityText(name);
    if (seen.has(key)) continue;
    const catalogCity = catalogList.find(
      (city) => foldCityText(city?.name) === key
    );
    const fromCatalog = catalogCity?.coords || null;
    const tableKey = Object.keys(coordsByName || {}).find(
      (item) => foldCityText(item) === key
    );
    const fromTable = coordsByName?.[name] || (tableKey ? coordsByName[tableKey] : null);
    const lat = Number(fromCatalog?.lat ?? fromTable?.lat);
    const lon = Number(fromCatalog?.lon ?? fromCatalog?.lng ?? fromTable?.lon ?? fromTable?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    seen.add(key);
    points.push({ name, lat, lon });
  }
  return points;
}

export function hasCoverageSelection({
  communityCodes = [],
  provinceCodes = [],
  cities = [],
  radiusKm = null,
} = {}) {
  if ((communityCodes || []).length) return true;
  if ((provinceCodes || []).length) return true;
  if ((cities || []).some((name) => String(name || "").trim())) return true;
  if (radiusKm === "" || radiusKm == null) return false;
  const radius = Number(radiusKm);
  return Number.isFinite(radius) && radius >= 0;
}

async function readJson(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return res.json();
}

export function resetSpainCoverageGeoCache() {
  cachedGeo = null;
  cachedPromise = null;
}

/**
 * Browser: fetch static files once. Tests: pass `load` that returns both collections.
 */
export async function loadSpainCoverageGeo(options = {}) {
  if (cachedGeo) return cachedGeo;
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    if (typeof options.load === "function") {
      const loaded = await options.load();
      const geo = indexSpainCoverageGeo(loaded);
      cachedGeo = geo;
      return geo;
    }
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("No fetch available for Spain coverage GeoJSON");
    }
    const base = options.baseUrl || "";
    const [communities, provinces] = await Promise.all([
      readJson(`${base}${SPAIN_COMMUNITY_GEO_PATH}`, fetchImpl),
      readJson(`${base}${SPAIN_PROVINCE_GEO_PATH}`, fetchImpl),
    ]);
    const geo = indexSpainCoverageGeo({ communities, provinces });
    cachedGeo = geo;
    return geo;
  })().catch((error) => {
    cachedPromise = null;
    throw error;
  });

  return cachedPromise;
}
