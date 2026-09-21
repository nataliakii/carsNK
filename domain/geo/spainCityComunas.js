import { normalizeSpainCitySearchText } from "@/domain/orders/spainCityOptions";
import { foldCityText, matchesCityQuery } from "@/domain/geo/cityLookupOptions";
import {
  ALICANTE_PROVINCE_CITIES,
  BARCELONA_METRO_CITIES,
  COMUNIDAD_MADRID_CITIES,
  COMUNITAT_VALENCIANA_CITIES,
  COSTA_BRAVA_CITIES,
  COSTA_DEL_SOL_CITIES,
  addRegionCities,
  extrasWithoutHub,
  regionMatchState,
  removeRegionCities,
} from "@/domain/geo/spainCoverageRegions";

/**
 * Per-city community packs (comuna / comarca / autonomous community).
 *
 * Selecting a community adds those towns to operatingCities; unchecking
 * removes extras and keeps the hub city. Costa Brava is Girona's pack,
 * never Barcelona's. Valencia's pack is Comunitat Valenciana.
 */

export const SPAIN_CITY_COMUNAS = {
  Barcelona: {
    id: "barcelona",
    labelKey: "comunaLabelBarcelona",
    towns: extrasWithoutHub(BARCELONA_METRO_CITIES, "Barcelona"),
  },
  Valencia: {
    id: "valencia",
    labelKey: "comunaLabelValencia",
    towns: extrasWithoutHub(COMUNITAT_VALENCIANA_CITIES, "Valencia"),
  },
  Alicante: {
    id: "alicante",
    labelKey: "comunaLabelAlicante",
    towns: extrasWithoutHub(ALICANTE_PROVINCE_CITIES, "Alicante"),
  },
  Madrid: {
    id: "madrid",
    labelKey: "comunaLabelMadrid",
    towns: extrasWithoutHub(COMUNIDAD_MADRID_CITIES, "Madrid"),
  },
  Malaga: {
    id: "malaga",
    labelKey: "comunaLabelMalaga",
    towns: extrasWithoutHub(COSTA_DEL_SOL_CITIES, "Malaga"),
  },
  Castellon: {
    id: "castellon",
    labelKey: "comunaLabelCastellon",
    towns: extrasWithoutHub(COMUNITAT_VALENCIANA_CITIES, "Castellon"),
  },
  Girona: {
    id: "girona",
    labelKey: "coverageRegionCostaBrava",
    towns: extrasWithoutHub(["Girona", ...COSTA_BRAVA_CITIES], "Girona"),
  },
};

const COMUNA_QUERY_TOKENS = [
  "comuna",
  "comunas",
  "comarca",
  "comunitat",
  "metro",
  "area",
  "umland",
  "комуна",
  "комарка",
];

function cityKey(name) {
  return normalizeSpainCitySearchText(name);
}

const COMUNA_BY_KEY = Object.fromEntries(
  Object.entries(SPAIN_CITY_COMUNAS).map(([hub, preset]) => [
    cityKey(hub),
    { hub, ...preset },
  ])
);

export function citiesWithComuna() {
  return Object.keys(SPAIN_CITY_COMUNAS);
}

export function selectedComunaHubs(selectedCities) {
  const selected = new Set(
    (selectedCities || []).map((name) => cityKey(name)).filter(Boolean)
  );
  return citiesWithComuna().filter((hub) => selected.has(cityKey(hub)));
}

export function cityComunaForName(name) {
  return COMUNA_BY_KEY[cityKey(name)] || null;
}

export function comunaTownsForCity(name) {
  return cityComunaForName(name)?.towns || [];
}

export function comunaCitiesToAdd(name) {
  const comuna = cityComunaForName(name);
  if (!comuna) return [];
  return [comuna.hub, ...comuna.towns];
}

export function comunaMatchState(selectedCities, hubName) {
  return regionMatchState(selectedCities, comunaTownsForCity(hubName));
}

export function addComunaTowns(selectedCities, hubName) {
  return addRegionCities(selectedCities, comunaCitiesToAdd(hubName));
}

export function removeComunaTowns(selectedCities, hubName) {
  return removeRegionCities(selectedCities, comunaTownsForCity(hubName));
}

export function toggleComunaTowns(selectedCities, hubName) {
  if (comunaMatchState(selectedCities, hubName) === "all") {
    return removeComunaTowns(selectedCities, hubName);
  }
  return addComunaTowns(selectedCities, hubName);
}

export function queryLooksLikeComuna(query) {
  const needle = cityKey(query);
  if (!needle) return false;
  return COMUNA_QUERY_TOKENS.some((token) => needle.includes(cityKey(token)));
}

export function makeComunaSearchOption(hubName, preset) {
  const comuna = preset || cityComunaForName(hubName);
  if (!comuna) return null;
  const hub = comuna.hub || String(hubName || "").trim();
  return {
    source: "comuna",
    id: `comuna:${cityKey(hub)}`,
    name: hub,
    comunaHub: hub,
    towns: comuna.towns,
    labelKey: comuna.labelKey,
    searchText: [hub, "comuna", "comarca", "comunitat", "metro", "area"].join(
      " "
    ),
  };
}

export function insertComunaSearchOptions(
  options,
  { query = "", country } = {}
) {
  const cc = String(country || "")
    .trim()
    .toUpperCase();
  if (cc && cc !== "ES") return Array.isArray(options) ? options : [];

  const list = Array.isArray(options) ? options : [];
  const out = [];
  const inserted = new Set();

  for (const option of list) {
    out.push(option);
    if (!option || option.source === "comuna") continue;
    const hub = String(option.name || "").trim();
    const comuna = cityComunaForName(hub);
    if (!comuna) continue;
    const id = `comuna:${cityKey(hub)}`;
    if (inserted.has(id)) continue;
    inserted.add(id);
    out.push(makeComunaSearchOption(hub, comuna));
  }

  const needle = foldCityText(query);
  const wantAllComunas = queryLooksLikeComuna(query);
  if (needle || wantAllComunas) {
    for (const hub of citiesWithComuna()) {
      const id = `comuna:${cityKey(hub)}`;
      if (inserted.has(id)) continue;
      const option = makeComunaSearchOption(hub);
      if (!option) continue;
      const hubMatches =
        cityKey(hub).includes(needle) || matchesCityQuery({ name: hub }, query);
      if (wantAllComunas || hubMatches) {
        inserted.add(id);
        out.push(option);
      }
    }
  }

  return out;
}
