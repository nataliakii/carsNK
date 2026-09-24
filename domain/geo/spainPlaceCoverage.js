/**
 * Map transfer / booking places onto Spanish province/community coverage.
 * Name-based (no runtime GeoJSON required) so eligibility stays sync and cheap.
 */

import { foldCityText } from "@/domain/geo/cityLookupOptions";
import { SPAIN_CITY_OPTIONS } from "@/domain/orders/spainCityOptions";
import {
  communityByCode,
  coveredProvinceCodes,
  foldAdminText,
  isProvinceCovered,
  provinceByCode,
  SPAIN_PROVINCES,
} from "@/domain/geo/spainAdminDivisions";

/** Well-known place → INE province code. */
const CITY_TO_PROVINCE = new Map(
  [
    ["Barcelona", "08"],
    ["Hospitalet de Llobregat", "08"],
    ["Badalona", "08"],
    ["Sabadell", "08"],
    ["Terrassa", "08"],
    ["Mataro", "08"],
    ["Castelldefels", "08"],
    ["Sitges", "08"],
    ["Barcelona Airport", "08"],
    ["Girona", "17"],
    ["Costa Brava", "17"],
    ["Lloret de Mar", "17"],
    ["Blanes", "17"],
    ["Tossa de Mar", "17"],
    ["Platja d'Aro", "17"],
    ["Roses", "17"],
    ["Figueres", "17"],
    ["Empuriabrava", "17"],
    ["Palafrugell", "17"],
    ["Cadaqués", "17"],
    ["Girona Airport", "17"],
    ["Tarragona", "43"],
    ["Reus", "43"],
    ["Salou", "43"],
    ["Cambrils", "43"],
    ["Lleida", "25"],
    ["Madrid", "28"],
    ["Alcala de Henares", "28"],
    ["Aranjuez", "28"],
    ["El Escorial", "28"],
    ["Madrid Airport", "28"],
    ["Valencia", "46"],
    ["Torrent", "46"],
    ["Sagunto", "46"],
    ["Cullera", "46"],
    ["Gandia", "46"],
    ["Valencia Airport", "46"],
    ["Alicante", "03"],
    ["Benidorm", "03"],
    ["Elche", "03"],
    ["Torrevieja", "03"],
    ["Denia", "03"],
    ["Calpe", "03"],
    ["Alicante Airport", "03"],
    ["Castellon", "12"],
    ["Peniscola", "12"],
    ["Malaga", "29"],
    ["Marbella", "29"],
    ["Torremolinos", "29"],
    ["Fuengirola", "29"],
    ["Malaga Airport", "29"],
    ["Sevilla", "41"],
    ["Sevilla Airport", "41"],
    ["Cadiz", "11"],
    ["Jerez de la Frontera", "11"],
    ["Algeciras", "11"],
    ["Granada", "18"],
    ["Cordoba", "14"],
    ["Almeria", "04"],
    ["Huelva", "21"],
    ["Jaen", "23"],
    ["Bilbao", "48"],
    ["Bilbao Airport", "48"],
    ["San Sebastian", "20"],
    ["Vitoria-Gasteiz", "01"],
    ["Zaragoza", "50"],
    ["Huesca", "22"],
    ["Teruel", "44"],
    ["Murcia", "30"],
    ["Cartagena", "30"],
    ["Palma", "07"],
    ["Palma Airport", "07"],
    ["Ibiza", "07"],
    ["Ibiza Airport", "07"],
    ["Pamplona", "31"],
    ["Santander", "39"],
    ["Oviedo", "33"],
    ["Gijon", "33"],
    ["Vigo", "36"],
    ["A Coruna", "15"],
    ["Lugo", "27"],
    ["Ourense", "32"],
    ["Pontevedra", "36"],
    ["Logrono", "26"],
    ["Toledo", "45"],
    ["Albacete", "02"],
    ["Ciudad Real", "13"],
    ["Cuenca", "16"],
    ["Guadalajara", "19"],
    ["Badajoz", "06"],
    ["Caceres", "10"],
    ["Avila", "05"],
    ["Burgos", "09"],
    ["Leon", "24"],
    ["Palencia", "34"],
    ["Salamanca", "37"],
    ["Segovia", "40"],
    ["Soria", "42"],
    ["Valladolid", "47"],
    ["Zamora", "49"],
    ["Las Palmas", "35"],
    ["Santa Cruz de Tenerife", "38"],
    ["Tenerife South Airport", "38"],
    ["Ceuta", "51"],
    ["Melilla", "52"],
  ].map(([name, code]) => [foldCityText(name), code])
);

const IATA_TO_PROVINCE = Object.freeze({
  BCN: "08",
  GRO: "17",
  MAD: "28",
  VLC: "46",
  ALC: "03",
  AGP: "29",
  SVQ: "41",
  BIO: "48",
  PMI: "07",
  IBZ: "07",
  TFS: "38",
  LPA: "35",
  TFN: "38",
});

function locationTexts(location) {
  if (!location) return [];
  return [
    location.city,
    location.placeName,
    location.hotelName,
    location.formattedAddress,
    location.rawInput,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

/**
 * Best-effort INE province for a transfer endpoint.
 * @returns {string|null} padded province code
 */
export function inferProvinceCodeFromLocation(location) {
  if (!location) return null;

  const iata = String(location.iataCode || "")
    .trim()
    .toUpperCase();
  if (iata && IATA_TO_PROVINCE[iata]) return IATA_TO_PROVINCE[iata];

  for (const text of locationTexts(location)) {
    const cityKey = foldCityText(text);
    if (CITY_TO_PROVINCE.has(cityKey)) return CITY_TO_PROVINCE.get(cityKey);

    const folded = foldAdminText(text);
    for (const province of SPAIN_PROVINCES) {
      const name = foldAdminText(province.name);
      if (!name) continue;
      if (folded === name || folded.startsWith(`${name} `)) {
        return province.code;
      }
    }
  }

  return null;
}

/**
 * True when the place sits in the selected communities/provinces.
 */
export function locationInServiceAreas(location, areas) {
  const covered = coveredProvinceCodes(areas || {});
  if (!covered.length) return false;

  const provinceCode = inferProvinceCodeFromLocation(location);
  if (provinceCode && isProvinceCovered(areas, provinceCode)) return true;

  for (const text of locationTexts(location)) {
    const folded = foldAdminText(text);
    for (const code of areas?.communityCodes || []) {
      const name = foldAdminText(communityByCode(code)?.name);
      if (name && (folded === name || folded.includes(name))) return true;
    }
    for (const code of areas?.provinceCodes || []) {
      const name = foldAdminText(provinceByCode(code)?.name);
      if (name && (folded === name || folded.includes(name))) return true;
    }
  }

  return false;
}

export function hasStructuredServiceAreas(areas) {
  return Boolean(
    (areas?.communityCodes || []).length || (areas?.provinceCodes || []).length
  );
}

/** Known Spanish catalog names that sit inside the saved community/province codes. */
export function spainCitiesInServiceAreas(areas) {
  if (!hasStructuredServiceAreas(areas)) return [];
  return SPAIN_CITY_OPTIONS.filter((name) =>
    locationInServiceAreas({ city: name, placeName: name }, areas)
  );
}
