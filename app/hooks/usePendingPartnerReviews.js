"use client";

import { useEffect, useState } from "react";

/**
 * One in-memory count per workspace country, shared by the navbar and the
 * Needs review tab so they do not fetch two different badge values.
 */
const buckets = new Map();

function bucketFor(country) {
  const key = country || "ALL";
  let entry = buckets.get(key);
  if (!entry) {
    entry = { count: 0, listeners: new Set(), timer: null };
    buckets.set(key, entry);
  }
  return entry;
}

async function refreshPartnerReviewCount(country) {
  const entry = bucketFor(country);
  try {
    const params = new URLSearchParams({ summary: "1" });
    if (country) params.set("country", country);
    const res = await fetch(`/api/admin/legal/partners?${params}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.success) {
      entry.count = Number(json.pendingReview) || 0;
      entry.listeners.forEach((listener) => listener(entry.count));
    }
  } catch {
    /* badge is best-effort */
  }
}

/**
 * Superadmin badge: partners waiting on KYB review in the active workspace.
 * @param {{ enabled?: boolean, country?: string }} [opts]
 */
export function usePendingPartnerReviews({
  enabled = false,
  country = "ALL",
} = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }

    const entry = bucketFor(country);
    const onChange = (next) => setCount(next);
    entry.listeners.add(onChange);
    setCount(entry.count);
    if (entry.listeners.size === 1) {
      refreshPartnerReviewCount(country);
      entry.timer = setInterval(
        () => refreshPartnerReviewCount(country),
        60_000
      );
    }

    return () => {
      entry.listeners.delete(onChange);
      if (entry.listeners.size === 0 && entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
      }
    };
  }, [enabled, country]);

  return count;
}
