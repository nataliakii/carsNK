"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const POLL_MS = 25000;
const EMPTY = Object.freeze({
  rentals: 0,
  transfers: 0,
  ordersBadge: 0,
  total: 0,
  bookings: Object.freeze({ count: 0, tasks: [] }),
  companySetup: Object.freeze({ count: 0, tasks: [] }),
  ready: false,
  checkedAt: null,
  error: null,
  arrival: null,
});

/** @type {typeof EMPTY} */
let snapshot = EMPTY;
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;
/** @type {string} */
let activeCountry = "ALL";
let enabledCount = 0;
/** @type {Promise<void> | null} */
let inFlight = null;
/** A refresh requested mid-request must not reuse the older response. */
let refetchQueued = false;
/** @type {number | null} */
let baselineTotal = null;
/** @type {(() => void) | null} */
let removeWindowListeners = null;

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(partial) {
  snapshot = Object.freeze({ ...snapshot, ...partial });
  emit();
}

async function fetchPending(country, { fresh = false } = {}) {
  if (inFlight) {
    if (fresh) refetchQueued = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      const res = await fetch(`/api/admin/inbox/pending?${params}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setSnapshot({
          error: data.message || "Failed to load inbox",
          ready: true,
        });
        return;
      }
      const rentals = Number(data.rentals) || 0;
      const transfers = Number(data.transfers) || 0;
      const companySetup = data.companySetup || { count: 0, tasks: [] };
      const bookings = data.bookings || {
        count: rentals + transfers,
        tasks: [],
      };
      const total =
        Number.isFinite(Number(data.total))
          ? Number(data.total)
          : bookings.count + (Number(companySetup.count) || 0);

      const bookingTotal = Number(bookings.count) || 0;
      let arrival = snapshot.arrival;
      if (baselineTotal !== null && bookingTotal > baselineTotal) {
        arrival = {
          delta: bookingTotal - baselineTotal,
          rentals,
          transfers,
          total,
          at: Date.now(),
        };
      }
      baselineTotal = bookingTotal;

      setSnapshot({
        rentals,
        transfers,
        ordersBadge: Number(data.ordersBadge) || rentals,
        bookings,
        companySetup,
        total,
        ready: true,
        checkedAt: data.checkedAt || new Date().toISOString(),
        error: null,
        arrival,
      });
    } catch (err) {
      setSnapshot({
        error: err?.message || "Failed to load inbox",
        ready: true,
      });
    } finally {
      inFlight = null;
      if (refetchQueued) {
        refetchQueued = false;
        fetchPending(country);
      }
    }
  })();
  return inFlight;
}

function startPolling(country) {
  activeCountry = country || "ALL";
  if (timer) return;
  fetchPending(activeCountry);
  timer = setInterval(() => fetchPending(activeCountry), POLL_MS);
  const onFocus = () => fetchPending(activeCountry);
  const onVis = () => {
    if (document.visibilityState === "visible") fetchPending(activeCountry);
  };
  const onRefresh = () => fetchPending(activeCountry, { fresh: true });
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("rovaro-inbox-refresh", onRefresh);
  removeWindowListeners = () => {
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("rovaro-inbox-refresh", onRefresh);
  };
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  removeWindowListeners?.();
  removeWindowListeners = null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY;
}

/**
 * Shared poller for admin pending rentals + transfers.
 * @param {{ enabled?: boolean, country?: string }} [opts]
 */
export function useAdminPendingInbox(opts = {}) {
  const enabled = opts.enabled !== false;
  const country = opts.country || "ALL";
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!enabled) return undefined;
    enabledCount += 1;
    if (country !== activeCountry) {
      activeCountry = country;
      baselineTotal = null;
      fetchPending(activeCountry);
    }
    startPolling(activeCountry);
    return () => {
      enabledCount = Math.max(0, enabledCount - 1);
      if (enabledCount === 0) stopPolling();
    };
  }, [enabled, country]);

  const dismissArrival = useCallback(() => {
    setSnapshot({ arrival: null });
  }, []);

  const refresh = useCallback(
    () => fetchPending(activeCountry, { fresh: true }),
    []
  );

  return {
    ...store,
    dismissArrival,
    refresh,
  };
}

export function formatPendingBadgeCount(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return "";
  return n > 99 ? "99+" : String(n);
}
