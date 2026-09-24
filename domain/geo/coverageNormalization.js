/**
 * Safe read-path for legacy company coverage.
 *
 * Existing records store city-name lists and an optional office radius.
 * This maps recognizable region labels onto official INE codes and keeps
 * every unmatched value in `cities` so nothing is deleted.
 */

import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { foldCityText } from "@/domain/geo/cityLookupOptions";
import {
  compactServiceAreas,
  emptyServiceAreas,
  foldAdminText,
  isOfficialCommunityCode,
  isOfficialProvinceCode,
  normalizeServiceAreasInput,
  padAdminCode,
  SPAIN_COMMUNITIES,
  SPAIN_PROVINCES,
} from "@/domain/geo/spainAdminDivisions";
import {
  ALICANTE_PROVINCE_CITIES,
  COSTA_BRAVA_CITIES,
  COSTA_DEL_SOL_CITIES,
  COMUNITAT_VALENCIANA_CITIES,
} from "@/domain/geo/spainCoverageRegions";

const KNOWN_CITY_KEYS = new Set(
  [
    ...ALICANTE_PROVINCE_CITIES,
    ...COSTA_BRAVA_CITIES,
    ...COSTA_DEL_SOL_CITIES,
    ...COMUNITAT_VALENCIANA_CITIES,
    "Barcelona",
    "Girona",
    "Madrid",
    "Valencia",
    "Alicante",
    "Malaga",
    "Castellon",
    "Barcelona Airport",
    "Girona Airport",
    "Madrid Airport",
    "Valencia Airport",
    "Alicante Airport",
    "Malaga Airport",
  ].map((name) => foldCityText(name))
);

/** Region labels that are not official municipalities. */
const REGION_LABEL_ALIASES = [
  { keys: ["costa brava"], communityCodes: [], provinceCodes: ["17"] },
  {
    keys: [
      "comunitat valenciana",
      "comunidad valenciana",
      "comunidad autonoma valenciana",
      "valencian community",
    ],
    communityCodes: ["10"],
    provinceCodes: [],
  },
  { keys: ["costa del sol"], communityCodes: [], provinceCodes: ["29"] },
  { keys: ["costa blanca"], communityCodes: [], provinceCodes: ["03"] },
  {
    keys: [
      "area metropolitana",
      "area metropolitana de barcelona",
      "barcelona metro",
    ],
    communityCodes: [],
    provinceCodes: [],
    keepAsCity: true,
  },
];

function aliasKeysForCommunity(community) {
  const folded = foldAdminText(community.name);
  const keys = new Set([folded, foldAdminText(`comunidad ${community.name}`)]);
  if (community.code === "03") {
    keys.add("principado de asturias");
    keys.add("asturias principado de");
  }
  if (community.code === "04") {
    keys.add("baleares");
    keys.add("islas baleares");
    keys.add("balearic islands");
    keys.add("illes balears");
  }
  if (community.code === "05") {
    keys.add("canary islands");
    keys.add("islas canarias");
  }
  if (community.code === "07") {
    keys.add("castilla leon");
    keys.add("castile and leon");
    keys.add("castilla-leon");
  }
  if (community.code === "08") {
    keys.add("castilla la mancha");
    keys.add("castile la mancha");
  }
  if (community.code === "09") {
    keys.add("catalunya");
    keys.add("catalonia");
    keys.add("cataluna");
  }
  if (community.code === "13") {
    keys.add("madrid");
    keys.add("comunidad madrid");
    keys.add("community of madrid");
  }
  if (community.code === "14") {
    keys.add("murcia");
    keys.add("region de murcia");
  }
  if (community.code === "15") {
    keys.add("comunidad foral de navarra");
    keys.add("navarre");
  }
  if (community.code === "16") {
    keys.add("euskadi");
    keys.add("pais vasco");
    keys.add("basque country");
  }
  return [...keys].filter(Boolean);
}

function aliasKeysForProvince(province) {
  return [
    foldAdminText(province.name),
    foldAdminText(`provincia de ${province.name}`),
    foldAdminText(`provincia d ${province.name}`),
    foldAdminText(`${province.name} province`),
  ].filter(Boolean);
}

const COMMUNITY_ALIASES = new Map();
for (const community of SPAIN_COMMUNITIES) {
  for (const key of aliasKeysForCommunity(community)) {
    if (!COMMUNITY_ALIASES.has(key)) {
      COMMUNITY_ALIASES.set(key, community.code);
    }
  }
}

/**
 * Province-name aliases that are not also ordinary city labels.
 * "Barcelona" / "Madrid" stay cities; "Província d'Alacant" maps to 03.
 */
const CITY_LIKE_PROVINCE_NAMES = new Set(
  [
    "Almería",
    "Cádiz",
    "Córdoba",
    "Granada",
    "Huelva",
    "Jaén",
    "Málaga",
    "Sevilla",
    "Huesca",
    "Teruel",
    "Zaragoza",
    "Asturias",
    "Illes Balears",
    "Las Palmas",
    "Santa Cruz de Tenerife",
    "Cantabria",
    "Ávila",
    "Burgos",
    "León",
    "Palencia",
    "Salamanca",
    "Segovia",
    "Soria",
    "Valladolid",
    "Zamora",
    "Albacete",
    "Ciudad Real",
    "Cuenca",
    "Guadalajara",
    "Toledo",
    "Barcelona",
    "Girona",
    "Lleida",
    "Tarragona",
    "Alicante",
    "Castellón",
    "Valencia",
    "Badajoz",
    "Cáceres",
    "A Coruña",
    "Lugo",
    "Ourense",
    "Pontevedra",
    "Madrid",
    "Murcia",
    "Navarra",
    "Álava",
    "Gipuzkoa",
    "Bizkaia",
    "La Rioja",
    "Ceuta",
    "Melilla",
  ].map((name) => foldAdminText(name))
);

