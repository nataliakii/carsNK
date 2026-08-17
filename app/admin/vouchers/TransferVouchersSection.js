"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  GlobalStyles,
  Grid,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import {
  createDefaultTransferVoucherData,
  formatDateDisplay,
  formatVoucherLabel,
  normalizeTransferVoucherData,
  voucherFieldLabel,
  voucherUiText,
} from "@/domain/vouchers/transferVoucher";

const DRAFT_KEY = "natali_transfer_voucher_draft_v1";
const EMAILS_KEY = "natali_transfer_voucher_emails_v1";
const MAX_SAVED_EMAILS = 20;

const labelCell = {
  backgroundColor: "#f4f7fb",
  color: "#073763",
  fontWeight: 700,
  width: "34%",
  border: "1px solid #cbd6df",
  padding: "5px 7px",
  verticalAlign: "top",
  fontSize: "10.5px",
  lineHeight: 1.25,
};

const valueCell = {
  border: "1px solid #cbd6df",
  padding: "5px 7px",
  verticalAlign: "top",
  fontSize: "11px",
  lineHeight: 1.3,
  color: "#1f2b38",
  minHeight: 28,
};

const printStyles = {
  "@page": { size: "A4", margin: "8mm" },
  "@media print": {
    "body *": { visibility: "hidden !important" },
    "#transfer-voucher-print, #transfer-voucher-print *": {
      visibility: "visible !important",
    },
    "#transfer-voucher-print": {
      position: "fixed !important",
      inset: "0 auto auto 0 !important",
      width: "194mm !important",
      margin: "0 !important",
      boxShadow: "none !important",
      borderRadius: "0 !important",
    },
    ".no-print": { display: "none !important" },
  },
};

function LabelText({ labelKey, bilingual, locale }) {
  const { primary, secondary } = formatVoucherLabel(labelKey, {
    bilingual,
    locale,
  });
  return (
    <>
      <div>{primary}</div>
      {secondary ? (
        <div style={{ fontWeight: 600, opacity: 0.85 }}>{secondary}</div>
      ) : null}
    </>
  );
}

function Field({ labelKey, value, bilingual, locale }) {
  return (
    <tr>
      <td style={labelCell}>
        <LabelText labelKey={labelKey} bilingual={bilingual} locale={locale} />
      </td>
      <td style={valueCell}>{value || "\u00a0"}</td>
    </tr>
  );
}

