/**
 * Stripe Checkout success and cancel URLs are locale-free:
 * `/order/pay/success` and `/order/pay/cancel`.
 *
 * Public middleware otherwise prefixes the browser locale. Extra UI locales
 * such as Catalan (`ca`) are real URL prefixes, but these pages live in
 * `app/order/pay`, not under `app/[locale]`. A prefixed return therefore
 * 404s even after the payment webhook succeeds. Map every prefixed return
 * back onto the pages that exist, and keep `session_id` on the query.
 */

export const ORDER_PAY_SUCCESS_PATH = "/order/pay/success";
export const ORDER_PAY_CANCEL_PATH = "/order/pay/cancel";

const ORDER_PAY_RETURN_PATHS = new Set([
  ORDER_PAY_SUCCESS_PATH,
  ORDER_PAY_CANCEL_PATH,
]);

export function normalizeOrderPayPathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const withoutTrailing = withLeading.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

/**
 * @param {string} pathname
 * @returns {string | null} Locale-free page to render, or null when this is not a pay return.
 */
export function resolveOrderPayReturnPath(pathname) {
  const normalized = normalizeOrderPayPathname(pathname);
  if (ORDER_PAY_RETURN_PATHS.has(normalized)) return normalized;

  const segments = normalized.split("/").filter(Boolean);
  // /{prefix}/order/pay/success|cancel — prefix may be a routable locale (`ca`) or not.
  if (segments.length !== 4 || segments[1] !== "order" || segments[2] !== "pay") {
    return null;
  }

  const localeFree = `/${segments.slice(1).join("/")}`;
  return ORDER_PAY_RETURN_PATHS.has(localeFree) ? localeFree : null;
}