const PROVINCE_ALIASES = new Map();
for (const province of SPAIN_PROVINCES) {
  for (const key of aliasKeysForProvince(province)) {
    if (CITY_LIKE_PROVINCE_NAMES.has(key)) continue;
    if (!PROVINCE_ALIASES.has(key)) {
      PROVINCE_ALIASES.set(key, province.code);
    }
  }
}

function cityKeySet(names) {
  return new Set((names || []).map((name) => foldCityText(name)).filter(Boolean));
}

function packFullyPresent(selectedKeys, pack) {
  const extras = (pack || []).map((name) => foldCityText(name)).filter(Boolean);
  if (!extras.length) return false;
  return extras.every((key) => selectedKeys.has(key));
}

function findRegionAlias(folded) {
  return REGION_LABEL_ALIASES.find((alias) => alias.keys.includes(folded));
}

function addCodes(bucket, codes) {
  for (const code of codes || []) {
    const padded = padAdminCode(code);
    if (padded) bucket.add(padded);
  }
}

function looksLikeRegionLabel(folded) {
  if (!folded) return false;
  if (KNOWN_CITY_KEYS.has(folded)) return false;
  return (
    folded.includes("costa") ||
    folded.includes("comunitat") ||
    folded.includes("comunidad") ||
    folded.includes("provincia") ||
    folded.includes("province") ||
    folded.includes("comarca") ||
    folded.includes("autonom") ||
    folded.includes("region")
  );
}

/**
 * @param {object} input
 * @param {string[]|undefined} input.operatingCities
 * @param {object|undefined} input.serviceAreas
 * @param {number|string|null|undefined} input.orderRadiusKm
 * @param {string[]} [input.knownCities]
 */
export function normalizeLegacyCoverage(input = {}) {
  const citiesIn = normalizeOperatingCities(input.operatingCities);
  const saved = normalizeServiceAreasInput(input.serviceAreas);
  const savedAreas = saved.ok ? saved.value : emptyServiceAreas();
  const knownKeys = new Set([
    ...KNOWN_CITY_KEYS,
    ...(input.knownCities || []).map((name) => foldCityText(name)),
  ]);

  const communityCodes = new Set(savedAreas.communityCodes);
  const provinceCodes = new Set(savedAreas.provinceCodes);
  const mapped = [];
  const unmatched = [];
  const cities = [];

  for (const name of citiesIn) {
    const folded = foldAdminText(name);
    const alias = findRegionAlias(folded);
    if (alias) {
      addCodes(communityCodes, alias.communityCodes);
      addCodes(provinceCodes, alias.provinceCodes);
      mapped.push({
        from: name,
        communityCodes: alias.communityCodes,
        provinceCodes: alias.provinceCodes,
      });
      if (alias.keepAsCity) cities.push(name);
      continue;
    }

    const communityCode = COMMUNITY_ALIASES.get(folded);
    if (communityCode && !knownKeys.has(foldCityText(name))) {
      communityCodes.add(communityCode);
      mapped.push({
        from: name,
        communityCodes: [communityCode],
        provinceCodes: [],
      });
      continue;
    }

    const provinceCode = PROVINCE_ALIASES.get(folded);
    if (provinceCode) {
      provinceCodes.add(provinceCode);
      mapped.push({
        from: name,
        communityCodes: [],
        provinceCodes: [provinceCode],
      });
      continue;
    }

    if (looksLikeRegionLabel(folded) && !knownKeys.has(foldCityText(name))) {
      unmatched.push(name);
      cities.push(name);
      continue;
    }

    cities.push(name);
  }

  const selectedKeys = cityKeySet(citiesIn);
  if (packFullyPresent(selectedKeys, COMUNITAT_VALENCIANA_CITIES)) {
    communityCodes.add("10");
  }
  if (packFullyPresent(selectedKeys, ["Girona", ...COSTA_BRAVA_CITIES])) {
    provinceCodes.add("17");
  }
  if (packFullyPresent(selectedKeys, COSTA_DEL_SOL_CITIES)) {
    provinceCodes.add("29");
  }
  if (packFullyPresent(selectedKeys, ALICANTE_PROVINCE_CITIES)) {
    provinceCodes.add("03");
  }

  const radiusRaw = input.orderRadiusKm;
  const radiusKm =
    radiusRaw === "" || radiusRaw == null ? null : Number(radiusRaw);
  const hasRadius = Number.isFinite(radiusKm) && radiusKm >= 0;

  return {
    ...compactServiceAreas({
      communityCodes: [...communityCodes].filter(isOfficialCommunityCode),
      provinceCodes: [...provinceCodes].filter(isOfficialProvinceCode),
    }),
    cities,
    unmatched,
    mapped,
    radiusKm: hasRadius ? radiusKm : null,
  };
}

export function serviceAreasFromCompany(company) {
  return normalizeLegacyCoverage({
    operatingCities: company?.deliveryPricing?.operatingCities,
    serviceAreas: company?.serviceAreas,
    orderRadiusKm:
      company?.orderRadiusKm ?? company?.deliveryPricing?.radiusKm ?? null,
  });
}
