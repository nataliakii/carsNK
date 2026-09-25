/**
 * SEARCH_FIRST prices every result for the same range in one request.
 * N cards each posting /calcTotalPrice is what tripped "Too many requests"
 * (the rental quote limiter is per POST, not per car).
 */

export const MAX_CATALOG_QUOTE_CARS = 40;

export function normalizeCatalogCarIds(carIds) {
  const seen = new Set();
  const ids = [];
  (Array.isArray(carIds) ? carIds : []).forEach((id) => {
    const key = id == null ? "" : String(id).trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    ids.push(key);
  });
  return ids.slice(0, MAX_CATALOG_QUOTE_CARS);
}

export function buildCatalogQuoteRequestKey({
  carIds,
  startDate,
  endDate,
  placeIn,
  placeOut,
}) {
  const ids = normalizeCatalogCarIds(carIds);
  if (!ids.length || !startDate || !endDate) return "";
  return [
    "catalog",
    startDate,
    endDate,
    (placeIn || "").trim(),
    (placeOut || "").trim(),
    ids.join(","),
  ].join("|");
}

export function catalogQuoteFromHttpBody(carId, body) {
  const total = Number(body?.totalPrice);
  const unavailable = body?.available === false;
  if (!body || body.ok === false) {
    return { status: "error", quote: null };
  }
  if (!unavailable && !(total > 0)) {
    return { status: "error", quote: null };
  }
  return {
    status: "ready",
    quote: {
      totalPrice: total,
      days: body.days,
      available: !unavailable,
      rangeKey: body.rangeKey,
      quoteId: body.quoteId || String(carId),
      breakdown: body.breakdown || null,
    },
  };
}
