"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import PartnerReviewDetail, {
  formatPartnerDate,
  partnerStatusColor,
} from "@/app/admin/legal-profile/_components/PartnerReviewDetail";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { partnersTabHref } from "@/domain/admin/partnersPage";
import {
  PARTNER_REVIEW_FILTER,
  resolvePartnerReviewUrl,
  shouldShowPendingEmpty,
  visiblePartnerRows,
} from "@/domain/legal/partnerReviewWorkspace";

const S_PENDING = "PENDING_VERIFICATION";

/**
 * Superadmin queue: review partner KYB without opening company admin.
 */
export default function PartnerReviewQueue({ viewMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams.get("companyId") || "";
  const urlFilter = searchParams.get("filter");
  const { country: adminCountry } = useAdminCountryFilter();

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (adminCountry) params.set("country", adminCountry);
      const res = await fetch(`/api/admin/legal/partners?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to load (${res.status})`);
      }
      setRows(Array.isArray(json.partners) ? json.partners : []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [adminCountry]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = (rows || []).filter(
    (row) => row.verification?.status === S_PENDING
  ).length;

  const resolved = useMemo(
    () =>
      resolvePartnerReviewUrl({
        filter: urlFilter,
        companyId: urlCompanyId,
        rows: rows || [],
      }),
    [urlFilter, urlCompanyId, rows]
  );
  const filter = rows ? resolved.filter : urlFilter === "all" ? "all" : "pending";
  const selectedId = rows ? resolved.companyId : urlCompanyId;

  const visible = useMemo(
    () => (rows ? visiblePartnerRows(rows, filter) : []),
    [rows, filter]
  );
  const selected = visible.find((row) => row.companyId === selectedId) || null;
  const showEmptyPending = Boolean(rows) && shouldShowPendingEmpty({
    filter,
    visibleCount: visible.length,
    selectedVisible: Boolean(selected),
  });

  const writeUrl = useCallback(
    (next, mode) => {
      const href = partnersTabHref("review", {
        filter: next.filter,
        companyId: next.companyId,
      });
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (!rows) return;
    if (resolved.filter === (urlFilter || "") && resolved.companyId === urlCompanyId) {
      return;
    }
    writeUrl(resolved, "replace");
  }, [rows, resolved, urlFilter, urlCompanyId, writeUrl]);

  function selectCompany(companyId) {
    writeUrl({ filter, companyId }, "push");
  }

  function activateFilter(next) {
    const row = (rows || []).find((item) => item.companyId === selectedId);
    const pending = row?.verification?.status === S_PENDING;
    writeUrl(
      {
        filter: next,
        companyId: next === PARTNER_REVIEW_FILTER.PENDING && row && !pending ? "" : selectedId,
      },
      "push"
    );
  }

  if (loading && !rows) {
    return (
      <Stack spacing={2} alignItems="flex-start">
        <CircularProgress size={22} />
        <Typography variant="body2" color="text.secondary">
          {t("admin.legalHub.queueLoading", { defaultValue: "Loading partners…" })}
        </Typography>
      </Stack>
    );
  }

  if (error && !rows) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
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

  return (
    <Stack spacing={2}>
      {error ? (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={load}>
              {t("admin.legalHub.queueRetry", { defaultValue: "Retry" })}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 800 }}>
        {t("admin.legalHub.queueTitle", { defaultValue: "Partner reviews" })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("admin.legalHub.queueSubtitle", {
          defaultValue: "Pending KYB submissions for the selected workspace.",
        })}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip
          clickable
          color={filter === "pending" ? "warning" : "default"}
          variant={filter === "pending" ? "filled" : "outlined"}
          label={t("admin.legalHub.queueNeedsReview", {
            count: pendingCount,
            defaultValue: `Needs review (${pendingCount})`,
          })}
          onClick={() => activateFilter(PARTNER_REVIEW_FILTER.PENDING)}
        />
        <Chip
          clickable
          color={filter === "all" ? "primary" : "default"}
          variant={filter === "all" ? "filled" : "outlined"}
          label={t("admin.legalHub.queueAll", {
            defaultValue: `All companies (${rows?.length || 0})`,
            count: rows?.length || 0,
          })}
          onClick={() => activateFilter(PARTNER_REVIEW_FILTER.ALL)}
        />
      </Stack>

      {showEmptyPending ? (
        <Alert severity="success">
          {t("admin.legalHub.queueEmpty", {
            defaultValue: "No companies are waiting for review.",
          })}
        </Alert>
      ) : (
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems="flex-start"
      >
        <Stack spacing={1} sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0 }}>
          {visible.map((row) => {
            const status = row.verification?.status || "NO_PROFILE";
            const active = row.companyId === selectedId;
            const missing = row.verification?.missingDocuments?.length || 0;
            const submitted =
              row.verification?.submittedAt || row.verification?.statusAt;
            return (
              <Box
                key={row.companyId}
                onClick={() => selectCompany(row.companyId)}
                sx={{
                  p: 1.5,
                  border: "1px solid",
                  borderColor: active ? "primary.main" : "divider",
                  borderRadius: 2,
                  cursor: "pointer",
                  bgcolor: active ? "action.hover" : "background.paper",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {row.companyName}
                  </Typography>
                  {row.country ? (
                    <Chip size="small" variant="outlined" label={row.country} />
                  ) : null}
                  <Chip
                    size="small"
                    color={partnerStatusColor(status)}
                    label={
                      row.displayStatusLabel ||
                      (row.verification
                        ? t(`partnerLegal.status.${status}.label`, {
                            defaultValue: status,
                          })
                        : t("admin.legalHub.queueNoProfile", {
                            defaultValue: "No profile",
                          }))
                    }
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block">
                  {row.verification?.legalName || row.companyEmail || row.companyId}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {submitted ? (
                    <Typography variant="caption" color="text.secondary">
                      {t("admin.legalHub.queueSubmitted", {
                        defaultValue: "Submitted {{date}}",
                        date: formatPartnerDate(submitted),
                      })}
                    </Typography>
                  ) : null}
                  {missing > 0 ? (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      label={t("admin.legalHub.queueMissingDocs", {
                        defaultValue: "{{count}} docs missing",
                        count: missing,
                      })}
                    />
                  ) : null}
                  {(row.verification?.documents || []).length > 0 ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t("admin.legalHub.queueDocCount", {
                        defaultValue: "{{count}} files",
                        count: row.verification.documents.length,
                      })}
                    />
                  ) : null}
                </Stack>
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectCompany(row.companyId);
                  }}
                >
                  {t("admin.legalHub.queueReview", { defaultValue: "Review" })}
                </Button>
              </Box>
            );
          })}
          {filter === "all" && visible.length === 0 ? (
            <Alert severity="info">
              {t("admin.legalHub.queueNoCompanies", {
                defaultValue: "No companies in this workspace.",
              })}
            </Alert>
          ) : null}
        </Stack>

        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          {!selected ? (
            <Alert severity="info">
              {t("admin.legalHub.queuePick", {
                defaultValue: "Select a partner to review.",
              })}
            </Alert>
          ) : (
            <PartnerReviewDetail
              row={selected}
              onChanged={load}
              viewMode={viewMode}
              onLeftQueue={async () => {
                window.dispatchEvent(new Event("rovaro-inbox-refresh"));
                const leftId = selected.companyId;
                try {
                  const params = new URLSearchParams();
                  if (adminCountry) params.set("country", adminCountry);
                  const res = await fetch(`/api/admin/legal/partners?${params}`, {
                    cache: "no-store",
                  });
                  const json = await res.json().catch(() => ({}));
                  const partners = Array.isArray(json.partners) ? json.partners : [];
                  setRows(partners);
                  const remaining = partners.filter(
                    (item) =>
                      item.companyId !== leftId &&
                      item.verification?.status === S_PENDING
                  );
                  if (remaining[0]) {
                    writeUrl(
                      {
                        filter: PARTNER_REVIEW_FILTER.PENDING,
                        companyId: remaining[0].companyId,
                      },
                      "push"
                    );
                  } else {
                    writeUrl(
                      { filter: PARTNER_REVIEW_FILTER.PENDING, companyId: "" },
                      "push"
                    );
                  }
                } catch {
                  writeUrl(
                    { filter: PARTNER_REVIEW_FILTER.PENDING, companyId: "" },
                    "push"
                  );
                }
              }}
            />
          )}
        </Box>
      </Stack>
      )}
    </Stack>
  );
}
