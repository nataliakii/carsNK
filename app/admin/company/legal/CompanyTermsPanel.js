"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import {
  COMPANY_TERMS_PUBLICATION,
  explicitSignerRole,
} from "@/domain/legal/companyLegalPage";
import { COMPANY_SETTINGS_FORM_GRID } from "@/domain/admin/companySettingsLayout";
import { adminFieldSx } from "@/app/admin/shared/components/AdminSettingsSection";
import LegalDocumentModal from "@app/components/Legal/LegalDocumentModal";
import {
  markdownInlineToHtml,
  markdownToHtml,
} from "@/domain/legal/documentMarkup";

function DocumentSections({ sections }) {
  const list = Array.isArray(sections) ? sections : [];
  return (
    <Box>
      {list.map((section, index) => {
        const key = section.id || section.heading || `s-${index}`;
        const body = section.text || section.body || section.content || "";
        return (
          <Box key={key} sx={{ mb: 2.5 }}>
            {section.heading ? (
              <Typography
                component="h2"
                sx={{ fontSize: "1.05rem", fontWeight: 700, mb: 0.75 }}
                dangerouslySetInnerHTML={{
                  __html: markdownInlineToHtml(section.heading),
                }}
              />
            ) : null}
            {body ? (
              <Typography
                component="div"
                sx={{
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  "& p": { m: 0, mb: 1 },
                  "& p:last-child": { mb: 0 },
                  "& ul, & ol": { pl: 2.5, mb: 1 },
                }}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(body) }}
              />
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Company-facing Rovaro Terms acceptance (shown on Company details).
 *
 * Documents open in a modal. While acceptance is required, each document must
 * be scrolled to the end before the accept checkbox is enabled.
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
  const [openDocType, setOpenDocType] = useState("");
  const [readDocTypes, setReadDocTypes] = useState(() => new Set());

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
    setReadDocTypes(new Set());
  }, [i18n.language, session?.user?.name, t]);

  useEffect(() => {
    if (!termsAvailable) return undefined;
    let cancelled = false;
    load().catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load, termsAvailable]);

  const packageDocs = useMemo(
    () =>
      (data?.documents || []).filter(
        (doc) => doc.documentType !== "custom-agreement"
      ),
    [data]
  );

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

  const allDocsRead =
    packageDocs.length > 0 &&
    packageDocs.every((doc) => readDocTypes.has(doc.documentType));

  const openDoc = packageDocs.find((doc) => doc.documentType === openDocType);

  function markDocRead(documentType) {
    if (!documentType) return;
    setReadDocTypes((prev) => {
      if (prev.has(documentType)) return prev;
      const next = new Set(prev);
      next.add(documentType);
      return next;
    });
  }

  async function acceptTerms() {
    if (!view.canAccept || !accepted || !allDocsRead || busy) return;
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
      <Box sx={{ pt: 0 }} data-testid="company-rovaro-terms">
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        ) : null}
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          {t("partnerLegal.companyPage.rovaroTerms")}
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

  const openDocLabel = openDoc
    ? t(`partnerLegal.companyPage.documentTypes.${openDoc.documentType}`, {
        defaultValue: openDoc.title || openDoc.documentType,
      })
    : "";

  return (
    <Box sx={{ pt: 0 }} data-testid="company-rovaro-terms">
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
        {packageDocs.map((doc) => {
          const label = t(
            `partnerLegal.companyPage.documentTypes.${doc.documentType}`,
            { defaultValue: doc.title || doc.documentType }
          );
          const viewLabel = t("partnerLegal.review.doc.view", {
            defaultValue: "View document",
          });
          const read = readDocTypes.has(doc.documentType);
          return (
            <Button
              key={doc.documentType}
              type="button"
              onClick={() => setOpenDocType(doc.documentType)}
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
              }}
              endIcon={<DescriptionOutlinedIcon fontSize="small" aria-hidden />}
            >
              <Box sx={{ textAlign: "left" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                  {view.canAccept && read ? (
                    <Chip
                      size="small"
                      color="success"
                      label={t("partnerLegal.agreement.readConfirmed", {
                        defaultValue: "Read",
                      })}
                      sx={{ height: 20, fontSize: "0.65rem" }}
                    />
                  ) : null}
                </Stack>
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
          {!allDocsRead ? (
            <Alert severity="info">
              {t("partnerLegal.agreement.scrollToEnd", {
                defaultValue:
                  "Open each document and scroll to the end before you can accept them.",
              })}
            </Alert>
          ) : (
            <Alert severity="success">
              {t("partnerLegal.agreement.readConfirmed", {
                defaultValue: "You have reached the end of the documents.",
              })}
            </Alert>
          )}
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
                disabled={!allDocsRead}
                onChange={(event) => setAccepted(event.target.checked)}
              />
            }
            label={t("partnerLegal.companyPage.authority")}
          />
          <Button
            variant="contained"
            disabled={
              !allDocsRead ||
              !accepted ||
              busy ||
              !signerName.trim() ||
              !signerRole.trim()
            }
            onClick={acceptTerms}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {t("partnerLegal.companyPage.acceptTerms")}
          </Button>
        </Stack>
      ) : null}

      <LegalDocumentModal
        open={Boolean(openDoc)}
        onClose={() => setOpenDocType("")}
        title={openDocLabel}
        version={openDoc?.version || ""}
        language={openDoc?.language || String(i18n.language || "en").slice(0, 2)}
        closeLabel={t("common.close", { defaultValue: "Close" })}
        onReachedEnd={
          view.canAccept && openDoc
            ? () => markDocRead(openDoc.documentType)
            : undefined
        }
      >
        <DocumentSections sections={openDoc?.sections} />
      </LegalDocumentModal>
    </Box>
  );
}
