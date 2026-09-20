"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Server-computed operating gate for the signed-in (or view-as) partner.
 * The client only renders the answer — it does not re-derive the rule.
 */
export default function usePartnerLegalStatus() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/legal/status", { cache: "no-store" });
      const json = await res.json();
      setPayload(json.success ? json : null);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner/legal/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setPayload(json.success ? json : null);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    loading,
    payload,
    gate: payload?.gate || null,
    reload,
  };
}
