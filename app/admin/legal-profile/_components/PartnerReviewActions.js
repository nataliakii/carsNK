"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import { ROLE } from "@/domain/orders/admin-rbac";
import {
  PARTNER_VERIFICATION_STATUS,
  canTransitionVerification,
} from "@/domain/legal/partnerVerification";
import { useAdminViewAs } from "@/app/hooks/useAdminViewAs";

const S = PARTNER_VERIFICATION_STATUS;

/**
 * Superadmin-only bar to set VERIFIED / REJECTED on the partner being
 * viewed. Platform contract publish stays on /admin/legal.
 */
export default function PartnerReviewActions({
  profile,
  companyId: companyIdProp,
  onChanged,
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { company } = useAdminViewAs();
  const isSuperAdmin = Number(session?.user?.role) === ROLE.SUPERADMIN;

  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!isSuperAdmin) return null;

  const companyId = String(
    profile?.companyId || companyIdProp || company?._id || ""
  );
  const status = profile?.verificationStatus || null;

  async function apply(to) {
    if (!companyId) return;
    if ((to === S.REJECTED || to === S.SUSPENDED) && !reason.trim()) {
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
      await onChanged?.();
    } catch (err) {
      setError(err.message || t("partnerLegal.review.failed"));
    } finally {
      setBusy(false);
    }
  }

  const can = (to) =>
    Boolean(status) && canTransitionVerification(status, to);

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
      <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 800 }}>
        {t("partnerLegal.review.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("partnerLegal.review.body")}
      </Typography>

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
          {(can(S.REJECTED) || can(S.SUSPENDED)) ? (
            <TextField
              size="small"
              fullWidth
              label={t("partnerLegal.review.reason")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            {can(S.VERIFIED) ? (
              <Button
                variant="contained"
                size="large"
                disabled={busy || !companyId}
                onClick={() => apply(S.VERIFIED)}
                sx={{ fontWeight: 800, py: 1.25 }}
              >
                {t("partnerLegal.review.verify")}
              </Button>
            ) : null}
            {can(S.REJECTED) ? (
              <Button
                variant="contained"
                color="error"
                size="large"
                disabled={busy || !companyId}
                onClick={() => apply(S.REJECTED)}
                sx={{ fontWeight: 800, py: 1.25 }}
              >
                {t("partnerLegal.review.reject")}
              </Button>
            ) : null}
            {can(S.SUSPENDED) ? (
              <Button
                variant="outlined"
                color="warning"
                disabled={busy || !companyId}
                onClick={() => apply(S.SUSPENDED)}
              >
                {t("partnerLegal.review.suspend")}
              </Button>
            ) : null}
            {can(S.DRAFT) ? (
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
    </Paper>
  );
}
