/**
 * Server communication for the public transfer request form.
 *
 * Components and hooks never call the network themselves; they call in here.
 * The market is resolved server-side from the request, so nothing in this file
 * sends a country: a browser cannot ask for another market's locations.
 */

const LOCATIONS_PATH = "/api/transfers/locations";
const QUOTE_PATH = "/api/transfers/quote";
const TRANSFERS_PATH = "/api/transfers";

/** Refusal codes the form turns into one translated sentence each. */
export const TRANSFER_ERROR = Object.freeze({
  OUT_OF_MARKET: "out_of_market",
});

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Pickup / dropoff points served in the caller's market.
 *
 * @returns {Promise<{ ok: boolean, marketCountry: string, names: string[] }>}
 */
export async function fetchTransferLocations() {
  try {
    const response = await fetch(LOCATIONS_PATH, { cache: "no-store" });
    const body = await readJson(response);
    if (!response.ok || !body.success) {
      return { ok: false, marketCountry: body.marketCountry || "", names: [] };
    }
    return {
      ok: true,
      marketCountry: String(body.marketCountry || ""),
      names: (body.items || [])
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean),
    };
  } catch {
    return { ok: false, marketCountry: "", names: [] };
  }
}

/**
 * Server-side price preview. Never trusts a browser-computed distance.
 *
 * @param {object} payload
 * @returns {Promise<{ ok: true, quote: object, route: object } | { ok: false, code?: string, message?: string }>}
 */
export async function requestTransferQuote(payload) {
  const response = await fetch(QUOTE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  if (!response.ok || !body.success) {
    return { ok: false, code: body.code, message: body.message };
  }
  return { ok: true, quote: body.quote, route: body.route };
}

/**
 * Submit a transfer request.
 *
 * @param {object} payload
 * @returns {Promise<{ ok: true, id: string } | { ok: false, code?: string, message?: string }>}
 */
export async function submitTransferRequest(payload) {
  const response = await fetch(TRANSFERS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson(response);
  if (!response.ok || !body.success) {
    return { ok: false, code: body.code, message: body.message };
  }
  return { ok: true, id: String(body.id || "") };
}
