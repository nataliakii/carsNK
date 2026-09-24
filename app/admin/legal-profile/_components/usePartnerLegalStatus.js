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
    reload();
  }, [reload]);

  return {
    loading,
    payload,
    gate: payload?.gate || null,
    listedOnMarketplace: payload?.listedOnMarketplace !== false,
    canListPublicly: Boolean(payload?.canListPublicly),
    /** Server-resolved. Terms and Documents render this same value. */
    termsPublication: payload?.termsPublication || "",
    terms: payload?.terms || null,
    reload,
  };
}
