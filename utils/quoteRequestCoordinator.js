/**
 * Dedupe + cache in front of the canonical pricing action.
 *
 * Two requests for the same car, range and pickup pair share one network call
 * and one promise. That is what makes the panel safe under React Strict Mode,
 * where every effect body runs twice on mount: the second run joins the first
 * flight instead of starting a new one.
 *
 * This layer never computes a price. It only decides whether a call is needed.
 */

import { buildQuoteRequestKey } from "@/domain/booking/publicBookingMode";

const DEFAULT_TTL_MS = 60_000;

export function createQuoteCoordinator({
  fetchQuote,
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  /** @type {Map<string, {value: object, at: number}>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object>>} */
  const inFlight = new Map();
  let calls = 0;

  function readCache(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (now() - hit.at > ttlMs) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }

  return {
    /** Test/debug counter: how many real calls reached the action. */
    get callCount() {
      return calls;
    },

    peek(request) {
      return readCache(buildQuoteRequestKey(request));
    },

    /**
     * @param {{carId,startDate,endDate,placeIn,placeOut}} request
     * @returns {Promise<object|null>}
     */
    request(request) {
      const key = buildQuoteRequestKey(request);
      if (!key) return Promise.resolve(null);

      const cached = readCache(key);
      if (cached) return Promise.resolve(cached);

      const existing = inFlight.get(key);
      if (existing) return existing;

      calls += 1;
      // Start the call now rather than on a microtask, so the flight is
      // already open for the very next caller in the same tick.
      let started;
      try {
        started = Promise.resolve(fetchQuote(request));
      } catch (error) {
        started = Promise.reject(error);
      }

      const promise = started
        .then((value) => {
          // Only successful quotes are worth replaying to the next caller.
          if (value && value.ok !== false) {
            cache.set(key, { value, at: now() });
          }
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, promise);
      return promise;
    },

    /** Drop cached quotes after inventory changes under us. */
    invalidate(carId) {
      if (carId == null) {
        cache.clear();
        return;
      }
      const prefix = `${String(carId)}|`;
      [...cache.keys()].forEach((key) => {
        if (key.startsWith(prefix)) cache.delete(key);
      });
    },

    reset() {
      cache.clear();
      inFlight.clear();
      calls = 0;
    },
  };
}
