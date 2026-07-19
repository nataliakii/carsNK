import locations from "@/data/delivery-locations.json";

/**
 * Curated Halkidiki / Thessaloniki transfer points (shared with delivery zones seed).
 * @returns {{ name: string, distanceKm?: number }[]}
 */
export function getTransferLocationOptions() {
  const names = new Set();
  const list = [];
  for (const row of locations) {
    const name = String(row?.name || "").trim();
    if (!name || names.has(name)) continue;
    names.add(name);
    list.push({
      name,
      distanceKm:
        typeof row.distanceKm === "number" && Number.isFinite(row.distanceKm)
          ? row.distanceKm
          : undefined,
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

function normalizePlaceKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Look up curated distance-from-base (km) for a place name.
 * @param {string} placeName
 * @returns {number | null}
 */
export function getCuratedDistanceKm(placeName) {
  const key = normalizePlaceKey(placeName);
  if (!key) return null;
  let soft = null;
  for (const row of locations) {
    const name = normalizePlaceKey(row?.name);
    if (!name) continue;
    const km = Number.isFinite(row.distanceKm) ? Number(row.distanceKm) : null;
    if (km == null) continue;
    if (name === key) return km;
    if (soft == null && (key.includes(name) || name.includes(key))) {
      soft = km;
    }
  }
  return soft;
}

/**
 * Rough A→B km from curated hub distances when Google Maps is unavailable.
 * Assumes distanceKm is from the same base (airport / Nea Kallikratia area).
 *
 * @param {string} from
 * @param {string} to
 */
export function estimateTransferDistanceFromCatalog(from, to) {
  const dFrom = getCuratedDistanceKm(from);
  const dTo = getCuratedDistanceKm(to);
  if (dFrom == null || dTo == null) {
    return {
      ok: false,
      message: "No catalog estimate for these places",
    };
  }
  const distanceKm = Math.round(Math.abs(dFrom - dTo) * 10) / 10;
  const durationMinutes = Math.max(
    5,
    Math.round((Math.max(distanceKm, 1) / 55) * 60)
  );
  return {
    ok: true,
    distanceKm,
    durationMinutes,
    approximate: true,
  };
}

/**
 * Build a geocoding-friendly query for Google Distance Matrix.
 * @param {string} placeName
 */
export function toGooglePlaceQuery(placeName) {
  const name = String(placeName || "").trim();
  if (!name) return "";
  const lower = name.toLowerCase();
  if (lower.includes("airport")) {
    return "Thessaloniki Airport SKG, Greece";
  }
  if (lower === "thessaloniki") {
    return "Thessaloniki, Greece";
  }
  if (lower === "halkidiki" || lower === "chalkidiki") {
    return "Chalkidiki, Greece";
  }
  return `${name}, Halkidiki, Greece`;
}

export default getTransferLocationOptions;
