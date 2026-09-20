"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

/**
 * Superadmin legal hub.
 *
 * Three areas: the operator's own legal configuration (including what is
 * still missing), the partner agreement register, and a per-booking legal
 * audit. Missing values are surfaced here and only here.
 */

const TABS = [
  { key: "config", label: "Legal configuration" },
  { key: "partners", label: "Partner agreements" },
  { key: "audit", label: "Booking legal audit" },
];

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
        commissionPercent: json.settings.commissionPercent ?? "",
        minimumCommissionAmount: json.settings.minimumCommissionAmount ?? "",
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

  async function documentAction(payload) {
    setSaving(true);
    try {
      await fetch("/api/admin/legal/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await load();
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
        <Row label="VAT treatment of commission">{data.settings.vatTreatment}</Row>
        <Row label="Payment processing fees">{data.settings.paymentFeeBearer}</Row>
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
            ["commissionPercent", "Commission %"],
            ["minimumCommissionAmount", "Minimum commission"],
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

      <Divider />

      <Box>
        <Typography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
          Document versions
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => documentAction({ action: "seed" })}
          disabled={saving}
          sx={{ mb: 2 }}
        >
          Load built-in drafts
        </Button>
        {data.documents.map((entry) => (
          <Box key={entry.documentType} sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
              rovaro-{entry.documentType}
            </Typography>
            {["en", "es"].map((lang) => {
              const info = entry.languages[lang];
              return (
                <Stack
                  key={lang}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{ py: 0.4, fontSize: "0.82rem" }}
                >
                  <Chip size="small" label={lang.toUpperCase()} />
                  <span>
                    {info.published
                      ? `published v${info.published.version}`
                      : `${info.latestStatus}${
                          info.latestVersion ? ` v${info.latestVersion}` : ""
                        }`}
                  </span>
                  {info.published ? (
                    <code style={{ fontSize: "0.7rem", color: "#90a4ae" }}>
                      {info.published.checksum.slice(0, 12)}…
                    </code>
                  ) : null}
                  {info.latestVersion && !info.published ? (
                    <Button
                      size="small"
                      onClick={() =>
                        documentAction({
                          action: "publish",
                          documentType: entry.documentType,
                          language: lang,
                          version: info.latestVersion,
                        })
                      }
                      disabled={saving}
                    >
                      Publish
                    </Button>
                  ) : null}
                  {info.published ? (
                    <Button
                      size="small"
                      color="warning"
                      onClick={() =>
                        documentAction({
                          action: "archive",
                          documentType: entry.documentType,
                          language: lang,
                          version: info.published.version,
                        })
                      }
                      disabled={saving}
                    >
                      Archive
                    </Button>
                  ) : null}
                </Stack>
              );
            })}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

function PartnersTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/legal/partners", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message || "Failed to load");
        setRows(json.partners);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return <CircularProgress size={22} />;
  if (!rows.length) return <Alert severity="info">No partners yet.</Alert>;

  return (
    <Stack spacing={2}>
      {rows.map((row) => (
        <Box
          key={row.companyId}
          sx={{ p: 2, border: "1px solid #eceff1", borderRadius: 2 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>{row.companyName}</Typography>
            <Chip
              size="small"
              label={row.verification?.status || "NO PROFILE"}
              color={
                row.verification?.status === "VERIFIED" ? "success" : "default"
              }
            />
            {row.agreement ? (
              <Chip size="small" color="primary" label="Agreement signed" />
            ) : (
              <Chip size="small" label="Not signed" />
            )}
          </Stack>

          {row.verification ? (
            <>
              <Row label="Legal name">{row.verification.legalName || "—"}</Row>
              <Row label="Registration / NIF-CIF">
                {[row.verification.registrationNumber, row.verification.nifCif]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Row>
              {!row.verification.completeness.ready ? (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Incomplete:{" "}
                  {[
                    ...row.verification.completeness.missingFields,
                    ...row.verification.completeness.missingDocuments,
                  ].join(", ")}
                </Alert>
              ) : null}
            </>
          ) : (
            <Alert severity="info">
              This partner has not started the legal onboarding yet.
            </Alert>
          )}

          {row.agreement ? (
            <Box sx={{ mt: 1 }}>
              <Row label="Agreement">{row.agreement.agreementId}</Row>
              <Row label="Signer">
                {row.agreement.signerName} · {row.agreement.signerRole}
              </Row>
              <Row label="Accepted at">
                {new Date(row.agreement.acceptedAt).toISOString()}
              </Row>
              <Row label="Method">{row.agreement.acceptanceMethod}</Row>
              <Row label="Package checksum">
                <code style={{ fontSize: "0.72rem" }}>
                  {row.agreement.packageChecksum}
                </code>
              </Row>
              <Row label="Documents">
                {row.agreement.documents
                  .map((d) => `${d.documentType} ${d.language} v${d.version}`)
                  .join(", ")}
              </Row>
            </Box>
          ) : null}

          {row.agreementHistory.length > 1 ? (
            <Typography sx={{ mt: 1, fontSize: "0.78rem", color: "#90a4ae" }}>
              {row.agreementHistory.length} agreement versions on record.
            </Typography>
          ) : null}
        </Box>
      ))}
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

export default function LegalHubSection() {
  const [tab, setTab] = useState("config");

  return (
    <Box sx={{ maxWidth: 1080, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontSize: "1.25rem", fontWeight: 700, mb: 2 }}>
        Legal &amp; compliance
      </Typography>

      <Tabs
        value={tab}
        onChange={(_e, value) => setTab(value)}
        sx={{ mb: 3, borderBottom: "1px solid #eceff1" }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {tab === "config" ? <ConfigTab /> : null}
      {tab === "partners" ? <PartnersTab /> : null}
      {tab === "audit" ? <AuditTab /> : null}
    </Box>
  );
}
