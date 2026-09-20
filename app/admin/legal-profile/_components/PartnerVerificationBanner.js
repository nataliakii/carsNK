"use client";

import { Alert, AlertTitle, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";

const S = PARTNER_VERIFICATION_STATUS;

const SEVERITY = {
  [S.DRAFT]: "info",
  [S.PENDING_VERIFICATION]: "info",
  [S.VERIFIED]: "success",
  [S.SUSPENDED]: "warning",
  [S.REJECTED]: "error",
};

const CHIP_COLOR = {
  [S.DRAFT]: "default",
  [S.PENDING_VERIFICATION]: "info",
  [S.VERIFIED]: "success",
  [S.SUSPENDED]: "warning",
  [S.REJECTED]: "error",
};

function formatUtc(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace("T", " ").slice(0, 16);
}

/**
 * Verification state of the partner's legal profile, with the operator's own
 * reason when the profile was rejected or suspended. The reason is shown
 * verbatim; nothing is substituted when it is empty.
 */
export default function PartnerVerificationBanner({ profile }) {
  const { t } = useTranslation();

  const status = profile?.verificationStatus || null;
  if (!status) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>{t("partnerLegal.status.none.title")}</AlertTitle>
        {t("partnerLegal.status.none.body")}
      </Alert>
    );
  }

  const reason =
    status === S.REJECTED
      ? profile.rejectionReason
      : status === S.SUSPENDED
        ? profile.suspensionReason
        : "";
  const changedAt = formatUtc(profile.verificationStatusAt);

  return (
    <Alert severity={SEVERITY[status] || "info"} sx={{ mb: 2 }}>
      <AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={CHIP_COLOR[status] || "default"}
            label={t(`partnerLegal.status.${status}.label`)}
          />
          <span>{t(`partnerLegal.status.${status}.title`)}</span>
        </Stack>
      </AlertTitle>
      <Typography variant="body2">
        {t(`partnerLegal.status.${status}.body`)}
      </Typography>
      {reason ? (
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
          {t("partnerLegal.status.reason", { reason })}
        </Typography>
      ) : null}
      {changedAt ? (
        <Typography variant="caption" color="text.secondary">
          {t("partnerLegal.status.changedAt", { at: changedAt })}
        </Typography>
      ) : null}
    </Alert>
  );
}
