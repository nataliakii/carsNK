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
        const key = section.id || section.heading || `section-${index}`;
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

export default function CompanyTermsPanel({
  termsPublication = COMPANY_TERMS_PUBLICATION.NOT_PUBLISHED,
  terms = null,
  legalState = "",
  packageData = null,
  changedDocumentTypes = [],
  missingDocumentTypes = [],
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
  const [reviewRequested, setReviewRequested] = useState(false);

  const termsAvailable =
    termsPublication !== COMPANY_TERMS_PUBLICATION.NOT_PUBLISHED;
  const email = String(session?.user?.email || "");

  const load = useCallback(async () => {
    const profileResponse = await fetch("/api/partner/legal/profile", {
      cache: "no-store",
    });
    const profileBody = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok || profileBody.success === false) {
      throw new Error(
        profileBody.message || t("partnerLegal.companyPage.acceptFailed")
      );
    }
    setSignerName(String(session?.user?.name || ""));
    setSignerRole(explicitSignerRole(profileBody.profile));
  }, [session?.user?.name, t]);

  useEffect(() => {
    setData(packageData);
  }, [packageData]);

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
      canAccept: Boolean(terms?.canAccept),
      message: terms?.message || "",
      label: terms?.label || "standard",
    }),
    [terms]
  );
  const openDoc = packageDocs.find((doc) => doc.documentType === openDocType);
  const openDocLabel = openDoc
    ? t(`partnerLegal.companyPage.documentTypes.${openDoc.documentType}`, {
        defaultValue: openDoc.title || openDoc.documentType,
      })
    : "";

  useEffect(() => {
    if (!reviewRequested) return;
    document.getElementById("partner-terms-acceptance")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [reviewRequested]);

  async function acceptTerms() {
    if (!view.canAccept || !accepted || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/partner/legal/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          signerRole,
          acceptedCheckbox: true,
          language: String(i18n.language || "en").split("-")[0],
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(
          result.message || t("partnerLegal.companyPage.acceptFailed")
        );
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

  if (!termsAvailable) {
    return (
      <Box sx={{ pt: 0 }} data-testid="company-rovaro-terms">
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          {t("partnerLegal.companyPage.rovaroTerms")}
        </Typography>
        <Typography variant="body1">
          {t("partnerLegal.companyPage.preparing")}
        </Typography>
        {missingDocumentTypes.length ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            {t("partnerLegal.companyPage.missingTypes", {
              defaultValue: "Not yet published: {{types}}",
              types: missingDocumentTypes.join(", "),
            })}
          </Typography>
        ) : null}
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ pt: 0 }} data-testid="company-rovaro-terms">
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Typography variant="body1">
          {error
            ? t("partnerLegal.companyPage.loadFailed", {
                defaultValue:
                  "Could not load the current published partner package. Please retry.",
              })
            : t("partnerLegal.companyPage.loadingPackage", {
                defaultValue: "Loading the current published partner package…",
              })}
        </Typography>
        <Button
          size="small"
          onClick={() => load().catch((err) => setError(err.message))}
        >
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </Box>
    );
  }

  const messageKey = {
    ready: "termsReady",
    accepted: "termsAccepted",
    updated: "termsUpdated",
  }[view.message];
  const acceptedAt = data.activeAgreement?.acceptedAt;

  return (
    <Box sx={{ pt: 0 }} data-testid="company-rovaro-terms">
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t("partnerLegal.companyPage.termsAccepted")}
          {acceptedAt ? ` · ${new Date(acceptedAt).toLocaleString()}` : ""}
        </Alert>
      ) : null}

      <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        {legalState === "REACCEPTANCE_REQUIRED"
          ? t("partnerLegal.companyPage.termsReacceptTitle", {
              defaultValue:
                "Updated Rovaro partner terms require your acceptance",
            })
          : legalState === "ACCEPTED_CURRENT"
          ? t("partnerLegal.companyPage.termsAccepted")
          : view.label === "custom"
          ? t("partnerLegal.companyPage.customAgreement")
          : t("partnerLegal.companyPage.standardApply")}
      </Typography>
      {legalState === "REACCEPTANCE_REQUIRED" ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("partnerLegal.companyPage.termsReacceptBody", {
            defaultValue:
              "Rovaro has published an updated version of the partner terms. Please review the current Partner Agreement, Partner Operating Rules and Data Protection Schedule and accept the updated package on behalf of your company.",
          })}
        </Typography>
      ) : messageKey ? (
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t(`partnerLegal.companyPage.${messageKey}`)}
        </Typography>
      ) : null}

      {legalState === "ACCEPTED_CURRENT" && acceptedAt ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}
        >
          {`${t("partnerLegal.companyPage.acceptedOn", {
            defaultValue: "Accepted",
          })}: ${new Date(acceptedAt).toLocaleString()}`}
        </Typography>
      ) : null}

      {view.canAccept && !reviewRequested ? (
        <Button
          variant="contained"
          onClick={() => setReviewRequested(true)}
          sx={{ mb: 2, textTransform: "none" }}
        >
          {legalState === "REACCEPTANCE_REQUIRED"
            ? t("partnerLegal.companyPage.reviewUpdatedTerms", {
                defaultValue: "Review and accept updated terms",
              })
            : t("partnerLegal.companyPage.termsReady", {
                defaultValue: "Review and accept terms",
              })}
        </Button>
      ) : null}

      <Stack spacing={1} sx={{ mb: 3 }}>
        {packageDocs.map((doc) => {
          const label = t(
            `partnerLegal.companyPage.documentTypes.${doc.documentType}`,
            {
              defaultValue: doc.title || doc.documentType,
            }
          );
          const changed = [
            ...changedDocumentTypes,
            ...(data.changedDocumentTypes || []),
          ].some(
            (type) =>
              String(type).replaceAll("-", "_").toUpperCase() ===
              String(doc.documentType).replaceAll("-", "_").toUpperCase()
          );
          const old = data.activeAgreement?.documents?.find(
            (item) => item.documentType === doc.documentType
          );
          return (
            <Button
              key={doc.documentType}
              type="button"
              onClick={() => setOpenDocType(doc.documentType)}
              variant="outlined"
              color="inherit"
              data-testid={`company-terms-doc-${doc.documentType}`}
              sx={{
                justifyContent: "space-between",
                textAlign: "left",
                display: "flex",
                textTransform: "none",
                width: "100%",
                px: 2,
                py: 1.5,
                borderColor: "divider",
                color: "text.primary",
              }}
              endIcon={<DescriptionOutlinedIcon fontSize="small" aria-hidden />}
            >
              <Box sx={{ textAlign: "left" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                  {changed ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={t("partnerLegal.companyPage.updatedBadge", {
                        defaultValue: "Updated",
                      })}
                    />
                  ) : null}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {`v${doc.bindingVersion || doc.version}`}
                  {old
                    ? ` · ${t("partnerLegal.companyPage.previousVersion", {
                        defaultValue: "previously v{{version}}",
                        version: old.version,
                      })}`
                    : ""}
                  {` · ${
                    doc.fellBackToSourceLanguage
                      ? t("partnerLegal.companyPage.displayedLanguage", {
                          defaultValue:
                            "Displayed in {{language}} (source language)",
                          language: doc.language,
                        })
                      : doc.language
                  }`}
                  {doc.publishedAt
                    ? ` · ${new Date(doc.publishedAt).toLocaleDateString()}`
                    : ""}
                  {` · ${t("partnerLegal.review.doc.view", {
                    defaultValue: "View document",
                  })}`}
                </Typography>
              </Box>
            </Button>
          );
        })}
      </Stack>

      {view.canAccept && reviewRequested ? (
        <Stack id="partner-terms-acceptance" spacing={1.5}>
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
            disabled={
              !accepted || busy || !signerName.trim() || !signerRole.trim()
            }
            onClick={acceptTerms}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {legalState === "REACCEPTANCE_REQUIRED"
              ? t("partnerLegal.companyPage.acceptUpdatedTerms", {
                  defaultValue: "Accept updated terms",
                })
              : t("partnerLegal.companyPage.acceptTerms")}
          </Button>
        </Stack>
      ) : null}

      <LegalDocumentModal
        open={Boolean(openDoc)}
        onClose={() => setOpenDocType("")}
        title={
          openDoc
            ? t(
                `partnerLegal.companyPage.documentTypes.${openDoc.documentType}`,
                { defaultValue: openDoc.title || openDoc.documentType }
              )
            : ""
        }
        version={openDoc?.bindingVersion || openDoc?.version || ""}
        language={
          openDoc?.language || String(i18n.language || "en").split("-")[0]
        }
        closeLabel={t("common.close", { defaultValue: "Close" })}
      >
        <DocumentSections sections={openDoc?.sections} />
      </LegalDocumentModal>
    </Box>
  );
}
