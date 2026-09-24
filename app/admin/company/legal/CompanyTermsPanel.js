"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import {
  COMPANY_TERMS_PUBLICATION,
  explicitSignerRole,
} from "@/domain/legal/companyLegalPage";
import { COMPANY_SETTINGS_FORM_GRID } from "@/domain/admin/companySettingsLayout";
import { adminFieldSx } from "@/app/admin/shared/components/AdminSettingsSection";

/**
 * Company-facing Terms tab.
 *
 * The publication state is resolved once on the server (see
 * `/api/partner/legal/status`) and handed down. This panel renders that
 * answer; it never re-derives the state from the agreement package, so the
 * Documents tab and this tab can never disagree.
 */
export default function CompanyTermsPanel({
  termsPublication = COMPANY_TERMS_PUBLICATION.NOT_PUBLISHED,
  terms = null,
  onAccepted,
}) {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const termsAvailable =
    termsPublication !== COMPANY_TERMS_PUBLICATION.NOT_PUBLISHED;
  const email = String(session?.user?.email || "");

  const load = useCallback(async () => {
    const lang = String(i18n.language || "en").slice(0, 2);
    const [agreementRes, profileRes] = await Promise.all([
      fetch(`/api/partner/legal/agreement?lang=${encodeURIComponent(lang)}`, {
        cache: "no-store",
      }),
      fetch("/api/partner/legal/profile", { cache: "no-store" }),
    ]);
    const agreement = await agreementRes.json().catch(() => ({}));
    const profileBody = await profileRes.json().catch(() => ({}));
    if (!agreementRes.ok || !agreement.success) {
      throw new Error(agreement.message || t("partnerLegal.companyPage.acceptFailed"));
    }
    setData(agreement);
    setSignerName(String(session?.user?.name || ""));
    setSignerRole(explicitSignerRole(profileBody.profile));
  }, [i18n.language, session?.user?.name, t]);

  useEffect(() => {
    // Rovaro has nothing ready yet, so there is no package to open.
    if (!termsAvailable) return undefined;
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load, termsAvailable]);

  const view = useMemo(
    () => ({
      publication: termsPublication,
      canAccept: Boolean(terms?.canAccept),
      links: terms?.links || [],
      label: terms?.label || "standard",
      message: terms?.message || "",
    }),
    [termsPublication, terms]
  );

  async function acceptTerms() {
    if (!view.canAccept || !accepted || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner/legal/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          signerRole,
          acceptedCheckbox: true,
          language: String(i18n.language || "en").slice(0, 2),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.message || t("partnerLegal.companyPage.acceptFailed"));
      }
      setDone(true);
      setAccepted(false);
      await load();
      await onAccepted?.();
      window.dispatchEvent(new Event("rovaro-inbox-refresh"));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!termsAvailable || !data) {
    return (
      <Box sx={{ pt: 0 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        ) : null}
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          {t("partnerLegal.companyPage.terms")}
        </Typography>
        <Typography variant="body1">
          {t("partnerLegal.companyPage.preparing")}
        </Typography>
      </Box>
    );
  }

  const messageKey = {
    ready: "termsReady",
    accepted: "termsAccepted",
    updated: "termsUpdated",
  }[view.message];

  return (
    <Box sx={{ pt: 0 }}>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("partnerLegal.companyPage.termsAccepted")}
        </Alert>
      ) : null}

      <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        {view.label === "custom"
          ? t("partnerLegal.companyPage.customAgreement")
          : t("partnerLegal.companyPage.standardApply")}
      </Typography>
      {messageKey ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t(`partnerLegal.companyPage.${messageKey}`)}
        </Typography>
      ) : null}

      <Stack spacing={1} sx={{ mb: 3 }}>
        {(data.documents || [])
          .filter((doc) => doc.documentType !== "custom-agreement")
          .map((doc) => {
            const link = view.links.find(
              (item) => item.documentType === doc.documentType
            );
            const label = t(
              `partnerLegal.companyPage.documentTypes.${doc.documentType}`,
              { defaultValue: doc.title || doc.documentType }
            );
            const viewLabel = t("partnerLegal.review.doc.view", {
              defaultValue: "View document",
            });
            return (
              <Button
                key={doc.documentType}
                component={link ? Link : "button"}
                href={link?.href}
                target={link ? "_blank" : undefined}
                rel={link ? "noopener noreferrer" : undefined}
                disabled={!link}
                variant="outlined"
                color="inherit"
                data-testid={`company-terms-doc-${doc.documentType}`}
                aria-label={`${label} — ${viewLabel}`}
                sx={{
                  justifyContent: "space-between",
                  textAlign: "left",
                  display: "flex",
                  textTransform: "none",
                  width: "100%",
                  px: 2,
                  py: 1.5,
                  fontSize: "inherit",
                  border: "1px solid",
                  borderColor: "divider",
                  color: "text.primary",
                  bgcolor: "#fff",
                  "&:hover": {
                    borderColor: "text.primary",
                    bgcolor: "action.hover",
                    margin: 0,
                    color: "text.primary",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 2,
                  },
                  "&.Mui-disabled": { opacity: 0.55 },
                }}
                endIcon={<OpenInNewIcon fontSize="small" aria-hidden />}
              >
                <Box sx={{ textAlign: "left" }}>
                  <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewLabel}
                  </Typography>
                </Box>
              </Button>
            );
          })}
      </Stack>

      {view.canAccept ? (
        <Stack spacing={1.5}>
          <Box sx={COMPANY_SETTINGS_FORM_GRID}>
          <TextField
            size="small"
            fullWidth
            sx={adminFieldSx}
            label={t("partnerLegal.companyPage.signerName")}
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            sx={adminFieldSx}
            label={t("partnerLegal.companyPage.signerRole")}
            value={signerRole}
            placeholder={t("partnerLegal.companyPage.rolePlaceholder")}
            onChange={(event) => setSignerRole(event.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            sx={{ ...adminFieldSx, gridColumn: { xs: "auto", md: "1 / -1" } }}
            label={t("partnerLegal.companyPage.signerEmail")}
            value={email}
            disabled
          />
          </Box>
          <FormControlLabel
            sx={{
              alignItems: "flex-start",
              ml: 0,
              "& .MuiFormControlLabel-label": { pt: 1 },
            }}
            control={
              <Checkbox
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
            }
            label={t("partnerLegal.companyPage.authority")}
          />
          <Button
            variant="contained"
            disabled={!accepted || busy || !signerName.trim() || !signerRole.trim()}
            onClick={acceptTerms}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {t("partnerLegal.companyPage.acceptTerms")}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
