"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  GlobalStyles,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import {
  createDefaultTransferVoucherData,
  formatDateDisplay,
  formatVoucherLabel,
  normalizeTransferVoucherData,
} from "@/domain/vouchers/transferVoucher";

const DRAFT_KEY = "natali_transfer_voucher_draft_v1";
const EMAILS_KEY = "natali_transfer_voucher_emails_v1";
const MAX_SAVED_EMAILS = 20;

function readSavedEmails() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(EMAILS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((e) => String(e || "").trim().toLowerCase())
      .filter((e) => e.includes("@"));
  } catch {
    return [];
  }
}

function persistEmail(email) {
  const next = String(email || "").trim().toLowerCase();
  if (!next.includes("@")) return readSavedEmails();
  const prev = readSavedEmails().filter((e) => e !== next);
  const list = [next, ...prev].slice(0, MAX_SAVED_EMAILS);
  try {
    window.localStorage.setItem(EMAILS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

function readDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}
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

export default function TransferVouchersSection() {
  const [form, setForm] = useState(() => createDefaultTransferVoucherData());
  const [hydrated, setHydrated] = useState(false);
  const [savedEmails, setSavedEmails] = useState([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(null); // 'save' | 'send' | null
  const [status, setStatus] = useState(null); // { severity, text }
  const data = useMemo(() => normalizeTransferVoucherData(form), [form]);

  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setForm(normalizeTransferVoucherData(draft));
    }
    const emails = readSavedEmails();
    setSavedEmails(emails);
    if (emails[0]) setEmail(emails[0]);
    setHydrated(true);
  }, []);

  const setField = (key) => (value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setBusy("save");
    setStatus(null);
    try {
      const normalized = normalizeTransferVoucherData(form);
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(normalized));
      setForm(normalized);
      const target = String(email || "").trim().toLowerCase();
      if (target.includes("@")) {
        setSavedEmails(persistEmail(target));
      }
      setStatus({
        severity: "success",
        text: "Сохранено на этом устройстве. Можно вернуться позже.",
      });
    } catch (err) {
      setStatus({
        severity: "error",
        text: err?.message || "Не удалось сохранить",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    const target = String(email || "").trim().toLowerCase();
    if (!target.includes("@")) {
      setStatus({ severity: "warning", text: "Укажите корректный email" });
      return;
    }
    setBusy("send");
    setStatus(null);
    try {
      const voucher = normalizeTransferVoucherData(form);
      // Keep draft + email history in sync before send
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(voucher));
      const emails = persistEmail(target);
      setSavedEmails(emails);

      const res = await fetch("/api/admin/vouchers/transfer/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ voucher, email: target }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.message || "Не удалось отправить");
      }
      setStatus({
        severity: "success",
        text: `Отправлено на ${target}`,
      });
    } catch (err) {
      setStatus({
        severity: "error",
        text: err?.message || "Ошибка отправки",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1280, mx: "auto" }}>
      <GlobalStyles styles={printStyles} />

      <Stack
        className="no-print"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Κουπόνια μεταφοράς
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Προς το παρόν μόνο ελληνικά. Αργότερα: ελληνικά + αγγλικά.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            className="no-print"
            control={
              <Switch
                checked={Boolean(form.bilingual)}
                onChange={(e) => setField("bilingual")(e.target.checked)}
                size="small"
              />
            }
            label="EN + EL (preview)"
          />
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              setForm(createDefaultTransferVoucherData());
              setStatus({ severity: "info", text: "Форма очищена" });
            }}
          >
            Reset
          </Button>
          <Button
            variant="outlined"
            startIcon={
              busy === "save" ? <CircularProgress size={14} /> : <SaveIcon />
            }
            disabled={Boolean(busy)}
            onClick={handleSave}
          >
            Сохранить
          </Button>
          <Button
            variant="contained"
            startIcon={<LocalPrintshopIcon />}
            onClick={() => window.print()}
          >
            Εκτύπωση
          </Button>
        </Stack>
      </Stack>

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
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ md: "center" }}
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
                label="Email получателя"
                placeholder="client@example.com"
                helperText={
                  savedEmails.length
                    ? "Сохранённые адреса подставляются из списка"
                    : "Адрес сохранится после отправки"
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
            sx={{ flexShrink: 0, minWidth: 160 }}
          >
            Отправить
          </Button>
        </Stack>
        {savedEmails.length > 0 ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            {savedEmails.map((addr) => (
              <Chip
                key={addr}
                size="small"
                label={addr}
                onClick={() => setEmail(addr)}
                onDelete={() => {
                  const next = savedEmails.filter((e) => e !== addr);
                  setSavedEmails(next);
                  try {
                    window.localStorage.setItem(
                      EMAILS_KEY,
                      JSON.stringify(next)
                    );
                  } catch {
                    // ignore
                  }
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
                label="Τίτλος εταιρείας"
                value={form.companyHeaderTitle}
                onChange={setField("companyHeaderTitle")}
              />
              <FormField
                label="Στοιχεία εταιρείας"
                value={form.companyInfo}
                onChange={setField("companyInfo")}
                multiline
              />
              <FormField
                label="Ημερομηνία κατάρτισης"
                type="date"
                value={form.agreementDate}
                onChange={setField("agreementDate")}
              />
              <FormField
                label="Ώρα κατάρτισης"
                value={form.agreementTime}
                onChange={setField("agreementTime")}
              />
              <FormField
                label="Μισθωτής"
                value={form.lessee}
                onChange={setField("lessee")}
              />
              <FormField
                label="Στοιχεία μισθωτή"
                value={form.lesseeDetails}
                onChange={setField("lesseeDetails")}
                multiline
              />
              <FormField
                label="Όνομα πελάτη"
                value={form.clientName}
                onChange={setField("clientName")}
              />
              <FormField
                label="Ημερομηνία υπηρεσίας"
                type="date"
                value={form.dateOfService}
                onChange={setField("dateOfService")}
              />
              <FormField
                label="Σημείο έναρξης"
                value={form.startingPoint}
                onChange={setField("startingPoint")}
              />
              <FormField
                label="Σημείο παραλαβής"
                value={form.pickUpPoint}
                onChange={setField("pickUpPoint")}
              />
              <FormField
                label="Ώρα παραλαβής"
                value={form.pickUpTime}
                onChange={setField("pickUpTime")}
              />
              <FormField
                label="Ώρα λήξης"
                value={form.endingTime}
                onChange={setField("endingTime")}
              />
              <FormField
                label="Διάρκεια μίσθωσης"
                value={form.rentalDuration}
                onChange={setField("rentalDuration")}
              />
              <FormField
                label="Αριθμός ατόμων"
                value={form.passengers}
                onChange={setField("passengers")}
              />
              <FormField
                label="Τύπος οχήματος"
                value={form.vehicleType}
                onChange={setField("vehicleType")}
              />
              <FormField
                label="Αρ. κυκλοφορίας"
                value={form.vehicleRegNum}
                onChange={setField("vehicleRegNum")}
              />
              <FormField
                label="Όνομα οδηγού"
                value={form.driverName}
                onChange={setField("driverName")}
              />
              <FormField
                label="Αριθμός άδειας οδήγησης"
                value={form.driverLicenseNo}
                onChange={setField("driverLicenseNo")}
              />
              <FormField
                label="Αριθμός ΔΤ οδηγού"
                value={form.driverIdNo}
                onChange={setField("driverIdNo")}
              />
              <FormField
                label="Ποσό"
                value={form.amount}
                onChange={setField("amount")}
              />
              <FormField
                label="Παρατηρήσεις"
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
