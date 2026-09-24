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
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import {
  COMPANY_TERMS_PUBLICATION,
  explicitSignerRole,
} from "@/domain/legal/companyLegalPage";

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
      <Box sx={{ maxWidth: 720, pt: 2, px: { xs: 1, md: 2 } }}>
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
    <Box sx={{ maxWidth: 720, pt: 2, px: { xs: 1, md: 2 } }}>
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

      <Stack spacing={0.5} sx={{ mb: 2 }}>
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
            return link ? (
              <Typography
                key={doc.documentType}
                component={Link}
                href={link.href}
                variant="body2"
              >
                {label}
              </Typography>
            ) : (
              <Typography key={doc.documentType} variant="body2">
                {label}
              </Typography>
            );
          })}
      </Stack>

      {view.canAccept ? (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label={t("partnerLegal.companyPage.signerName")}
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
          />
          <TextField
            size="small"
            label={t("partnerLegal.companyPage.signerRole")}
            value={signerRole}
            placeholder={t("partnerLegal.companyPage.rolePlaceholder")}
            onChange={(event) => setSignerRole(event.target.value)}
          />
          <TextField
            size="small"
            label={t("partnerLegal.companyPage.signerEmail")}
            value={email}
            disabled
          />
          <FormControlLabel
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
