"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";
import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";
import { reviewControlsForStatus } from "@/domain/legal/partnerReviewWorkspace";
import { pendingProfileChangeSummary } from "@/domain/legal/verifiedProfileChanges";
import { pendingChangeLine } from "./pendingChangeCopy";

const S = PARTNER_VERIFICATION_STATUS;

/**
 * Superadmin actions for one partner legal profile.
 * Draft can only be moved into the review queue. Approve and reject
 * appear once the profile is pending. A verified profile can be suspended.
 */
export default function PartnerReviewActions({
  profile,
  companyId: companyIdProp,
  pendingChanges,
  onChanged,
  viewMode,
}) {
  const { t } = useTranslation();
  const platformMode = viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN;

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmMove, setConfirmMove] = useState(false);

  if (!platformMode) return null;

  const companyId = String(profile?.companyId || companyIdProp || "");
  const status = profile?.verificationStatus || null;
  const controls = reviewControlsForStatus(status);
  const proposed = pendingChanges || pendingProfileChangeSummary(profile);

  async function send(body, failKey = "partnerLegal.review.failed") {
    if (!companyId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/admin/legal/partners/${encodeURIComponent(companyId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || t(failKey));
      }
      setNotice(t("partnerLegal.review.done"));
      await onChanged?.();
    } catch (err) {
      setError(err.message || t(failKey));
    } finally {
      setBusy(false);
    }
  }

  async function apply(to) {
    if (!companyId) return;
    if (
      (to === S.REJECTED || to === S.SUSPENDED || to === S.PENDING_VERIFICATION) &&
      !reason.trim()
    ) {
      setError(t("partnerLegal.review.reasonRequired"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/admin/legal/partners/${encodeURIComponent(companyId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: to, reason: reason.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || t("partnerLegal.review.failed"));
      }
      setNotice(t("partnerLegal.review.done"));
      setReason("");
      setConfirmMove(false);
      await onChanged?.();
    } catch (err) {
      setError(err.message || t("partnerLegal.review.failed"));
    } finally {
      setBusy(false);
    }
  }

  const titleKey =
    status === S.DRAFT
      ? "partnerLegal.review.draftTitle"
      : status === S.PENDING_VERIFICATION
        ? "partnerLegal.review.pendingTitle"
        : status === S.VERIFIED
          ? "partnerLegal.review.verifiedTitle"
          : "partnerLegal.review.title";
  const bodyKey =
    status === S.DRAFT
      ? "partnerLegal.review.draftBody"
      : status === S.PENDING_VERIFICATION
        ? "partnerLegal.review.pendingBody"
        : status === S.VERIFIED
          ? "partnerLegal.review.verifiedBody"
          : "partnerLegal.review.body";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 },
        mb: 3,
        borderColor: "primary.main",
        bgcolor: "action.hover",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 800 }}>
          {t(titleKey)}
        </Typography>
        {status ? (
          <Chip
            size="small"
            label={t(`partnerLegal.status.${status}.label`, {
              defaultValue: status,
            })}
          />
        ) : null}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(bodyKey)}
      </Typography>

      {proposed.length ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {t("partnerLegal.review.pendingChangesTitle")}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t("partnerLegal.review.pendingChangesBody")}
          </Typography>
          <Stack spacing={0.25} sx={{ mb: 1.5 }}>
            {proposed.map((change) => (
              <Typography key={change.field} variant="body2">
                {pendingChangeLine(t, change)}
              </Typography>
            ))}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              size="small"
              disabled={busy || !companyId}
              onClick={() => send({ action: "apply_pending_changes" })}
            >
              {t("partnerLegal.review.approveChanges")}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={busy || !companyId}
              onClick={() =>
                send({ action: "discard_pending_changes", reason: reason.trim() })
              }
            >
              {t("partnerLegal.review.discardChanges")}
            </Button>
          </Stack>
        </Alert>
      ) : null}

      {!profile ? (
        <Alert severity="info">{t("partnerLegal.review.noProfile")}</Alert>
      ) : (
        <Stack spacing={1.5}>
          {error ? (
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert severity="success" onClose={() => setNotice("")}>
              {notice}
            </Alert>
          ) : null}
          {controls.reject || controls.suspend ? (
            <TextField
              size="small"
              fullWidth
              label={t("partnerLegal.review.reason")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {controls.moveToReview ? (
              <Button
                variant="contained"
                size="large"
                disabled={busy || !companyId}
                onClick={() => {
                  setError("");
                  setConfirmMove(true);
                }}
                sx={{ fontWeight: 800, py: 1.25 }}
              >
                {t("partnerLegal.review.moveToReview")}
              </Button>
            ) : null}
            {controls.approve ? (
              <Button
                variant="contained"
                size="large"
                disabled={busy || !companyId}
                onClick={() => apply(S.VERIFIED)}
                sx={{ fontWeight: 800, py: 1.25 }}
              >
                {t("partnerLegal.review.approve")}
              </Button>
            ) : null}
            {controls.reject ? (
              <Button
                variant="contained"
                color="error"
                size="large"
                disabled={busy || !companyId}
                onClick={() => apply(S.REJECTED)}
                sx={{ fontWeight: 800, py: 1.25 }}
              >
                {t("partnerLegal.review.requestChanges")}
              </Button>
            ) : null}
            {controls.suspend ? (
              <Button
                variant="outlined"
                color="warning"
                disabled={busy || !companyId}
                onClick={() => apply(S.SUSPENDED)}
              >
                {t("partnerLegal.review.suspend")}
              </Button>
            ) : null}
            {controls.reopenDraft ? (
              <Button
                variant="outlined"
                disabled={busy || !companyId}
                onClick={() => apply(S.DRAFT)}
              >
                {t("partnerLegal.review.reopenDraft")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      )}

      <Dialog
        open={confirmMove}
        onClose={() => {
          if (!busy) setConfirmMove(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("partnerLegal.review.moveToReviewTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t("partnerLegal.review.moveToReviewBody")}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            required
            size="small"
            label={t("partnerLegal.review.reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmMove(false)} disabled={busy}>
            {t("partnerLegal.review.moveToReviewCancel")}
          </Button>
          <Button
            variant="contained"
            disabled={busy || !reason.trim()}
            onClick={() => apply(S.PENDING_VERIFICATION)}
          >
            {t("partnerLegal.review.moveToReviewConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
