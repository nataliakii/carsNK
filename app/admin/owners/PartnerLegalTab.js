"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import PartnerReviewDetail from "@/app/admin/legal-profile/_components/PartnerReviewDetail";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";

/**
 * Legal tab for one selected partner.
 *
 * Renders the same KYB detail as the Partners → Needs review queue, scoped to
 * a single company, so verification decisions live in exactly one component.
 */
export default function PartnerLegalTab({ companyId, viewMode }) {
  const { t } = useTranslation();
  const { country } = useAdminCountryFilter();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (country) params.set("country", country);
      const res = await fetch(`/api/admin/legal/partners?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to load (${res.status})`);
      }
      const match = (json.partners || []).find(
        (partner) => String(partner.companyId) === String(companyId)
      );
      setRow(match || null);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, country]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !row) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <CircularProgress size={22} />
        <Typography variant="body2" color="text.secondary">
          {t("admin.legalHub.queueLoading", { defaultValue: "Loading partners…" })}
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Alert severity="error" sx={{ width: "100%" }}>
          {t("admin.legalHub.queueLoadFailed", {
            defaultValue: "Could not load partner reviews: {{message}}",
            message: error,
          })}
        </Alert>
        <Button variant="outlined" onClick={load}>
          {t("admin.legalHub.queueRetry", { defaultValue: "Retry" })}
        </Button>
      </Stack>
    );
  }

  if (!row) {
    return (
      <Alert severity="info">
        {t("partnerLegal.review.noProfile", {
          defaultValue: "This company has not started a legal profile yet.",
        })}
      </Alert>
    );
  }

  return (
    <PartnerReviewDetail row={row} onChanged={load} viewMode={viewMode} />
  );
}
