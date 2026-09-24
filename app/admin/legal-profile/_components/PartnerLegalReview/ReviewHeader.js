"use client";

import { Alert, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  REVIEW_DISPLAY_STATUS,
  reviewDisplayStatus,
  reviewDisplayStatusLabel,
} from "@/domain/legal/partnerReviewWorkspace";

function badgeColor(key) {
  if (key === REVIEW_DISPLAY_STATUS.APPROVED) return "success";
  if (key === REVIEW_DISPLAY_STATUS.AWAITING_REVIEW) return "warning";
  if (
    key === REVIEW_DISPLAY_STATUS.REJECTED ||
    key === REVIEW_DISPLAY_STATUS.SUSPENDED
  ) {
    return "error";
  }
  if (key === REVIEW_DISPLAY_STATUS.CHANGES_REQUESTED) return "warning";
  return "default";
}

export default function ReviewHeader({ row }) {
  const { t } = useTranslation();
  const v = row?.verification;
  const profile = v
    ? {
        verificationStatus: v.status,
        rejectionDecision: v.rejectionDecision || "",
      }
    : null;
  const statusKey = row?.displayStatus || reviewDisplayStatus(profile);
  const statusLabel =
    row?.displayStatusLabel ||
    reviewDisplayStatusLabel(profile) ||
    t(`partnerLegal.review.displayStatus.${statusKey}`, {
      defaultValue: statusLabelFallback(statusKey),
    });

  const subtitle = [row?.companyName, row?.country].filter(Boolean).join(" · ");

  return (
    <Stack spacing={1}>
      <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.15rem", md: "1.35rem" } }}>
        {t("partnerLegal.review.headerTitle", {
          defaultValue: "Company legal review",
        })}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>{subtitle}</Typography>
        <Chip size="small" color={badgeColor(statusKey)} label={statusLabel} />
        {row?.listedOnMarketplace === false ? (
          <Chip
            size="small"
            variant="outlined"
            label={t("admin.legalHub.queueUnlisted", {
              defaultValue: "Not listed yet",
            })}
          />
        ) : null}
      </Stack>
      {statusKey === REVIEW_DISPLAY_STATUS.AWAITING_REVIEW ? (
        <Typography variant="body2" color="text.secondary">
          {t("partnerLegal.review.pendingHint", {
            defaultValue:
              "Check the company details and uploaded documents, then approve the company or request changes.",
          })}
        </Typography>
      ) : null}
      {statusKey === REVIEW_DISPLAY_STATUS.APPROVED && v?.statusAt ? (
        <Alert severity="success" sx={{ py: 0.5 }}>
          {t("partnerLegal.review.approvedOn", {
            defaultValue: "Approved on {{date}} by {{reviewer}}",
            date: formatDate(v.statusAt),
            reviewer: v.verifiedByEmail || "—",
          })}
        </Alert>
      ) : null}
    </Stack>
  );
}

function statusLabelFallback(key) {
  const map = {
    draft: "Draft",
    awaiting_review: "Awaiting review",
    approved: "Approved",
    changes_requested: "Changes requested",
    rejected: "Rejected",
    suspended: "Suspended",
    none: "No profile",
  };
  return map[key] || "—";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
