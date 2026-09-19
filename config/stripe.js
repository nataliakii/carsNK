/**
 * Stripe configuration — test and live keys side by side.
 *
 * Mode selection (first match wins):
 * 1. STRIPE_MODE=test|live (explicit)
 * 2. Infer from STRIPE_SECRET_KEY if set (sk_test_ → test, sk_live_ → live)
 * 3. Default: test
 *
 * Preferred env layout:
 *   STRIPE_MODE=test
 *   STRIPE_SECRET_KEY_TEST=sk_test_...
 *   STRIPE_SECRET_KEY_LIVE=sk_live_...
 *   STRIPE_PUBLISHABLE_KEY_TEST=pk_test_...
 *   STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_...
 *   STRIPE_WEBHOOK_SECRET_TEST=whsec_...
 *   STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
 *
 * Legacy single-key fallback:
 *   STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET
 */

export const STRIPE_MODES = Object.freeze({
  TEST: "test",
  LIVE: "live",
});

function trim(value) {
  return String(value || "").trim();
}

function inferModeFromSecret(secret) {
  const key = trim(secret);
  if (key.startsWith("sk_live_")) return STRIPE_MODES.LIVE;
  if (key.startsWith("sk_test_")) return STRIPE_MODES.TEST;
  return null;
}

/**
 * @returns {"test"|"live"}
 */
export function getStripeMode() {
  const explicit = trim(process.env.STRIPE_MODE).toLowerCase();
  if (explicit === STRIPE_MODES.LIVE || explicit === STRIPE_MODES.TEST) {
    return explicit;
  }

  const inferred =
    inferModeFromSecret(process.env.STRIPE_SECRET_KEY) ||
    inferModeFromSecret(process.env.STRIPE_SECRET_KEY_LIVE) ||
    inferModeFromSecret(process.env.STRIPE_SECRET_KEY_TEST);

  return inferred || STRIPE_MODES.TEST;
}

export function isStripeLiveMode() {
  return getStripeMode() === STRIPE_MODES.LIVE;
}

/**
 * @param {"test"|"live"} [mode]
 */
export function getStripeSecretKey(mode = getStripeMode()) {
  if (mode === STRIPE_MODES.LIVE) {
    return (
      trim(process.env.STRIPE_SECRET_KEY_LIVE) ||
      (inferModeFromSecret(process.env.STRIPE_SECRET_KEY) === STRIPE_MODES.LIVE
        ? trim(process.env.STRIPE_SECRET_KEY)
        : "")
    );
  }
  return (
    trim(process.env.STRIPE_SECRET_KEY_TEST) ||
    (inferModeFromSecret(process.env.STRIPE_SECRET_KEY) === STRIPE_MODES.TEST
      ? trim(process.env.STRIPE_SECRET_KEY)
      : "") ||
    // Dev convenience: bare STRIPE_SECRET_KEY when mode is test
    (mode === STRIPE_MODES.TEST ? trim(process.env.STRIPE_SECRET_KEY) : "")
  );
}

/**
 * @param {"test"|"live"} [mode]
 */
export function getStripePublishableKey(mode = getStripeMode()) {
  if (mode === STRIPE_MODES.LIVE) {
    return (
      trim(process.env.STRIPE_PUBLISHABLE_KEY_LIVE) ||
      (trim(process.env.STRIPE_PUBLISHABLE_KEY).startsWith("pk_live_")
        ? trim(process.env.STRIPE_PUBLISHABLE_KEY)
        : "")
    );
  }
  return (
    trim(process.env.STRIPE_PUBLISHABLE_KEY_TEST) ||
    (trim(process.env.STRIPE_PUBLISHABLE_KEY).startsWith("pk_test_")
      ? trim(process.env.STRIPE_PUBLISHABLE_KEY)
      : "") ||
    (mode === STRIPE_MODES.TEST
      ? trim(process.env.STRIPE_PUBLISHABLE_KEY)
      : "")
  );
}

/**
 * @param {"test"|"live"} [mode]
 */
export function getStripeWebhookSecret(mode = getStripeMode()) {
  if (mode === STRIPE_MODES.LIVE) {
    return (
      trim(process.env.STRIPE_WEBHOOK_SECRET_LIVE) ||
      trim(process.env.STRIPE_WEBHOOK_SECRET)
    );
  }
  return (
    trim(process.env.STRIPE_WEBHOOK_SECRET_TEST) ||
    trim(process.env.STRIPE_WEBHOOK_SECRET)
  );
}

export function isStripeConfigured(mode = getStripeMode()) {
  return Boolean(getStripeSecretKey(mode));
}

/**
 * Public-safe snapshot for admin UI / client (no secrets).
 */
export function getStripePublicConfig() {
  const mode = getStripeMode();
  return {
    mode,
    configured: isStripeConfigured(mode),
    publishableKey: getStripePublishableKey(mode) || null,
    liveConfigured: isStripeConfigured(STRIPE_MODES.LIVE),
    testConfigured: isStripeConfigured(STRIPE_MODES.TEST),
  };
}
