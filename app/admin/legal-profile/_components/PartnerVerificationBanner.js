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
  const isChangesRequested =
    status === S.REJECTED && profile.rejectionDecision === "changes_requested";
  const requestedChanges = Array.isArray(profile.requestedChanges)
    ? profile.requestedChanges
    : [];
  const statusLabelKey = isChangesRequested
    ? "partnerLegal.status.CHANGES_REQUESTED"
    : `partnerLegal.status.${status}`;

  return (
    <Alert severity={SEVERITY[status] || "info"} sx={{ mb: 2 }}>
      <AlertTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={CHIP_COLOR[status] || "default"}
            label={t(`${statusLabelKey}.label`, {
              defaultValue: isChangesRequested ? "Changes requested" : status,
            })}
          />
          <span>
            {t(`${statusLabelKey}.title`, {
              defaultValue: isChangesRequested ? "Changes requested" : status,
            })}
          </span>
        </Stack>
      </AlertTitle>
      <Typography variant="body2">
        {t(`${statusLabelKey}.body`, {
          defaultValue: isChangesRequested
            ? "Rovaro asked for corrections. Update the listed items and submit again."
            : "",
        })}
      </Typography>
      {requestedChanges.length ? (
        <Stack component="ul" sx={{ m: 0, pl: 2, mt: 1 }}>
          {requestedChanges.map((item) => (
            <Typography component="li" key={`${item.type}-${item.key}`} variant="body2">
              {item.label || item.key}
            </Typography>
          ))}
        </Stack>
      ) : null}
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
