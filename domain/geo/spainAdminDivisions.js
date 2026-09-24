/**
 * Official Spanish administrative divisions (INE codes).
 *
 * Communities: 17 autonomous communities + Ceuta and Melilla.
 * Provinces: 50 provinces + Ceuta and Melilla.
 *
 * Costa Brava is not a community or province. It is a tourism label that
 * may later sit under Cataluña → Girona.
 */

export function foldAdminText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function padAdminCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^\d{1,2}$/.test(raw)) return "";
  return raw.padStart(2, "0");
}

/** Display order requested for the service-area chips. */
export const SPAIN_COMMUNITIES = [
  { code: "01", name: "Andalucía" },
  { code: "02", name: "Aragón" },
  { code: "03", name: "Asturias" },
  { code: "04", name: "Illes Balears" },
  { code: "05", name: "Canarias" },
  { code: "06", name: "Cantabria" },
  { code: "08", name: "Castilla-La Mancha" },
  { code: "07", name: "Castilla y León" },
  { code: "09", name: "Cataluña" },
  { code: "10", name: "Comunitat Valenciana" },
  { code: "11", name: "Extremadura" },
  { code: "12", name: "Galicia" },
  { code: "13", name: "Comunidad de Madrid" },
  { code: "14", name: "Región de Murcia" },
  { code: "15", name: "Navarra" },
  { code: "16", name: "País Vasco" },
  { code: "17", name: "La Rioja" },
  { code: "18", name: "Ceuta" },
  { code: "19", name: "Melilla" },
];

export const SPAIN_PROVINCES = [
  { code: "04", communityCode: "01", name: "Almería" },
  { code: "11", communityCode: "01", name: "Cádiz" },
  { code: "14", communityCode: "01", name: "Córdoba" },
  { code: "18", communityCode: "01", name: "Granada" },
  { code: "21", communityCode: "01", name: "Huelva" },
  { code: "23", communityCode: "01", name: "Jaén" },
  { code: "29", communityCode: "01", name: "Málaga" },
  { code: "41", communityCode: "01", name: "Sevilla" },
  { code: "22", communityCode: "02", name: "Huesca" },
  { code: "44", communityCode: "02", name: "Teruel" },
  { code: "50", communityCode: "02", name: "Zaragoza" },
  { code: "33", communityCode: "03", name: "Asturias" },
  { code: "07", communityCode: "04", name: "Illes Balears" },
  { code: "35", communityCode: "05", name: "Las Palmas" },
  { code: "38", communityCode: "05", name: "Santa Cruz de Tenerife" },
  { code: "39", communityCode: "06", name: "Cantabria" },
  { code: "05", communityCode: "07", name: "Ávila" },
  { code: "09", communityCode: "07", name: "Burgos" },
  { code: "24", communityCode: "07", name: "León" },
  { code: "34", communityCode: "07", name: "Palencia" },
  { code: "37", communityCode: "07", name: "Salamanca" },
  { code: "40", communityCode: "07", name: "Segovia" },
  { code: "42", communityCode: "07", name: "Soria" },
  { code: "47", communityCode: "07", name: "Valladolid" },
  { code: "49", communityCode: "07", name: "Zamora" },
  { code: "02", communityCode: "08", name: "Albacete" },
  { code: "13", communityCode: "08", name: "Ciudad Real" },
  { code: "16", communityCode: "08", name: "Cuenca" },
  { code: "19", communityCode: "08", name: "Guadalajara" },
  { code: "45", communityCode: "08", name: "Toledo" },
  { code: "08", communityCode: "09", name: "Barcelona" },
  { code: "17", communityCode: "09", name: "Girona" },
  { code: "25", communityCode: "09", name: "Lleida" },
  { code: "43", communityCode: "09", name: "Tarragona" },
  { code: "03", communityCode: "10", name: "Alicante" },
  { code: "12", communityCode: "10", name: "Castellón" },
  { code: "46", communityCode: "10", name: "Valencia" },
  { code: "06", communityCode: "11", name: "Badajoz" },
  { code: "10", communityCode: "11", name: "Cáceres" },
  { code: "15", communityCode: "12", name: "A Coruña" },
  { code: "27", communityCode: "12", name: "Lugo" },
  { code: "32", communityCode: "12", name: "Ourense" },
  { code: "36", communityCode: "12", name: "Pontevedra" },
  { code: "28", communityCode: "13", name: "Madrid" },
  { code: "30", communityCode: "14", name: "Murcia" },
  { code: "31", communityCode: "15", name: "Navarra" },
  { code: "01", communityCode: "16", name: "Álava" },
  { code: "20", communityCode: "16", name: "Gipuzkoa" },
  { code: "48", communityCode: "16", name: "Bizkaia" },
  { code: "26", communityCode: "17", name: "La Rioja" },
  { code: "51", communityCode: "18", name: "Ceuta" },
  { code: "52", communityCode: "19", name: "Melilla" },
];

const COMMUNITY_BY_CODE = Object.fromEntries(
  SPAIN_COMMUNITIES.map((item) => [item.code, item])
);
const PROVINCE_BY_CODE = Object.fromEntries(
  SPAIN_PROVINCES.map((item) => [item.code, item])
);

const PROVINCES_BY_COMMUNITY = SPAIN_COMMUNITIES.reduce((acc, community) => {
  acc[community.code] = SPAIN_PROVINCES.filter(
    (province) => province.communityCode === community.code
  );
  return acc;
}, {});

export const SPAIN_MAINLAND_COMMUNITY_CODES = SPAIN_COMMUNITIES.filter(
  (item) => item.code !== "18" && item.code !== "19"
).map((item) => item.code);

export const SPAIN_AUTONOMOUS_CITY_CODES = ["18", "19"];

