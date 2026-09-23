"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { PARTNER_VERIFICATION_STATUS } from "@/domain/legal/partnerVerification";

import PartnerComplianceGate from "./_components/PartnerComplianceGate";
import PartnerDocumentsCard from "./_components/PartnerDocumentsCard";
import PartnerReviewActions from "./_components/PartnerReviewActions";
import PartnerVerificationBanner from "./_components/PartnerVerificationBanner";
import {
  PARTNER_PROFILE_CONFIRMATIONS,
  PARTNER_PROFILE_SECTIONS,
  PARTNER_PROFILE_TEXT_FIELDS,
} from "./_components/partnerLegalFields";

const S = PARTNER_VERIFICATION_STATUS;

/** Statuses the partner may edit without any further warning. */
const FREELY_EDITABLE = new Set([S.DRAFT, S.REJECTED, S.SUSPENDED]);

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function draftFromProfile(profile) {
  const draft = {};
  for (const key of PARTNER_PROFILE_TEXT_FIELDS) {
    draft[key] =
      key === "insuranceValidUntil"
        ? toDateInput(profile?.[key])
        : String(profile?.[key] ?? "");
  }
  for (const key of PARTNER_PROFILE_CONFIRMATIONS) {
    draft[key] = Boolean(profile?.[key]);
  }
  draft.licences = (profile?.licences || []).join("\n");
  return draft;
}

/**
 * Partner legal profile — the KYB data Rovaro has to hold before the partner
 * can be verified and sign the Master Partner Agreement.
 *
 * The form writes to `/api/partner/legal/profile`, which resolves the company
 * from the session. Which fields block verification, and whether the profile
 * is complete, are both answered by the server; this screen only renders the
 * answer.
 */
