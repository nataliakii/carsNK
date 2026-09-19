import Stripe from "stripe";
import {
  getStripeMode,
  getStripeSecretKey,
  isStripeConfigured,
} from "@config/stripe";

/** @type {Map<string, import("stripe").default>} */
const clients = new Map();

/**
 * Lazy Stripe SDK client for the active (or requested) mode.
 * Returns null when the secret key for that mode is missing.
 *
 * @param {"test"|"live"} [mode]
 * @returns {import("stripe").default | null}
 */
export function getStripeClient(mode = getStripeMode()) {
  const secret = getStripeSecretKey(mode);
  if (!secret) return null;

  const cached = clients.get(`${mode}:${secret.slice(-8)}`);
  if (cached) return cached;

  const client = new Stripe(secret, {
    apiVersion: "2026-08-26.dahlia",
  });
  clients.set(`${mode}:${secret.slice(-8)}`, client);
  return client;
}

export function assertStripeReady(mode = getStripeMode()) {
  if (!isStripeConfigured(mode)) {
    const err = new Error(
      `Stripe is not configured for mode "${mode}". Set STRIPE_SECRET_KEY_${mode === "live" ? "LIVE" : "TEST"} (or STRIPE_SECRET_KEY).`
    );
    err.code = "stripe_not_configured";
    throw err;
  }
  const client = getStripeClient(mode);
  if (!client) {
    const err = new Error("Stripe client unavailable");
    err.code = "stripe_unavailable";
    throw err;
  }
  return client;
}

export { getStripeMode, isStripeConfigured };
