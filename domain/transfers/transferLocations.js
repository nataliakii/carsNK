import locations from "@/data/delivery-locations.json";

/**
 * Curated Halkidiki / Thessaloniki transfer points (shared with delivery zones seed).
 * @returns {{ name: string }[]}
 */
export function getTransferLocationOptions() {
  const names = new Set();
  const list = [];
  for (const row of locations) {
    const name = String(row?.name || "").trim();
    if (!name || names.has(name)) continue;
    names.add(name);
    list.push({ name });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, "en"));
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