export default function PartnerLegalProfileSection() {
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [gate, setGate] = useState(null);
  const [listedOnMarketplace, setListedOnMarketplace] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [draft, setDraft] = useState(() => draftFromProfile(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [profileRes, statusRes] = await Promise.all([
        fetch("/api/partner/legal/profile", { cache: "no-store" }),
        fetch("/api/partner/legal/status", { cache: "no-store" }),
      ]);
      const profileJson = await profileRes.json();
      if (!profileJson.success) {
        throw new Error(profileJson.message || t("partnerLegal.form.loadFailed"));
      }
      setProfile(profileJson.profile);
      setCompleteness(profileJson.completeness);
      setCompanyId(profileJson.companyId || profileJson.profile?.companyId || "");
      setDraft(draftFromProfile(profileJson.profile));

      const statusJson = await statusRes.json();
      setGate(statusJson.success ? statusJson.gate : null);
      setListedOnMarketplace(
        statusJson.success ? statusJson.listedOnMarketplace !== false : true
      );
    } catch (err) {
      setError(err.message || t("partnerLegal.form.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const status = profile?.verificationStatus || S.DRAFT;
  const locked = !FREELY_EDITABLE.has(status);
  const editable = !locked || (status === S.VERIFIED && unlocked);
  const uploadedDocCount = (profile?.documents || []).filter(
    (doc) => doc?.storageRef
  ).length;
  // Allow explicit submit when KYB fields are ready OR evidence was uploaded.
  // Draft autosave never sets submitForVerification.
  const canSubmit =
    (status === S.DRAFT || status === S.REJECTED) &&
    (Boolean(completeness?.ready) || uploadedDocCount > 0);

  const missing = useMemo(() => {
    if (!completeness || completeness.ready) return [];
    return [
      ...completeness.missingFields.map((key) =>
        t(`partnerLegal.form.fields.${key}.label`)
      ),
      ...completeness.missingConfirmations.map((key) =>
        t(`partnerLegal.form.confirmations.${key}.short`)
      ),
      ...completeness.missingDocuments.map((kind) =>
        t(`partnerLegal.documents.kinds.${kind}`)
      ),
    ];
  }, [completeness, t]);

  async function save({ submitForVerification = false } = {}) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { submitForVerification };
      for (const key of PARTNER_PROFILE_TEXT_FIELDS) {
        if (key === "insuranceValidUntil") continue;
        payload[key] = draft[key];
      }
      if (draft.insuranceValidUntil) {
        payload.insuranceValidUntil = draft.insuranceValidUntil;
      }
      for (const key of PARTNER_PROFILE_CONFIRMATIONS) {
        payload[key] = Boolean(draft[key]);
      }
      payload.licences = String(draft.licences || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const res = await fetch("/api/partner/legal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || t("partnerLegal.form.saveFailed"));
      }
      setUnlocked(false);
      setNotice(
        submitForVerification
          ? t("partnerLegal.form.submitted")
          : t("partnerLegal.form.saved")
      );
      await load();
    } catch (err) {
      setError(err.message || t("partnerLegal.form.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: { xs: 1, md: 2 },
        pb: 6,
        pt: { xs: 2, md: 2 },
        maxWidth: { xs: "100%", md: 960 },
        mx: "auto",
        overflowX: "hidden",
      }}
    >
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        {t("partnerLegal.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("partnerLegal.subtitle")}
      </Typography>

      <PartnerComplianceGate
        gate={gate}
        listedOnMarketplace={listedOnMarketplace}
      />
      <PartnerReviewActions
        profile={profile}
        companyId={companyId}
        onChanged={load}
      />
      <PartnerVerificationBanner profile={profile} />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}

      {status === S.REJECTED ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("partnerLegal.form.rejectedReopen")}
        </Alert>
      ) : null}

      {locked && !editable ? (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            status === S.VERIFIED ? (
              <Button size="small" onClick={() => setUnlocked(true)}>
                {t("partnerLegal.form.unlockToEdit")}
              </Button>
            ) : null
          }
        >
          <AlertTitle>{t("partnerLegal.form.readOnlyTitle")}</AlertTitle>
          {status === S.VERIFIED
            ? t("partnerLegal.form.readOnlyVerified")
            : t("partnerLegal.form.readOnlyPending")}
        </Alert>
      ) : null}

      {status === S.VERIFIED && unlocked ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{t("partnerLegal.form.unlockWarningTitle")}</AlertTitle>
          {t("partnerLegal.form.unlockWarningBody")}
        </Alert>
      ) : null}

      {missing.length ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{t("partnerLegal.form.missingTitle")}</AlertTitle>
          {missing.join(" · ")}
        </Alert>
      ) : null}

      {PARTNER_PROFILE_SECTIONS.map((section) => (
        <Paper
          key={section.id}
          variant="outlined"
          sx={{ p: { xs: 2, md: 3 }, mb: 3 }}
        >
          <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700 }}>
            {t(`partnerLegal.form.sections.${section.id}.title`)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(`partnerLegal.form.sections.${section.id}.hint`)}
          </Typography>

          <Stack direction="row" flexWrap="wrap" gap={2}>
            {section.fields.map((field) => (
              <TextField
                key={field.key}
                size="small"
                select={Boolean(field.options)}
                type={field.type || "text"}
                label={t(`partnerLegal.form.fields.${field.key}.label`)}
                helperText={t(`partnerLegal.form.fields.${field.key}.hint`, {
                  defaultValue: "",
                })}
                required={field.required}
                disabled={!editable}
                multiline={Boolean(field.multiline)}
                minRows={field.multiline ? 2 : undefined}
                value={draft[field.key] ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDraft((prev) => ({
                    ...prev,
                    [field.key]: field.uppercase ? raw.toUpperCase() : raw,
                  }));
                }}
                inputProps={field.maxLength ? { maxLength: field.maxLength } : undefined}
                InputLabelProps={field.type === "date" ? { shrink: true } : undefined}
                sx={{ width: field.fullWidth || field.multiline ? "100%" : 280 }}
              >
                {(field.options || []).map((option) => (
                  <MenuItem key={option} value={option}>
                    {t(`partnerLegal.form.entityTypes.${option}`)}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>

          {section.id === "insurance" ? (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              sx={{ mt: 2 }}
              label={t("partnerLegal.form.fields.licences.label")}
              helperText={t("partnerLegal.form.fields.licences.hint")}
              disabled={!editable}
              value={draft.licences}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, licences: event.target.value }))
              }
            />
          ) : null}

          {(section.confirmations || []).map((key) => (
            <Box key={key} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(draft[key])}
                    disabled={!editable}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [key]: event.target.checked }))
                    }
                  />
                }
                label={t(`partnerLegal.form.confirmations.${key}.label`)}
              />
            </Box>
          ))}
        </Paper>
      ))}

      <PartnerDocumentsCard
        documents={profile?.documents}
        editable={FREELY_EDITABLE.has(status)}
        onChanged={load}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          disabled={!editable || saving}
          onClick={() => save()}
        >
          {saving ? t("partnerLegal.form.saving") : t("partnerLegal.form.save")}
        </Button>
        {status === S.DRAFT || status === S.REJECTED ? (
          <Button
            variant="outlined"
            disabled={!canSubmit || saving}
            onClick={() => save({ submitForVerification: true })}
          >
            {status === S.REJECTED
              ? t("partnerLegal.form.resubmitForVerification")
              : t("partnerLegal.form.submitForVerification")}
          </Button>
        ) : null}
        {status === S.VERIFIED && unlocked ? (
          <Button
            color="inherit"
            disabled={saving}
            onClick={() => {
              setDraft(draftFromProfile(profile));
              setUnlocked(false);
            }}
          >
            {t("partnerLegal.form.cancelEdit")}
          </Button>
        ) : null}
        <Button
          component={Link}
          href="/admin/legal-profile?tab=agreement"
          color="secondary"
        >
          {t("partnerLegal.form.goToAgreement")}
        </Button>
      </Stack>
    </Box>
  );
}
