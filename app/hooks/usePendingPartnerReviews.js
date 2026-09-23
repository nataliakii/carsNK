"use client";

import { useEffect, useState } from "react";

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
    if (!enabled) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const params = new URLSearchParams({ summary: "1" });
        if (country) params.set("country", country);
        const res = await fetch(`/api/admin/legal/partners?${params}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!cancelled && json.success) {
          setCount(Number(json.pendingReview) || 0);
        }
      } catch {
        /* badge is best-effort */
      }
    };

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, country]);

  return count;
}
