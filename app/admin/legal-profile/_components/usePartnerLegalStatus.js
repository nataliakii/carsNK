"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      response.ok
        ? "Could not read legal package status"
        : `Could not load legal package status (${response.status})`
    );
  }
}

/**
 * Server-computed operating gate for the signed-in (or view-as) partner.
 * The client only renders the answer — it does not re-derive the rule.
 */
export default function usePartnerLegalStatus() {
  const { i18n } = useTranslation();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const language = String(i18n.language || "en").split("-")[0];
      const res = await fetch(
        `/api/partner/legal/status?lang=${encodeURIComponent(language)}`,
        { cache: "no-store" }
      );
      const json = await readJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not load legal package status");
      }
      setPayload(json);
    } catch (err) {
      setPayload(null);
      setError(err?.message || "Could not load legal package status");
    } finally {
      setLoading(false);
    }
  }, [i18n.language]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const handleRefresh = () => reload();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("rovaro-inbox-refresh", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(reload, 25_000);
    return () => {
      window.removeEventListener("rovaro-inbox-refresh", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [reload]);

  return {
    loading,
    error,
    payload,
    gate: payload?.gate || null,
    listedOnMarketplace: payload?.listedOnMarketplace !== false,
    canListPublicly: Boolean(payload?.canListPublicly),
    legalState: payload?.legalState || "",
    legalActionCount: Number(payload?.legalActionCount) || 0,
    changedDocumentTypes: payload?.changedDocumentTypes || [],
    missingDocumentTypes: payload?.missingDocumentTypes || [],
    legalManifest: payload?.legalManifest || [],
    signedAgreement: payload?.signedAgreement || null,
    agreementPackage: payload
      ? {
          success: true,
          documents: payload.documents || [],
          manifest: payload.manifest || [],
          packageChecksum: payload.currentPackageChecksum || "",
          legalState: payload.legalState || "NOT_PUBLISHED",
          activeAgreement: payload.signedAgreement || null,
          acceptanceStatement: payload.acceptanceStatement || "",
        }
      : null,
    /** Server-resolved. Terms and Documents render this same value. */
    termsPublication: payload?.termsPublication || "",
    terms: payload?.terms || null,
    reload,
  };
}
