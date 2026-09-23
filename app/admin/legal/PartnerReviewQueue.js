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

import PartnerReviewActions from "@/app/admin/legal-profile/_components/PartnerReviewActions";
import PartnerDocumentsCard from "@/app/admin/legal-profile/_components/PartnerDocumentsCard";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";

const S_PENDING = "PENDING_VERIFICATION";

function statusColor(status) {
  if (status === "VERIFIED") return "success";
  if (status === S_PENDING) return "warning";
  if (status === "REJECTED" || status === "SUSPENDED") return "error";
  return "default";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ py: 0.5 }}
      justifyContent="space-between"
    >
      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * Superadmin queue: review partner KYB without opening company admin.
 */
export default function PartnerReviewQueue() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("companyId") || "";
  const { country: adminCountry } = useAdminCountryFilter();

  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

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

  const visible = useMemo(() => {
    if (!rows) return [];
    if (filter === "pending") {
      return rows.filter((row) => row.verification?.status === S_PENDING);
    }
    return rows;
  }, [rows, filter]);

  const selected = (rows || []).find((row) => row.companyId === selectedId) || null;

  function selectCompany(companyId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "partners");
    if (companyId) params.set("companyId", companyId);
    else params.delete("companyId");
    router.replace(`/admin/legal?${params.toString()}`, { scroll: false });
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
          onClick={() => setFilter("pending")}
        />
        <Chip
          clickable
          color={filter === "all" ? "primary" : "default"}
          variant={filter === "all" ? "filled" : "outlined"}
          label={t("admin.legalHub.queueAll", {
            defaultValue: `All companies (${rows?.length || 0})`,
            count: rows?.length || 0,
          })}
          onClick={() => setFilter("all")}
        />
      </Stack>

      {filter === "pending" && visible.length === 0 ? (
        <Alert severity="success">
          {t("admin.legalHub.queueEmpty", {
            defaultValue: "No companies are waiting for review.",
          })}
        </Alert>
      ) : null}

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
                    color={statusColor(status)}
                    label={
                      row.verification
                        ? t(`partnerLegal.status.${status}.label`, {
                            defaultValue: status,
                          })
                        : t("admin.legalHub.queueNoProfile", {
                            defaultValue: "No profile",
                          })
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
                        date: formatDate(submitted),
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
            <ReviewDetail row={selected} onChanged={load} />
          )}
        </Box>
      </Stack>
    </Stack>
  );
}

function ReviewDetail({ row, onChanged }) {
  const { t } = useTranslation();
  const v = row.verification;
  const recommended = [
    ...(v?.completeness?.missingRecommendedFields || []),
    ...(v?.completeness?.missingRecommendedDocuments || []),
  ];
  const agreement = row.agreement;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {row.companyName}
        </Typography>
        {row.country ? <Chip size="small" label={row.country} /> : null}
        {row.listedOnMarketplace === false ? (
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t("admin.legalHub.queueUnlisted", {
              defaultValue: "Not listed yet",
            })}
          />
        ) : null}
      </Stack>

      <PartnerReviewActions
        profile={
          v
            ? {
                companyId: row.companyId,
                verificationStatus: v.status,
              }
            : null
        }
        companyId={row.companyId}
        onChanged={onChanged}
      />

      {recommended.length ? (
        <Alert severity="info">
          {t("admin.legalHub.queueIncompleteHint", {
            defaultValue: "Some recommended fields or documents are still missing.",
          })}
        </Alert>
      ) : null}

      {v ? (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Field label={t("partnerLegal.form.fields.legalName.label")} value={v.legalName} />
          <Field label={t("partnerLegal.form.fields.tradingName.label")} value={v.tradingName} />
          <Field label={t("partnerLegal.form.fields.nifCif.label")} value={v.nifCif} />
          <Field
            label={t("partnerLegal.form.fields.registrationNumber.label")}
            value={v.registrationNumber}
          />
          <Field
            label={t("partnerLegal.form.fields.signatoryName.label")}
            value={[v.signatoryName, v.signatoryRole].filter(Boolean).join(" · ")}
          />
          <Field
            label={t("partnerLegal.form.fields.businessEmail.label")}
            value={v.businessEmail || row.companyEmail}
          />
          <Field label={t("partnerLegal.form.fields.businessPhone.label")} value={v.businessPhone} />
          <Field
            label={t("partnerLegal.form.fields.registeredAddress.label")}
            value={v.registeredAddress}
          />
          <Field
            label={t("partnerLegal.form.fields.insuranceProvider.label")}
            value={[v.insuranceProvider, v.insurancePolicyReference]
              .filter(Boolean)
              .join(" · ")}
          />
        </Box>
      ) : (
        <Alert severity="info">
          {t("partnerLegal.review.noProfile", {
            defaultValue: "This company has not started a legal profile yet.",
          })}
        </Alert>
      )}

      {agreement ? (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1, fontSize: "0.9rem" }}>
            {t("admin.legalHub.queueAgreement", {
              defaultValue: "Accepted agreement",
            })}
          </Typography>
          <Field
            label={t("admin.legalHub.queueAgreementVersion", {
              defaultValue: "Agreement",
            })}
            value={agreement.agreementId}
          />
          <Field
            label={t("admin.legalHub.queueAgreementSigner", {
              defaultValue: "Signer",
            })}
            value={[agreement.signerName, agreement.signerRole, agreement.signerEmail]
              .filter(Boolean)
              .join(" · ")}
          />
          <Field
            label={t("admin.legalHub.queueAgreementAt", {
              defaultValue: "Accepted",
            })}
            value={formatDate(agreement.acceptedAt)}
          />
          <Field
            label={t("admin.legalHub.queueAgreementChecksum", {
              defaultValue: "Checksum",
            })}
            value={agreement.packageChecksum}
          />
        </Box>
      ) : null}

      <PartnerDocumentsCard
        documents={v?.documents || []}
        editable={false}
        companyId={row.companyId}
      />
    </Stack>
  );
}
