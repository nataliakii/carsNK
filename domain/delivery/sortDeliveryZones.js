const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const PRIORITY_RULES = [
  {
    rank: 0,
    needles: [
      "airport",
      "aeroport",
      "aerodrom",
      "аэропорт",
      "аеропорт",
      "аеродром",
      "αεροδρομ",
    ],
  },
  {
    rank: 1,
    needles: [
      "thessaloniki",
      "thessalonica",
      "saloniki",
      "solun",
      "салоник",
      "солун",
      "θεσσαλονικ",
    ],
  },
  {
    rank: 2,
    needles: [
      "nea kallikratia",
      "nea kalikratia",
      "nea kalikratija",
      "неа калликрат",
      "неа каликрат",
      "νεα καλλικρατ",
      "νεα καλικρατ",
    ],
  },
];

function normalizeLocationName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_.,/\\()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPriorityRank(name) {
  const normalized = normalizeLocationName(name);
  for (const rule of PRIORITY_RULES) {
    if (rule.needles.some((needle) => normalized.includes(needle))) {
      return rule.rank;
    }
  }
  return PRIORITY_RULES.length;
}

function compareDeliveryZones(a, b) {
  const rankA = getPriorityRank(a?.name);
  const rankB = getPriorityRank(b?.name);
  if (rankA !== rankB) return rankA - rankB;

  const normalizedNameA = normalizeLocationName(a?.name);
  const normalizedNameB = normalizeLocationName(b?.name);
  const normalizedCompare = collator.compare(normalizedNameA, normalizedNameB);
  if (normalizedCompare !== 0) return normalizedCompare;

  const rawNameCompare = collator.compare(
    String(a?.name ?? ""),
    String(b?.name ?? "")
  );
  if (rawNameCompare !== 0) return rawNameCompare;

  const slugCompare = collator.compare(
    String(a?.slug ?? ""),
    String(b?.slug ?? "")
  );
  if (slugCompare !== 0) return slugCompare;

  return collator.compare(String(a?._id ?? ""), String(b?._id ?? ""));
}

export function sortDeliveryZones(zones = []) {
  return [...zones].sort(compareDeliveryZones);
}

export { getPriorityRank, normalizeLocationName };
