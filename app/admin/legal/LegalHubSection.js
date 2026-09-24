"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { standardPackageNeedsPublish } from "@/domain/legal/companyLegalPage";
import { LEGAL_LANGUAGES } from "@/domain/legal/documentTypes";
import LegalDocumentCards from "./LegalDocumentCards";
import LegalDocumentWorkspace from "./LegalDocumentWorkspace";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";

/**
 * Superadmin legal hub: partner document review + platform publish.
 */

const TAB_KEYS = ["documents", "settings", "audit"];
const TAB_LABEL_KEYS = {
  documents: "admin.legalHub.tabDocuments",
  partners: "admin.legalHub.tabPartners",
  settings: "admin.legalHub.tabSettings",
  audit: "admin.legalHub.tabAudit",
};

function documentsNeedSeed(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return true;
  return documents.every((entry) =>
    ["en", "es"].every((lang) => !entry.languages?.[lang]?.latestVersion)
  );
}

function StatusChip({ status }) {
  const ok = status === "ok";
  return (
    <Chip
      size="small"
      label={ok ? "OK" : "Missing"}
      color={ok ? "success" : "warning"}
      variant={ok ? "outlined" : "filled"}
    />
  );
}

function Row({ label, children }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ py: 0.75, borderBottom: "1px solid #f0f0f0" }}
      alignItems={{ sm: "center" }}
      justifyContent="space-between"
    >
      <Typography sx={{ fontSize: "0.85rem", color: "#607d8b" }}>{label}</Typography>
      <Box sx={{ fontSize: "0.88rem", fontWeight: 600 }}>{children}</Box>
    </Stack>
  );
}

