"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { CUSTOMER_RENTAL_TERMS_MAX_CHARS } from "@/domain/company/customerRentalTermsConstants";

import PartnerComplianceGate from "./_components/PartnerComplianceGate";

async function readJsonBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * English rental rules the customer accepts at booking, plus Google
 * translations into every site language.
 */
export default function PartnerCustomerRulesSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gate, setGate] = useState(null);
  const [listedOnMarketplace, setListedOnMarketplace] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [sourceEn, setSourceEn] = useState("");
  const [savedSource, setSavedSource] = useState("");
  const [terms, setTerms] = useState(null);
  const [failed, setFailed] = useState([]);
  const [previewLang, setPreviewLang] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [rulesRes, statusRes] = await Promise.all([
        fetch("/api/partner/legal/customer-rules", { cache: "no-store" }),
        fetch("/api/partner/legal/status", { cache: "no-store" }),
      ]);
      const rulesJson = await readJsonBody(rulesRes);
      if (!rulesJson.success) {
        throw new Error(
          rulesJson.message || t("partnerLegal.customerRules.loadFailed")
        );
      }
      setCompanyName(rulesJson.companyName || "");
      setSourceEn(rulesJson.terms?.sourceEn || "");
      setSavedSource(rulesJson.terms?.sourceEn || "");
      setTerms(rulesJson.terms || null);
      setFailed([]);
      const statusJson = await readJsonBody(statusRes);
      setGate(statusJson.success ? statusJson.gate : null);
      setListedOnMarketplace(
        statusJson.success ? statusJson.listedOnMarketplace !== false : true
      );
    } catch (err) {
      setError(err?.message || t("partnerLegal.customerRules.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = sourceEn !== savedSource;
  const translations = terms?.translations || {};
  const translatedLanguages = useMemo(
    () => Object.keys(translations).sort(),
    [translations]
  );

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/partner/legal/customer-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEn }),
      });
      const json = await readJsonBody(res);
      if (!json.success) {
        throw new Error(
          json.message || t("partnerLegal.customerRules.saveFailed")
        );
      }
      setTerms(json.terms || null);
      setSavedSource(json.terms?.sourceEn || "");
      setSourceEn(json.terms?.sourceEn || "");
      setFailed(Array.isArray(json.failed) ? json.failed : []);
      if (!json.terms?.sourceEn) {
        setNotice(t("partnerLegal.customerRules.cleared"));
      } else if (!json.translateConfigured) {
        setNotice(t("partnerLegal.customerRules.savedWithoutTranslate"));
      } else if ((json.failed || []).length) {
        setNotice(t("partnerLegal.customerRules.savedPartial"));
      } else {
        setNotice(t("partnerLegal.customerRules.saved"));
      }
    } catch (err) {
      setError(err?.message || t("partnerLegal.customerRules.saveFailed"));
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
    <Box sx={{ mt: 2 }}>
      <PartnerComplianceGate
        gate={gate}
        hideWhenOpen
        listedOnMarketplace={listedOnMarketplace}
      />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {t("partnerLegal.customerRules.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("partnerLegal.customerRules.subtitle", { company: companyName })}
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}
      {terms && !terms.translateConfigured ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>
            {t("partnerLegal.customerRules.translateMissingTitle")}
          </AlertTitle>
          {t("partnerLegal.customerRules.translateMissingBody")}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <TextField
          label={t("partnerLegal.customerRules.englishLabel")}
          helperText={t("partnerLegal.customerRules.englishHint", {
            max: CUSTOMER_RENTAL_TERMS_MAX_CHARS,
          })}
          value={sourceEn}
          onChange={(event) => setSourceEn(event.target.value)}
          multiline
          minRows={12}
          fullWidth
          inputProps={{ maxLength: CUSTOMER_RENTAL_TERMS_MAX_CHARS }}
        />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mt: 2 }}
          alignItems={{ sm: "center" }}
        >
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving
              ? t("partnerLegal.customerRules.saving")
              : t("partnerLegal.customerRules.save")}
          </Button>
          {dirty ? (
            <Typography variant="caption" color="text.secondary">
              {t("partnerLegal.customerRules.unsaved")}
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {translatedLanguages.length ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            {t("partnerLegal.customerRules.translationsTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("partnerLegal.customerRules.translationsBody", {
              languages: translatedLanguages.join(", "),
            })}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {translatedLanguages.map((code) => (
              <Button
                key={code}
                size="small"
                variant={previewLang === code ? "contained" : "outlined"}
                onClick={() =>
                  setPreviewLang((current) => (current === code ? "" : code))
                }
              >
                {code.toUpperCase()}
              </Button>
            ))}
          </Stack>
          <Collapse in={Boolean(previewLang && translations[previewLang])}>
            <TextField
              value={translations[previewLang] || ""}
              multiline
              minRows={8}
              fullWidth
              InputProps={{ readOnly: true }}
            />
          </Collapse>
        </Paper>
      ) : null}

      {failed.length ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <AlertTitle>{t("partnerLegal.customerRules.failedTitle")}</AlertTitle>
          {failed.map((row) => `${row.language}: ${row.message}`).join(" · ")}
        </Alert>
      ) : null}
    </Box>
  );
}
