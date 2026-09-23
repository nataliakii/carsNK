"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import {
  formatMarketplaceEuro,
  marketplaceSplitLabels,
} from "@/domain/orders/marketplaceFinancialSplit";

function ContractBody({ platform, company, kind }) {
  if (kind === "company") {
    return (
      <Typography
        component="pre"
        sx={{
          m: 0,
          whiteSpace: "pre-wrap",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          lineHeight: 1.6,
        }}
      >
        {company?.body || ""}
      </Typography>
    );
  }
  const sections = platform?.content?.sections || [];
  return (
    <Box>
      {sections.map((section) => (
        <Box key={section.id} sx={{ mb: 2.5 }}>
          {section.heading ? (
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75 }}>
              {section.heading}
            </Typography>
          ) : null}
          <Typography
            component="div"
            sx={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", lineHeight: 1.6 }}
          >
            {section.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Two required contracts at public booking: Rovaro platform terms and the
 * supplier's rental rules. Each opens in its own readable dialog; the
 * checkbox is only ticked after Accept inside that dialog.
 */
export default function BookingContractsBlock({
  companyId,
  lang,
  companyName,
  error,
  onChange,
  compactMarketplace = false,
  feeAmountMinor = 0,
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [platform, setPlatform] = useState(null);
  const [company, setCompany] = useState(null);
  const [openKind, setOpenKind] = useState("");
  const [platformAccepted, setPlatformAccepted] = useState(false);
  const [companyAccepted, setCompanyAccepted] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      setPlatformAccepted(false);
      setCompanyAccepted(false);
      try {
        const params = new URLSearchParams();
        if (lang) params.set("lang", lang);
        if (companyId) params.set("companyId", String(companyId));
        const res = await fetch(
          `/api/public/booking-agreements?${params.toString()}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.message || "Failed to load agreements");
        }
        if (cancelled) return;
        setPlatform(json.platform || null);
        setCompany(json.company || null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.message || t("order.contractsLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, lang, t]);

  useEffect(() => {
    if (loading) return;
    const fn = onChangeRef.current;
    if (typeof fn !== "function") return;
    const companyNeeded = Boolean(company?.available);
    fn({
      ready: Boolean(platform?.available),
      payload: {
        platform: {
          accepted: platformAccepted,
          checksum: platform?.checksum || "",
          version: platform?.version || 0,
          language: platform?.language || lang || "en",
        },
        ...(companyNeeded
          ? {
              company: {
                accepted: companyAccepted,
                sourceHash: company?.sourceHash || "",
                language: company?.language || lang || "en",
              },
            }
          : {}),
      },
      platformAccepted,
      companyAccepted: companyNeeded ? companyAccepted : true,
      companyRequired: companyNeeded,
    });
  }, [
    loading,
    platformAccepted,
    companyAccepted,
    platform,
    company,
    lang,
  ]);

  const open = (kind) => setOpenKind(kind);
  const close = () => setOpenKind("");

  const acceptOpen = () => {
    if (openKind === "platform" || compactMarketplace) {
      setPlatformAccepted(true);
      if (company?.available) setCompanyAccepted(true);
    }
    if (openKind === "company") setCompanyAccepted(true);
    setOpenKind("");
  };

  const dialogTitle =
    openKind === "company"
      ? t("order.companyTermsTitle", {
          company: company?.companyName || companyName || "",
        })
      : t("order.platformTermsTitle");
  const dialogFellBack =
    openKind === "company"
      ? Boolean(company?.fellBackToEnglish)
      : Boolean(platform?.fellBackToEnglish);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t("order.contractsLoading")}
        </Typography>
      </Box>
    );
  }

  if (loadError || !platform?.available) {
    return (
      <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
        {loadError || t("order.platformTermsUnavailable")}
      </Typography>
    );
  }

  const companyLabel = company?.companyName || companyName || "";
  const splitLabels = marketplaceSplitLabels(lang);
  const feeAmount = formatMarketplaceEuro(feeAmountMinor);
  const termsPhrase = splitLabels.bookingTerms;
  const compactLabel = t("order.agreeToBookingTermsFee", {
    amount: feeAmount,
    terms: "[[terms]]",
  });
  const [compactBefore, compactAfter] = compactLabel.split("[[terms]]");

  const termsDialog = (
    <Dialog
      open={Boolean(openKind)}
      onClose={(_event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        close();
      }}
      fullWidth
      maxWidth="md"
      scroll="paper"
    >
      <DialogTitle sx={{ pr: 6 }}>
        {compactMarketplace ? splitLabels.bookingTerms : dialogTitle}
        <IconButton
          aria-label={t("order.closeContract")}
          onClick={close}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: { xs: "70vh", sm: "65vh" } }}>
        {dialogFellBack ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            {t("order.fellBackToEnglish")}
          </Typography>
        ) : null}
        {compactMarketplace ? (
          <>
            <ContractBody platform={platform} company={company} kind="platform" />
            {company?.available ? (
              <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("order.companyTermsTitle", { company: companyLabel })}
                </Typography>
                <ContractBody platform={platform} company={company} kind="company" />
              </Box>
            ) : null}
          </>
        ) : (
          <ContractBody platform={platform} company={company} kind={openKind} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={close}>{t("order.closeContract")}</Button>
        <Button variant="contained" onClick={acceptOpen}>
          {compactMarketplace ? t("common.accept", { defaultValue: "Accept" }) : t("order.acceptContract")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (compactMarketplace) {
    const termsAccepted = platformAccepted && (!company?.available || companyAccepted);
    return (
      <Box
        className={error ? "booking-field-shake" : ""}
        sx={{ mt: 1.5 }}
      >
        <Button
          size="small"
          onClick={() => open("platform")}
          sx={{ px: 0, minWidth: 0, mb: 0.75, fontWeight: 600 }}
        >
          {splitLabels.bookingTerms}
        </Button>
        <FormControlLabel
          sx={{
            alignItems: "flex-start",
            m: 0,
            "& .MuiFormControlLabel-label": { fontSize: "0.85rem", lineHeight: 1.45 },
          }}
          control={
            <Checkbox
              size="small"
              checked={termsAccepted}
              onChange={() => {
                if (!termsAccepted) open("platform");
              }}
            />
          }
          label={
            <Typography component="span" variant="body2" sx={{ fontSize: "0.85rem" }}>
              {compactBefore}
              <Box
                component="button"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  open("platform");
                }}
                sx={{
                  border: 0,
                  p: 0,
                  background: "none",
                  color: "primary.main",
                  font: "inherit",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {termsPhrase}
              </Box>
              {compactAfter}
            </Typography>
          }
        />
        {error ? (
          <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.5 }}>
            {error}
          </Typography>
        ) : null}
        {termsDialog}
      </Box>
    );
  }

  return (
    <Box
      className={error ? "booking-field-shake" : ""}
      sx={{
        mt: 1.5,
        p: 1.25,
        border: "1px solid",
        borderColor: error ? "error.main" : "divider",
        borderRadius: 1,
        bgcolor: error ? "error.lighter" : "action.hover",
      }}
    >
      <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.4 }}>
        {t("order.contractsHint")}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <FormControlLabel
          sx={{
            alignItems: "flex-start",
            m: 0,
            flex: 1,
            "& .MuiFormControlLabel-label": { fontSize: "0.85rem", lineHeight: 1.4 },
          }}
          control={
            <Checkbox
              size="small"
              checked={platformAccepted}
              onChange={() => open("platform")}
            />
          }
          label={
            <Typography component="span" variant="body2" sx={{ fontSize: "0.85rem" }}>
              {t("order.agreeToPlatformTerms")}
            </Typography>
          }
        />
        <Button size="small" onClick={() => open("platform")} sx={{ mt: 0.25 }}>
          {t("order.readContract")}
        </Button>
      </Box>

      {company?.available ? (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mt: 0.75 }}>
          <FormControlLabel
            sx={{
              alignItems: "flex-start",
              m: 0,
              flex: 1,
              "& .MuiFormControlLabel-label": {
                fontSize: "0.85rem",
                lineHeight: 1.4,
              },
            }}
            control={
              <Checkbox
                size="small"
                checked={companyAccepted}
                onChange={() => open("company")}
              />
            }
            label={
              <Typography component="span" variant="body2" sx={{ fontSize: "0.85rem" }}>
                {t("order.agreeToCompanyTerms", { company: companyLabel })}
              </Typography>
            }
          />
          <Button size="small" onClick={() => open("company")} sx={{ mt: 0.25 }}>
            {t("order.readContract")}
          </Button>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {t("order.companyTermsMissing")}
        </Typography>
      )}

      {error ? (
        <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}

      {termsDialog}
    </Box>
  );
}
