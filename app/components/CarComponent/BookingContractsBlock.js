"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";
import LegalDocumentModal from "@app/components/Legal/LegalDocumentModal";
import { CUSTOMER_TERMS_SEGMENT } from "@/domain/legal/customerTermsRoute";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";

function euroFromMinor(minor) {
  const amount = (Number(minor) || 0) / 100;
  return `€${amount.toFixed(2)}`;
}

function formatPublishedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function InlineLink({ children, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.();
      }}
      sx={{
        border: 0,
        p: 0,
        m: 0,
        background: "none",
        color: "var(--color-text-accent, #c2185b)",
        font: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontWeight: 600,
        cursor: "pointer",
        textDecoration: "underline",
        verticalAlign: "baseline",
      }}
    >
      {children}
    </Box>
  );
}

function ContractSections({ content }) {
  const sections = content?.sections || [];
  return (
    <Box>
      {sections.map((section) => (
        <Box key={section.id} sx={{ mb: 2.5 }}>
          {section.heading ? (
            <Typography component="h2" sx={{ fontSize: "1.05rem", fontWeight: 700, mb: 0.75 }}>
              {section.heading}
            </Typography>
          ) : null}
          <Typography component="div" sx={{ whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: 1.6 }}>
            {section.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function BookingContractsBlock({
  companyId,
  lang,
  companyName,
  error,
  onChange,
  feeAmountMinor = 0,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"), { defaultMatches: false, noSsr: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [platform, setPlatform] = useState(null);
  const [company, setCompany] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [openKind, setOpenKind] = useState("");
  const [platformAccepted, setPlatformAccepted] = useState(false);
  const [companyAccepted, setCompanyAccepted] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const locale = String(lang || "en").slice(0, 2);
  const feeAmount = euroFromMinor(feeAmountMinor);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        setPlatformAccepted(false);
        setCompanyAccepted(false);
        const params = new URLSearchParams();
        if (lang) params.set("lang", lang);
        if (companyId) params.set("companyId", String(companyId));
        const res = await fetch(`/api/public/booking-agreements?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.message || "Failed to load agreements");
        if (cancelled) return;
        const nextPlatform =
          json.platform?.available && json.platform?.source !== "draft" ? json.platform : null;
        setPlatform(nextPlatform);
        setCompany(json.company?.available ? json.company : null);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || "Could not load the contracts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, lang]);

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
                sourceHash: company?.sourceHash || company?.checksum || "",
                language: company?.language || lang || "en",
              },
            }
          : {}),
      },
      platformAccepted,
      companyAccepted: companyNeeded ? companyAccepted : true,
      companyRequired: companyNeeded,
    });
  }, [loading, platformAccepted, companyAccepted, platform, company, lang]);

  const openPrivacy = async () => {
    setOpenKind("privacy");
    if (privacy?.checksum) return;
    try {
      const res = await fetch(
        `/api/public/legal/${LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY}?lang=${encodeURIComponent(locale)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json?.success && json.source === "published") setPrivacy(json);
    } catch {
      setPrivacy(null);
    }
  };

  const active =
    openKind === "platform"
      ? platform
      : openKind === "privacy"
        ? privacy
        : openKind === "company"
          ? company
          : null;
  const modalTitle =
    openKind === "privacy"
      ? "Privacy Policy"
      : openKind === "company"
        ? `${company?.companyName || companyName || "Supplier"} Rental Terms`
        : openKind === "fee"
          ? "Booking Fee"
          : platform?.content?.title || "Rovaro Booking Terms";
  const publicHref =
    openKind === "platform"
      ? `/${locale}${CUSTOMER_TERMS_SEGMENT}`
      : openKind === "privacy"
        ? `/${locale}/privacy-policy`
        : "";

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 1.5 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          {t("order.contractsLoading")}
        </Typography>
      </Box>
    );
  }

  if (loadError || !platform?.available) {
    return (
      <Typography color="error" variant="body2" sx={{ my: 1.5 }}>
        {loadError || t("order.platformTermsUnavailable")}
      </Typography>
    );
  }

  const companyLabel = company?.companyName || companyName || "";

  return (
    <Box data-testid="terms-and-privacy" sx={{ my: 2 }}>
      <Typography component="h2" sx={{ fontSize: "1rem", fontWeight: 700, mb: 1 }}>
        Terms and privacy
      </Typography>
      <FormControlLabel
        sx={{ alignItems: "flex-start", m: 0, "& .MuiFormControlLabel-label": { fontSize: "0.9rem", lineHeight: 1.45 } }}
        control={
          <Checkbox
            size="small"
            checked={platformAccepted}
            onChange={(event) => setPlatformAccepted(event.target.checked)}
            inputProps={{ "aria-label": "Accept Rovaro Booking Terms" }}
          />
        }
        label={
          <Typography component="span" sx={{ fontSize: "0.9rem", lineHeight: 1.45 }}>
            I accept the{" "}
            <InlineLink onClick={() => setOpenKind("platform")}>Rovaro Booking Terms</InlineLink>{" "}
            and understand that the {feeAmount} Booking Fee may be non-refundable in the
            circumstances described in the terms.
          </Typography>
        }
      />
      {company ? (
        <FormControlLabel
          sx={{ alignItems: "flex-start", m: 0, mt: 0.75, "& .MuiFormControlLabel-label": { fontSize: "0.9rem" } }}
          control={
            <Checkbox
              size="small"
              checked={companyAccepted}
              onChange={(event) => setCompanyAccepted(event.target.checked)}
              inputProps={{ "aria-label": "Accept supplier rental terms" }}
            />
          }
          label={
            <Typography component="span" sx={{ fontSize: "0.9rem", lineHeight: 1.45 }}>
              I accept{" "}
              <InlineLink onClick={() => setOpenKind("company")}>{companyLabel} Rental Terms</InlineLink>.
            </Typography>
          }
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ display: "block", mt: 0.75, fontSize: "0.9rem" }}>
          Rovaro standard rental terms apply.
        </Typography>
      )}
      <Typography component="p" sx={{ mt: 1, mb: 0, fontSize: "0.9rem", lineHeight: 1.45, color: "text.secondary" }}>
        We use your details to manage this booking and share the necessary information with the rental supplier. Read our{" "}
        <InlineLink onClick={openPrivacy}>Privacy Policy</InlineLink>.
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <InlineLink onClick={() => setOpenKind("fee")}>See when the Booking Fee is refunded</InlineLink>
      </Box>
      {error ? (
        <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.75 }}>
          {error}
        </Typography>
      ) : null}
      <LegalDocumentModal
        open={Boolean(openKind)}
        onClose={() => setOpenKind("")}
        title={modalTitle}
        version={active?.version || ""}
        publishedAt={formatPublishedDate(active?.effectiveFrom || active?.publishedAt)}
        language={active?.language || (openKind === "fee" ? "" : locale)}
        publicHref={publicHref}
        closeLabel={t("order.closeContract")}
        openInNewTabLabel="Open in new tab"
      >
        {openKind === "fee" ? (
          <BookingFeeOutcomesTable
            language={locale}
            embedded
            viewport={narrow ? "mobile" : "desktop"}
          />
        ) : openKind === "company" ? (
          <Typography component="div" sx={{ whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: 1.6 }}>
            {company?.body || ""}
          </Typography>
        ) : openKind === "privacy" ? (
          <ContractSections content={privacy?.content} />
        ) : (
          <ContractSections content={platform?.content} />
        )}
      </LegalDocumentModal>
    </Box>
  );
}
