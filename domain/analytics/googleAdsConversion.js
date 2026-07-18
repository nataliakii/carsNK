/**
 * Google Ads conversion (gtag event) — same payload as Google's purchase snippet.
 * Safe when gtag is absent (no consent / not loaded yet): optional redirect still runs.
 */

export const GOOGLE_ADS_PURCHASE_SEND_TO =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_SEND_TO ??
  "AW-18041368857/obwpCPqQz48cEJni5ZpD";

const DEFAULT_VALUE = 1.0;
const DEFAULT_CURRENCY = "EUR";

/**
 * @param {object} opts
 * @param {number} [opts.value]
 * @param {string} [opts.currency]
 * @param {string} [opts.transactionId]
 * @param {string} [opts.redirectUrl] - if set, navigates after hit (or immediately if no gtag)
 * @param {boolean} [opts.newCustomer] - only sent when true or false
 * @returns {false} for use as `return gtag_report_conversion(...)` in onclick handlers
 */
export function reportGoogleAdsConversion(opts = {}) {
  const {
    value = DEFAULT_VALUE,
    currency = DEFAULT_CURRENCY,
    transactionId = "",
    redirectUrl,
    newCustomer,
  } = opts;

  const callback = () => {
    if (redirectUrl != null && redirectUrl !== "") {
      window.location.assign(redirectUrl);
    }
  };

  if (typeof window === "undefined") {
    return false;
  }

  const gtag = window.gtag;
  if (typeof gtag !== "function") {
    callback();
    return false;
  }

  const payload = {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    value:
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : DEFAULT_VALUE,
    currency,
    transaction_id: String(transactionId ?? ""),
    event_callback: callback,
  };

  if (newCustomer === true || newCustomer === false) {
    payload.new_customer = newCustomer;
  }

  gtag("event", "conversion", payload);
  return false;
}

/**
 * Fire purchase conversion from an order object (public booking API response).
 */
export function reportGoogleAdsPurchaseFromOrder(order, options = {}) {
  if (!order) {
    return reportGoogleAdsConversion({
      newCustomer: options.newCustomer,
    });
  }
  const raw = Number(order.totalPrice);
  const value =
    Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_VALUE;
  const transactionId =
    order.orderNumber != null && order.orderNumber !== ""
      ? String(order.orderNumber)
      : order._id != null
        ? String(order._id)
        : "";
  const newCustomer =
    options.newCustomer === true || options.newCustomer === false
      ? options.newCustomer
      : order.newCustomer === true || order.newCustomer === false
        ? order.newCustomer
        : order.isNewCustomer === true || order.isNewCustomer === false
          ? order.isNewCustomer
          : undefined;
  return reportGoogleAdsConversion({
    value,
    currency: DEFAULT_CURRENCY,
    transactionId,
    newCustomer,
  });
}

/**
 * Google snippet compatibility: optional redirect after conversion ping.
 * @param {string} [url]
 */
export function gtag_report_conversion(url) {
  return reportGoogleAdsConversion({
    value: DEFAULT_VALUE,
    currency: DEFAULT_CURRENCY,
    transactionId: "",
    redirectUrl: url,
  });
}

if (typeof window !== "undefined") {
  window.gtag_report_conversion = gtag_report_conversion;
}