export function spainCommunities() {
  return SPAIN_COMMUNITIES;
}

export function spainProvinces() {
  return SPAIN_PROVINCES;
}

export function communityByCode(code) {
  return COMMUNITY_BY_CODE[padAdminCode(code)] || null;
}

export function provinceByCode(code) {
  return PROVINCE_BY_CODE[padAdminCode(code)] || null;
}

export function isOfficialCommunityCode(code) {
  return Boolean(communityByCode(code));
}

export function isOfficialProvinceCode(code) {
  return Boolean(provinceByCode(code));
}

export function provincesForCommunity(communityCode) {
  return PROVINCES_BY_COMMUNITY[padAdminCode(communityCode)] || [];
}

export function emptyServiceAreas() {
  return { communityCodes: [], provinceCodes: [] };
}

export function uniqueAdminCodes(values, kind) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const code = padAdminCode(raw);
    if (!code || seen.has(code)) continue;
    if (kind === "community" && !isOfficialCommunityCode(code)) continue;
    if (kind === "province" && !isOfficialProvinceCode(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/**
 * Drop province codes already covered by a selected community.
 * If every province of a community is listed, promote to that community.
 */
export function compactServiceAreas(raw = {}) {
  const communityCodes = uniqueAdminCodes(raw.communityCodes, "community");
  const provinceCodes = uniqueAdminCodes(raw.provinceCodes, "province");
  const communitySet = new Set(communityCodes);

  for (const community of SPAIN_COMMUNITIES) {
    const provinces = provincesForCommunity(community.code);
    if (!provinces.length) continue;
    const allSelected = provinces.every((province) =>
      provinceCodes.includes(province.code)
    );
    if (allSelected) communitySet.add(community.code);
  }

  const compactedCommunities = SPAIN_COMMUNITIES.map((item) => item.code).filter(
    (code) => communitySet.has(code)
  );
  const implied = new Set();
  for (const code of compactedCommunities) {
    for (const province of provincesForCommunity(code)) {
      implied.add(province.code);
    }
  }

  return {
    communityCodes: compactedCommunities,
    provinceCodes: provinceCodes.filter((code) => !implied.has(code)),
  };
}

export function normalizeServiceAreasInput(raw) {
  if (raw == null) {
    return { ok: true, value: emptyServiceAreas() };
  }
  if (typeof raw !== "object") {
    return { ok: false, message: "serviceAreas must be an object" };
  }
  return {
    ok: true,
    value: compactServiceAreas({
      communityCodes: raw.communityCodes,
      provinceCodes: raw.provinceCodes,
    }),
  };
}

export function isCommunityFullySelected(areas, communityCode) {
  const code = padAdminCode(communityCode);
  return (areas?.communityCodes || []).includes(code);
}

export function isProvinceExplicitlySelected(areas, provinceCode) {
  const code = padAdminCode(provinceCode);
  return (areas?.provinceCodes || []).includes(code);
}

export function isProvinceCovered(areas, provinceCode) {
  const province = provinceByCode(provinceCode);
  if (!province) return false;
  if (isCommunityFullySelected(areas, province.communityCode)) return true;
  return isProvinceExplicitlySelected(areas, province.code);
}

export function communitiesWithVisibleProvinces(areas) {
  const selectedCommunities = new Set(areas?.communityCodes || []);
  for (const code of areas?.provinceCodes || []) {
    const province = provinceByCode(code);
    if (province) selectedCommunities.add(province.communityCode);
  }
  return SPAIN_COMMUNITIES.filter((item) => selectedCommunities.has(item.code));
}

export function toggleCommunitySelection(areas, communityCode) {
  const code = padAdminCode(communityCode);
  if (!isOfficialCommunityCode(code)) {
    return compactServiceAreas(areas);
  }
  const current = compactServiceAreas(areas);
  if (current.communityCodes.includes(code)) {
    return compactServiceAreas({
      communityCodes: current.communityCodes.filter((item) => item !== code),
      provinceCodes: current.provinceCodes,
    });
  }
  return compactServiceAreas({
    communityCodes: [...current.communityCodes, code],
    provinceCodes: current.provinceCodes.filter(
      (item) => provinceByCode(item)?.communityCode !== code
    ),
  });
}

export function toggleProvinceSelection(areas, provinceCode) {
  const province = provinceByCode(provinceCode);
  if (!province) return compactServiceAreas(areas);
  const current = compactServiceAreas(areas);
  const siblings = provincesForCommunity(province.communityCode).map(
    (item) => item.code
  );

  if (current.communityCodes.includes(province.communityCode)) {
    return compactServiceAreas({
      communityCodes: current.communityCodes.filter(
        (item) => item !== province.communityCode
      ),
      provinceCodes: [
        ...current.provinceCodes,
        ...siblings.filter((code) => code !== province.code),
      ],
    });
  }

  if (current.provinceCodes.includes(province.code)) {
    return compactServiceAreas({
      communityCodes: current.communityCodes,
      provinceCodes: current.provinceCodes.filter((code) => code !== province.code),
    });
  }

  return compactServiceAreas({
    communityCodes: current.communityCodes,
    provinceCodes: [...current.provinceCodes, province.code],
  });
}

export function coveredProvinceCodes(areas) {
  const codes = new Set();
  for (const code of areas?.communityCodes || []) {
    for (const province of provincesForCommunity(code)) {
      codes.add(province.code);
    }
  }
  for (const code of areas?.provinceCodes || []) {
    if (isOfficialProvinceCode(code)) codes.add(code);
  }
  return [...codes];
}

export function communityName(code) {
  return communityByCode(code)?.name || "";
}

export function provinceName(code) {
  return provinceByCode(code)?.name || "";
}