function TransferVoucherPreview({ data }) {
  const bilingual = Boolean(data.bilingual);
  const locale = data.locale || "el";
  const agreement =
    [formatDateDisplay(data.agreementDate), data.agreementTime]
      .filter(Boolean)
      .join(" ") || "\u00a0";
  const title = formatVoucherLabel("title", { bilingual, locale });
  const agreementLabel = formatVoucherLabel("agreementDateTime", {
    bilingual,
    locale,
  });
  const stampLabel = formatVoucherLabel("companyStamp", { bilingual, locale });
  const signLabel = formatVoucherLabel("customerSignature", {
    bilingual,
    locale,
  });

  return (
    <Box
      id="transfer-voucher-print"
      sx={{
        bgcolor: "#fff",
        color: "#1f2b38",
        p: 2,
        border: "1px solid #d5dde5",
        borderRadius: 1,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <Box sx={{ textAlign: "center", mb: 1 }}>
        <Typography
          sx={{
            fontWeight: 800,
            letterSpacing: 0.4,
            color: "#073763",
            fontSize: 17,
            lineHeight: 1.2,
          }}
        >
          {data.companyHeaderTitle}
        </Typography>
        <Typography
          sx={{
            whiteSpace: "pre-line",
            fontSize: 10,
            color: "#445566",
            mt: 0.5,
          }}
        >
          {data.companyInfo}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mb: 1,
          fontSize: 11,
        }}
      >
        <Box sx={{ textAlign: "right" }}>
          <Box sx={{ fontWeight: 700, color: "#073763" }}>
            {agreementLabel.primary}
            {agreementLabel.secondary ? (
              <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
                {agreementLabel.secondary}
              </Box>
            ) : null}
          </Box>
          <Box>{agreement}</Box>
        </Box>
      </Box>

      <Typography
        sx={{
          textAlign: "center",
          fontWeight: 800,
          color: "#073763",
          fontSize: 16,
          mb: 0.25,
        }}
      >
        {title.primary}
      </Typography>
      {title.secondary ? (
        <Typography
          sx={{
            textAlign: "center",
            fontWeight: 600,
            color: "#445566",
            fontSize: 12,
            mb: 1,
          }}
        >
          {title.secondary}
        </Typography>
      ) : (
        <Box sx={{ mb: 1 }} />
      )}

      <Grid container spacing={1}>
        <Grid item xs={12} md={6}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Field
                labelKey="lessee"
                value={data.lessee}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="lesseeDetails"
                value={data.lesseeDetails}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="dateOfService"
                value={formatDateDisplay(data.dateOfService)}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="pickUpPoint"
                value={data.pickUpPoint}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="rentalDuration"
                value={data.rentalDuration}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="vehicleType"
                value={data.vehicleType}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="vehicleRegNum"
                value={data.vehicleRegNum}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="driverName"
                value={data.driverName}
                bilingual={bilingual}
                locale={locale}
              />
            </tbody>
          </table>
        </Grid>
        <Grid item xs={12} md={6}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Field
                labelKey="clientName"
                value={data.clientName}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="startingPoint"
                value={data.startingPoint}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="pickUpTime"
                value={data.pickUpTime}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="endingTime"
                value={data.endingTime}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="passengers"
                value={data.passengers}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="driverLicenseNo"
                value={data.driverLicenseNo}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="driverIdNo"
                value={data.driverIdNo}
                bilingual={bilingual}
                locale={locale}
              />
              <Field
                labelKey="amount"
                value={data.amount}
                bilingual={bilingual}
                locale={locale}
              />
            </tbody>
          </table>
        </Grid>
      </Grid>

      <Box sx={{ mt: 1.5 }}>
        <Box sx={{ ...labelCell, width: "auto", borderBottom: "none" }}>
          <LabelText labelKey="notes" bilingual={bilingual} locale={locale} />
        </Box>
        <Box
          sx={{
            border: "1px solid #cbd6df",
            minHeight: 72,
            p: 1,
            whiteSpace: "pre-wrap",
            fontSize: 11,
          }}
        >
          {data.notes || "\u00a0"}
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mt: 1.5 }}>
        <Grid item xs={6}>
          <Box
            sx={{
              border: "1px solid #cbd6df",
              minHeight: 120,
              p: 1,
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#073763" }}>
              {stampLabel.primary}
              {stampLabel.secondary ? (
                <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
                  {stampLabel.secondary}
                </Box>
              ) : null}
            </Typography>
            <Box
              component="img"
              src={`${data.stampSrc}?v=2`}
              alt="Σφραγίδα"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              sx={{
                mt: 1.25,
                maxWidth: "92%",
                maxHeight: 100,
                objectFit: "contain",
                opacity: 0.92,
                transform: "rotate(-1.5deg)",
                filter: "contrast(1.05)",
              }}
            />
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box
            sx={{
              border: "1px solid #cbd6df",
              minHeight: 120,
              p: 1,
              textAlign: "center",
            }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#073763" }}>
              {signLabel.primary}
              {signLabel.secondary ? (
                <Box component="span" sx={{ display: "block", fontWeight: 600 }}>
                  {signLabel.secondary}
                </Box>
              ) : null}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

function FormField({ label, value, onChange, multiline = false, type = "text" }) {
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={value}
      type={type}
      multiline={multiline}
      minRows={multiline ? 2 : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function TransferVouchersSection({
  mode = "admin",
  accessToken = null,
  company = null,
  initialDefaults = null,
  emailApiPath = "/api/admin/vouchers/transfer/email",
}) {
  const isTokenMode = mode === "token";
  const storageSuffix = isTokenMode
    ? `_token_${String(company?._id || "x")}`
    : "_admin";
  const { i18n } = useTranslation();
  const { changeLanguage } = useMainContext();

  const voucherLocaleFromSite = (lng) => {
    const code = String(lng || "el").toLowerCase().slice(0, 2);
    return code === "el" ? "el" : "en";
  };

  const [form, setForm] = useState(() => {
    const base = createDefaultTransferVoucherData();
    const siteLocale = voucherLocaleFromSite(i18n?.language);
    return normalizeTransferVoucherData({
      ...base,
      ...(initialDefaults || {}),
      locale: siteLocale,
      bilingual: false,
      stampSrc:
        initialDefaults?.stampSrc ||
        company?.voucherStampSrc ||
        base.stampSrc,
    });
  });
  const [hydrated, setHydrated] = useState(false);
  const [savedEmails, setSavedEmails] = useState([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(null); // 'save' | 'send' | null
  const [status, setStatus] = useState(null); // { severity, text }
  const data = useMemo(
    () =>
      normalizeTransferVoucherData({
        ...form,
        bilingual: false,
        locale: form.locale === "en" ? "en" : "el",
      }),
    [form]
  );

  const draftKey = `${DRAFT_KEY}${storageSuffix}`;
  const emailsKey = `${EMAILS_KEY}${storageSuffix}`;

  // Keep voucher EL/EN in sync with the site language switcher.
  useEffect(() => {
    const apply = (lng) => {
      const next = voucherLocaleFromSite(lng);
      setForm((prev) => {
        if (prev.locale === next && !prev.bilingual) return prev;
        return normalizeTransferVoucherData({
          ...prev,
          locale: next,
          bilingual: false,
        });
      });
    };
    apply(i18n.language);
    const onChange = (lng) => apply(lng);
    i18n.on("languageChanged", onChange);
    return () => i18n.off("languageChanged", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n]);

  useEffect(() => {
    const draft = (() => {
      try {
        const raw = JSON.parse(window.localStorage.getItem(draftKey) || "null");
        return raw && typeof raw === "object" ? raw : null;
      } catch {
        return null;
      }
    })();
    if (draft) {
      setForm(
        normalizeTransferVoucherData({
          ...draft,
          locale: voucherLocaleFromSite(i18n.language),
          bilingual: false,
          stampSrc:
            initialDefaults?.stampSrc ||
            company?.voucherStampSrc ||
            draft.stampSrc,
        })
      );
    } else if (initialDefaults) {
      setForm((prev) =>
        normalizeTransferVoucherData({
          ...prev,
          ...initialDefaults,
          locale: voucherLocaleFromSite(i18n.language),
          bilingual: false,
        })
      );
    }
    const emails = (() => {
      try {
        const raw = JSON.parse(window.localStorage.getItem(emailsKey) || "[]");
        if (!Array.isArray(raw)) return [];
        return raw
          .map((e) => String(e || "").trim().toLowerCase())
          .filter((e) => e.includes("@"));
      } catch {
        return [];
      }
    })();
    setSavedEmails(emails);
    if (emails[0]) setEmail(emails[0]);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, emailsKey]);

  const persistEmailsList = (list) => {
    try {
      window.localStorage.setItem(emailsKey, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const rememberEmail = (addr) => {
    const next = String(addr || "").trim().toLowerCase();
    if (!next.includes("@")) return savedEmails;
    const list = [next, ...savedEmails.filter((e) => e !== next)].slice(
      0,
      MAX_SAVED_EMAILS
    );
    setSavedEmails(list);
    persistEmailsList(list);
    return list;
  };

  const setField = (key) => (value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setBusy("save");
    setStatus(null);
    const locale = form.locale === "en" ? "en" : "el";
    try {
      const normalized = normalizeTransferVoucherData({
        ...form,
        bilingual: false,
        stampSrc:
          initialDefaults?.stampSrc ||
          company?.voucherStampSrc ||
          form.stampSrc,
      });
      window.localStorage.setItem(draftKey, JSON.stringify(normalized));
      setForm(normalized);
      const target = String(email || "").trim().toLowerCase();
      if (target.includes("@")) rememberEmail(target);
      setStatus({
        severity: "success",
        text: voucherUiText("savedLocal", locale),
      });
    } catch (err) {
      setStatus({
        severity: "error",
        text: err?.message || voucherUiText("saveFailed", locale),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    const locale = form.locale === "en" ? "en" : "el";
    const target = String(email || "").trim().toLowerCase();
    if (!target.includes("@")) {
      setStatus({
        severity: "warning",
        text: voucherUiText("emailInvalid", locale),
      });
      return;
    }
    setBusy("send");
    setStatus(null);
    try {
      const voucher = normalizeTransferVoucherData({
        ...form,
        bilingual: false,
        stampSrc:
          initialDefaults?.stampSrc ||
          company?.voucherStampSrc ||
          form.stampSrc,
      });
      window.localStorage.setItem(draftKey, JSON.stringify(voucher));
      rememberEmail(target);

      const res = await fetch(emailApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ voucher, email: target }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.message || voucherUiText("sendFailed", locale));
      }
      setStatus({
        severity: "success",
        text: `${voucherUiText("sentTo", locale)} ${target} ${voucherUiText("pdfAttached", locale)}`,
      });
    } catch (err) {
      setStatus({
        severity: "error",
        text: err?.message || voucherUiText("sendFailed", locale),
      });
    } finally {
      setBusy(null);
    }
  };

  const uiLocale = form.locale === "en" ? "en" : "el";
  const setLocale = (next) => {
    const locale = next === "en" ? "en" : "el";
    setForm((prev) =>
      normalizeTransferVoucherData({
        ...prev,
        locale,
        bilingual: false,
      })
    );
    if (typeof changeLanguage === "function") {
      changeLanguage(locale);
    }
  };

  const fieldLabel = (key) => voucherFieldLabel(key, uiLocale);

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <GlobalStyles styles={printStyles} />

      <Box className="no-print" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          {voucherFieldLabel("pageTitle", uiLocale)}
          {company?.name ? ` — ${company.name}` : ""}
        </Typography>
        {isTokenMode ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {voucherUiText("tokenAccessHint", uiLocale)}
          </Typography>
        ) : (
          <Box sx={{ mb: 1.5 }} />
        )}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={uiLocale}
            onChange={(_, value) => {
              if (value) setLocale(value);
            }}
            aria-label={voucherUiText("language", uiLocale)}
            sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
          >
            <ToggleButton
              value="el"
              sx={{ textTransform: "none", px: 1.5, flex: { xs: 1, sm: "none" } }}
            >
              Ελληνικά
            </ToggleButton>
            <ToggleButton
              value="en"
              sx={{ textTransform: "none", px: 1.5, flex: { xs: 1, sm: "none" } }}
            >
              English
            </ToggleButton>
          </ToggleButtonGroup>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1,
              width: { xs: "100%", sm: "auto" },
              minWidth: { sm: 360 },
              flex: { sm: "0 1 420px" },
            }}
          >
            <Button
              variant="outlined"
              fullWidth
              startIcon={<RestartAltIcon />}
              onClick={() => {
                const base = createDefaultTransferVoucherData();
                setForm(
                  normalizeTransferVoucherData({
                    ...base,
                    ...(initialDefaults || {}),
                    locale: uiLocale,
                    bilingual: false,
                  })
                );
                setStatus({
                  severity: "info",
                  text: voucherUiText("formCleared", uiLocale),
                });
              }}
              sx={{ height: 40, whiteSpace: "nowrap" }}
            >
              {voucherUiText("reset", uiLocale)}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              startIcon={
                busy === "save" ? <CircularProgress size={14} /> : <SaveIcon />
              }
              disabled={Boolean(busy)}
              onClick={handleSave}
              sx={{ height: 40, whiteSpace: "nowrap" }}
            >
              {voucherUiText("save", uiLocale)}
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<LocalPrintshopIcon />}
              onClick={() => window.print()}
              sx={{ height: 40, whiteSpace: "nowrap" }}
            >
              {voucherUiText("print", uiLocale)}
            </Button>
          </Box>
        </Stack>
      </Box>

      {status ? (
        <Alert
          className="no-print"
          severity={status.severity}
          sx={{ mb: 2 }}
          onClose={() => setStatus(null)}
        >
          {status.text}
        </Alert>
      ) : null}

      <Paper className="no-print" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
        >
          <Autocomplete
            freeSolo
            fullWidth
            options={savedEmails}
            value={email}
            onChange={(_, value) => setEmail(String(value || ""))}
            onInputChange={(_, value) => setEmail(String(value || ""))}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                type="email"
                label={voucherUiText("recipientEmail", uiLocale)}
                placeholder="client@example.com"
                helperText={
                  savedEmails.length
                    ? voucherUiText("emailHelperSaved", uiLocale)
                    : voucherUiText("emailHelperEmpty", uiLocale)
                }
              />
            )}
          />
          <Button
            variant="contained"
            color="secondary"
            startIcon={
              busy === "send" ? <CircularProgress size={14} /> : <SendIcon />
            }
            disabled={Boolean(busy) || !hydrated}
            onClick={handleSend}
            sx={{
              flexShrink: 0,
              height: 40,
              minWidth: { xs: "100%", sm: 160 },
              mt: { sm: "1px" },
            }}
          >
            {voucherUiText("send", uiLocale)}
          </Button>
        </Stack>
        {savedEmails.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.25 }}
          >
            {savedEmails.map((addr) => (
              <Chip
                key={addr}
                size="small"
                label={addr}
                onClick={() => setEmail(addr)}
                onDelete={() => {
                  const next = savedEmails.filter((e) => e !== addr);
                  setSavedEmails(next);
                  persistEmailsList(next);
                  if (email === addr) setEmail(next[0] || "");
                }}
              />
            ))}
          </Stack>
        ) : null}
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={5} className="no-print">
          <Paper sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <FormField
                label={fieldLabel("companyHeaderTitle")}
                value={form.companyHeaderTitle}
                onChange={setField("companyHeaderTitle")}
              />
              <FormField
                label={fieldLabel("companyInfo")}
                value={form.companyInfo}
                onChange={setField("companyInfo")}
                multiline
              />
              <FormField
                label={fieldLabel("agreementDate")}
                type="date"
                value={form.agreementDate}
                onChange={setField("agreementDate")}
              />
              <FormField
                label={fieldLabel("agreementTime")}
                value={form.agreementTime}
                onChange={setField("agreementTime")}
              />
              <FormField
                label={fieldLabel("lessee")}
                value={form.lessee}
                onChange={setField("lessee")}
              />
              <FormField
                label={fieldLabel("lesseeDetails")}
                value={form.lesseeDetails}
                onChange={setField("lesseeDetails")}
                multiline
              />
              <FormField
                label={fieldLabel("clientName")}
                value={form.clientName}
                onChange={setField("clientName")}
              />
              <FormField
                label={fieldLabel("dateOfService")}
                type="date"
                value={form.dateOfService}
                onChange={setField("dateOfService")}
              />
              <FormField
                label={fieldLabel("startingPoint")}
                value={form.startingPoint}
                onChange={setField("startingPoint")}
              />
              <FormField
                label={fieldLabel("pickUpPoint")}
                value={form.pickUpPoint}
                onChange={setField("pickUpPoint")}
              />
              <FormField
                label={fieldLabel("pickUpTime")}
                value={form.pickUpTime}
                onChange={setField("pickUpTime")}
              />
              <FormField
                label={fieldLabel("endingTime")}
                value={form.endingTime}
                onChange={setField("endingTime")}
              />
              <FormField
                label={fieldLabel("rentalDuration")}
                value={form.rentalDuration}
                onChange={setField("rentalDuration")}
              />
              <FormField
                label={fieldLabel("passengers")}
                value={form.passengers}
                onChange={setField("passengers")}
              />
              <FormField
                label={fieldLabel("vehicleType")}
                value={form.vehicleType}
                onChange={setField("vehicleType")}
              />
              <FormField
                label={fieldLabel("vehicleRegNum")}
                value={form.vehicleRegNum}
                onChange={setField("vehicleRegNum")}
              />
              <FormField
                label={fieldLabel("driverName")}
                value={form.driverName}
                onChange={setField("driverName")}
              />
              <FormField
                label={fieldLabel("driverLicenseNo")}
                value={form.driverLicenseNo}
                onChange={setField("driverLicenseNo")}
              />
              <FormField
                label={fieldLabel("driverIdNo")}
                value={form.driverIdNo}
                onChange={setField("driverIdNo")}
              />
              <FormField
                label={fieldLabel("amount")}
                value={form.amount}
                onChange={setField("amount")}
              />
              <FormField
                label={fieldLabel("notes")}
                value={form.notes}
                onChange={setField("notes")}
                multiline
              />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={7}>
          <TransferVoucherPreview data={data} />
        </Grid>
      </Grid>
    </Box>
  );
}