function DocumentsTab() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState({ open: false, mode: "preview", doc: null });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/legal/config", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load");
      setData(json);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function documentAction(payload) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/legal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || t("admin.legalHub.actionFailed"));
      }
      await load();
      return json;
    } catch (err) {
      setError(err.message || t("admin.legalHub.actionFailed"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  if (!data && !error) return <CircularProgress size={22} />;
  if (error && !data) return <Alert severity="error">{error}</Alert>;

  const empty = documentsNeedSeed(data.documents);

  if (empty) {
    return (
      <Box
        sx={{
          textAlign: "center",
          py: { xs: 6, md: 8 },
          px: 2,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
            {error}
          </Alert>
        ) : null}
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          {t("admin.legalHub.emptyTitle")}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3, maxWidth: 520, mx: "auto" }}
        >
          {t("admin.legalHub.emptyBody")}
        </Typography>
        <Button
          variant="contained"
          size="large"
          disabled={saving}
          onClick={() => documentAction({ action: "seed" })}
          sx={{ py: 1.5, px: 4, fontSize: "1.1rem", fontWeight: 800 }}
        >
          {saving
            ? t("admin.legalHub.saving")
            : t("admin.legalHub.loadDrafts")}
        </Button>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {standardPackageNeedsPublish(data?.documents) ? (
        <Alert severity="warning">{t("admin.legalHub.publishHint")}</Alert>
      ) : null}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
      >
        <Button
          variant="outlined"
          size="large"
          onClick={() => documentAction({ action: "seed" })}
          disabled={saving}
          sx={{ fontWeight: 700 }}
        >
          {t("admin.legalHub.loadDrafts")}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t("admin.legalHub.publishHint")}
        </Typography>
      </Stack>

      <LegalDocumentCards
        overview={data.documents}
        onEdit={(doc, mode) => setWorkspace({ open: true, mode, doc })}
      />

      <BookingFeeOutcomesTable language="en" compact />

      {data.documents.map((entry) => (
        <Box
          key={entry.documentType}
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, mb: 1.5 }}>
            {t(`admin.legalHub.documentTypes.${entry.documentType}`, {
              defaultValue: entry.documentType,
            })}
          </Typography>
          <Stack spacing={1.25}>
            {LEGAL_LANGUAGES.map((lang) => {
              const info = entry.languages[lang];
              const published = Boolean(info?.published);
              return (
                <Stack
                  key={lang}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={lang.toUpperCase()} />
                    <Typography variant="body2">
                      {published
                        ? t("admin.legalHub.published", {
                            version: info.published.version,
                          })
                        : info?.latestVersion
                          ? t("admin.legalHub.draft", {
                              status: info.latestStatus,
                              version: info.latestVersion,
                            })
                          : t("admin.legalHub.missing")}
                    </Typography>
                  </Stack>
                  {info?.latestVersion && !published ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="contained"
                        size="large"
                        disabled={saving}
                        onClick={() => {
                          const changeClass = window.confirm(
                            "Is this a material change that requires partner re-acceptance?\n\nOK = Material\nCancel = Editorial (no new acceptance)"
                          )
                            ? "material"
                            : "editorial";
                          if (
                            !window.confirm(
                              `Publish ${entry.documentType} (${lang.toUpperCase()}) v${info.latestVersion} as ${changeClass}?`
                            )
                          ) {
                            return;
                          }
                          documentAction({
                            action: "publish",
                            documentType: entry.documentType,
                            language: lang,
                            version: info.latestVersion,
                            changeClass,
                          });
                        }}
                        sx={{ fontWeight: 800, minWidth: 160 }}
                      >
                        {t("admin.legalHub.publishLang", {
                          lang: lang.toUpperCase(),
                        })}
                      </Button>
                    </Stack>
                  ) : null}
                  {published ? (
                    <Button
                      size="small"
                      color="warning"
                      disabled={saving}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Archive published ${entry.documentType} (${lang.toUpperCase()}) v${info.published.version}?`
                          )
                        ) {
                          return;
                        }
                        documentAction({
                          action: "archive",
                          documentType: entry.documentType,
                          language: lang,
                          version: info.published.version,
                        });
                      }}
                    >
                      {t("admin.legalHub.archive")}
                    </Button>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        </Box>
      ))}

      <LegalDocumentWorkspace
        open={workspace.open}
        mode={workspace.mode}
        documentMeta={workspace.doc}
        overviewEntry={
          (data.documents || []).find(
            (row) => row.documentType === workspace.doc?.documentType
          ) || null
        }
        documents={[]}
        busy={saving}
        onClose={() => setWorkspace({ open: false, mode: "preview", doc: null })}
        onAction={documentAction}
      />
    </Stack>
  );
}

function ConfigTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/legal/config", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load");
      setData(json);
      setDraft({
        supplierCancellationServiceCharge:
          json.settings.supplierCancellationServiceCharge ?? "",
        replacementCostDifferenceCap:
          json.settings.replacementCostDifferenceCap ?? "",
        standardRequestResponseHours: json.settings.standardRequestResponseHours,
        urgentRequestResponseMinutes: json.settings.urgentRequestResponseMinutes,
        paymentLinkExpirationMinutes: json.settings.paymentLinkExpirationMinutes,
        replacementNotificationHours: json.settings.replacementNotificationHours,
        partnerComplaintResponseHours: json.settings.partnerComplaintResponseHours,
        documentRetentionDays: json.settings.documentRetentionDays,
        documentRetentionBatchSize: json.settings.documentRetentionBatchSize,
        documentRetentionMaxBatches: json.settings.documentRetentionMaxBatches,
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/legal/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Save failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress size={22} />;

  return (
    <Stack spacing={3}>
      {data.warning ? <Alert severity="warning">{data.warning}</Alert> : null}

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Operator
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Edit My business details under{" "}
          <Typography component="a" href="/admin/company" sx={{ fontWeight: 600 }}>
            Settings
          </Typography>
          .
        </Typography>
        <Row label="Legal name">{data.operator.ownerLegalName}</Row>
        <Row label="Legal structure">
          {data.operator.legalStructure} · {data.operator.countryOfEstablishment}
        </Row>
        <Row label="Trading name">{data.operator.tradingName}</Row>
        <Row label="Platform brand">{data.operator.platformBrand}</Row>
        <Row label="Legal email">{data.operator.legalEmail}</Row>
        <Row label="Domains">
          {data.operator.primaryDomain} · {data.operator.spanishDomain}
        </Row>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Configurable legal values
        </Typography>
        {data.entityStatus.fields.map((field) => (
          <Row key={field.key} label={`${field.label} (${field.env})`}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusChip status={field.status} />
              <Typography sx={{ fontSize: "0.78rem", color: "#90a4ae" }}>
                {field.severity}
                {field.public ? "" : " · server only"}
              </Typography>
            </Stack>
          </Row>
        ))}
        <Typography sx={{ mt: 1, fontSize: "0.78rem", color: "#90a4ae" }}>
          Missing values are never shown to customers or partners — the
          dependent sentence is simply omitted from published documents.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          VAT and tax
        </Typography>
        <Row label="VAT registered">{data.operator.vatRegistered ? "Yes" : "No"}</Row>
        <Row label="VAT number">
          {data.operator.vatNumberSet ? data.operator.vatNumberMasked : "Missing"}
        </Row>
        <Row label="Tax reference number">
          {data.operator.taxReferenceNumberSet
            ? data.operator.taxReferenceNumberMasked
            : "Missing"}
        </Row>
        <Row label="VAT treatment">{data.settings.vatTreatment}</Row>
        <Row label="Stripe processing fees">Paid by Rovaro</Row>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Rovaro booking fee
        </Typography>
        <Row label="Platform default">
          {data.marketplaceBookingFee?.percentLabel
            ? `${data.marketplaceBookingFee.percentLabel}%`
            : "10%"}
        </Row>
        <Typography variant="caption" color="text.secondary">
          Change the default under Settings. Partner overrides stay on each partner.
        </Typography>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Commercial settings
        </Typography>
        {data.missingCommercial.length ? (
          <Alert severity="info" sx={{ mb: 1 }}>
            Not configured: {data.missingCommercial.join(", ")}. Documents refer
            to the fee schedule instead of stating a number.
          </Alert>
        ) : null}
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {[
            ["supplierCancellationServiceCharge", "Supplier cancellation charge"],
            ["replacementCostDifferenceCap", "Replacement cost cap"],
          ].map(([key, label]) => (
            <TextField
              key={key}
              size="small"
              label={label}
              value={draft[key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              placeholder="not set"
              sx={{ width: 230 }}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Operational deadlines
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {[
            ["standardRequestResponseHours", "Standard response (h)"],
            ["urgentRequestResponseMinutes", "Urgent response (min)"],
            ["paymentLinkExpirationMinutes", "Payment link (min)"],
            ["replacementNotificationHours", "Replacement notice (h)"],
            ["partnerComplaintResponseHours", "Partner complaint (h)"],
            ["documentRetentionDays", "Document retention (days)"],
          ].map(([key, label]) => (
            <TextField
              key={key}
              size="small"
              label={label}
              value={draft[key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              sx={{ width: 230 }}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Driving licence deletion job
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1, color: "text.secondary", fontSize: "0.82rem" }}
        >
          Runs nightly and erases driving licence images once the retention
          period above has elapsed. These two values only tune how much work one
          run does.
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {[
            ["documentRetentionBatchSize", "Orders per page"],
            ["documentRetentionMaxBatches", "Pages per run"],
          ].map(([key, label]) => (
            <TextField
              key={key}
              size="small"
              label={label}
              value={draft[key] ?? ""}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              sx={{ width: 230 }}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Button variant="contained" onClick={save} disabled={saving}>
          Save settings
        </Button>
      </Box>
    </Stack>
  );
}

function AuditTab() {
  const [orderId, setOrderId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(
        `/api/admin/legal/booking-audit/${encodeURIComponent(orderId.trim())}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Not found");
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label="Order ID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          sx={{ width: 340 }}
        />
        <Button variant="contained" onClick={load} disabled={!orderId || loading}>
          Load
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <CircularProgress size={22} /> : null}

      {data ? (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Read-only. Confirmed booking snapshots are immutable — they cannot
            be edited from here or anywhere else.
          </Alert>
          {data.marketplacePayment?.invalidation ? (
            <Alert
              severity={
                data.marketplacePayment.invalidation.pending ? "warning" : "info"
              }
              sx={{ mb: 2 }}
            >
              Checkout invalidation:{" "}
              {data.marketplacePayment.invalidation.pending
                ? "pending retry"
                : "idle"}
              {" · "}
              session:{" "}
              {data.marketplacePayment.invalidation.sessionType ===
              "alternative_offer"
                ? "alternative offer"
                : "normal booking"}
              {" · "}
              attempts: {data.marketplacePayment.invalidation.attemptCount || 0}
              {" · "}
              last error:{" "}
              {data.marketplacePayment.invalidation.lastErrorCategory || "—"}
              {" · "}
              last attempt:{" "}
              {data.marketplacePayment.invalidation.lastAttemptAt
                ? String(data.marketplacePayment.invalidation.lastAttemptAt)
                : "—"}
            </Alert>
          ) : null}
          <pre
            style={{
              fontSize: "0.72rem",
              background: "#fafafa",
              padding: 12,
              borderRadius: 6,
              overflowX: "auto",
              maxHeight: 600,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </Box>
      ) : null}
    </Stack>
  );
}

export default function LegalHubSection({ embedded = false } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionKey = embedded ? "section" : "tab";
  const requested = searchParams.get(sectionKey);
  const tab = TAB_KEYS.includes(requested) ? requested : "documents";

  function setTab(value) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(sectionKey, value);
    params.delete("companyId");
    if (embedded) {
      params.set("tab", "legal");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    router.replace(`/admin/legal?${params.toString()}`, { scroll: false });
  }

  return (
    <Box
      sx={{
        maxWidth: embedded ? "100%" : 1080,
        mx: embedded ? 0 : "auto",
        p: embedded ? 0 : { xs: 2, md: 3 },
      }}
    >
      {embedded ? null : (
        <>
          <Typography
            variant="h5"
            sx={{ fontSize: "1.35rem", fontWeight: 800, mb: 0.75 }}
          >
            {t("admin.legalHub.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("admin.legalHub.subtitle")}
          </Typography>
        </>
      )}

      <Tabs
        value={tab}
        onChange={(_e, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: "1px solid #eceff1" }}
      >
        {TAB_KEYS.map((key) => (
          <Tab key={key} value={key} label={t(TAB_LABEL_KEYS[key])} />
        ))}
      </Tabs>

      {tab === "documents" ? <DocumentsTab /> : null}
      {tab === "settings" ? <ConfigTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}
    </Box>
  );
}
