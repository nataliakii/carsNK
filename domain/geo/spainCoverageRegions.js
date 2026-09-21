import { normalizeSpainCitySearchText } from "@/domain/orders/spainCityOptions";

/**
 * Spain coverage *region* shortcuts — bulk add of city names.
 *
 * Per-city comuna / metro lists live in spainCityComunas.js.
 *
 * Four combinable layers (stored as operatingCities + optional radius):
 *   1. City — the municipality (Barcelona, Valencia, Madrid, …).
 *   2. Comuna — satellite towns for that city.
 *   3. Radius — optional circle from the office, alone or with cities.
 *   4. Extra cities — search picker, independent.
 *
 * Costa Brava is its own Girona-coast region, never Barcelona's comuna.
 * Airports are points (extra cities), not comunas.
 * Comunitat Valenciana is a bulk shortcut; Valencia's comuna is metro.
 */

export const COSTA_BRAVA_CITIES = [
  "Lloret de Mar",
  "Blanes",
  "Tossa de Mar",
  "Platja d'Aro",
  "Roses",
  "Figueres",
  "Empuriabrava",
  "Palafrugell",
  "Cadaqués",
  "Girona Airport",
];

/** Metro towns. Not Costa Brava. Airport is a separate extra city. */
export const BARCELONA_METRO_CITIES = [
  "Barcelona",
  "Hospitalet de Llobregat",
  "Badalona",
  "Sabadell",
  "Terrassa",
  "Mataro",
  "Castelldefels",
  "Sitges",
];

export const COMUNITAT_VALENCIANA_CITIES = [
  "Valencia",
  "Valencia Airport",
  "Alicante",
  "Alicante Airport",
  "Castellon",
  "Benidorm",
  "Elche",
  "Torrevieja",
  "Gandia",
  "Denia",
  "Calpe",
  "Peniscola",
];

/** Valencia metro / nearby — not Alicante province, not the airport. */
export const VALENCIA_METRO_CITIES = [
  "Valencia",
  "Torrent",
  "Sagunto",
  "Cullera",
  "Gandia",
];

/** Alicante / Costa Blanca — not Valencia city, not the airport. */
export const ALICANTE_PROVINCE_CITIES = [
  "Alicante",
  "Benidorm",
  "Elche",
  "Torrevieja",
  "Denia",
  "Calpe",
];

/** Comunidad de Madrid — curated towns, not the airport. */
export const COMUNIDAD_MADRID_CITIES = [
  "Madrid",
  "Alcala de Henares",
  "Aranjuez",
  "El Escorial",
];

export const COSTA_DEL_SOL_CITIES = [
  "Malaga",
  "Marbella",
  "Torremolinos",
  "Fuengirola",
];

export const CASTELLON_COMUNA_CITIES = ["Castellon", "Peniscola"];

export const SPAIN_COVERAGE_REGIONS = [
  {
    id: "costa-brava",
    name: "Costa Brava",
    cities: ["Girona", ...COSTA_BRAVA_CITIES],
  },
  {
    id: "comunitat-valenciana",
    name: "Comunitat Valenciana",
    cities: COMUNITAT_VALENCIANA_CITIES,
  },
];

function cityKey(name) {
  return normalizeSpainCitySearchText(name);
}

export function coverageRegionsForCountry(country) {
  const cc = String(country || "")
    .trim()
    .toUpperCase();
  if (cc === "ES") return SPAIN_COVERAGE_REGIONS;
  return [];
}

export function mergeCityNames(current, extras) {
  const seen = new Set();
  const out = [];
  for (const raw of [...(current || []), ...(extras || [])]) {
    const name = String(raw || "").trim();
    const key = cityKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function regionMatchState(selectedCities, regionCities) {
  const selected = new Set(
    (selectedCities || []).map(cityKey).filter(Boolean)
  );
  const cities = (regionCities || []).map((name) => String(name).trim());
  if (!cities.length) return "none";
  let hits = 0;
  for (const name of cities) {
    if (selected.has(cityKey(name))) hits += 1;
  }
  if (hits === 0) return "none";
  if (hits === cities.length) return "all";
  return "some";
}

export function addRegionCities(selectedCities, regionCities) {
  return mergeCityNames(selectedCities, regionCities);
}

export function removeRegionCities(selectedCities, regionCities) {
  const drop = new Set((regionCities || []).map(cityKey).filter(Boolean));
  return (selectedCities || [])
    .map((name) => String(name || "").trim())
    .filter((name) => name && !drop.has(cityKey(name)));
}

export function toggleRegionCities(selectedCities, regionCities) {
  if (regionMatchState(selectedCities, regionCities) === "all") {
    return removeRegionCities(selectedCities, regionCities);
  }
  return addRegionCities(selectedCities, regionCities);
}

export function extrasWithoutHub(list, hubCity) {
  const hub = cityKey(hubCity);
  if (!hub) return [...(list || [])];
  return (list || []).filter((name) => cityKey(name) !== hub);
}
