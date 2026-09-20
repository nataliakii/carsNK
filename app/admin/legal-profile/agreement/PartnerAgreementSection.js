"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

import { PARTNER_GATE_STEP } from "@/domain/legal/partnerGate";

import PartnerComplianceGate from "../_components/PartnerComplianceGate";

function formatUtcDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function formatUtcDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Self-contained copy of what was signed, built from the stored snapshot so
 * the downloaded file contains the same text, versions and checksums as the
 * immutable record rather than a fresh render of the current documents.
 */
function buildSnapshotHtml(agreement, labels) {
  const documents = (agreement.documents || [])
    .map(
      (doc) => `
    <section>
      <h2>${escapeHtml(doc.renderedTitle || doc.documentType)}</h2>
      <p class="meta">${escapeHtml(doc.documentType)} · ${escapeHtml(
        doc.language
      )} · v${escapeHtml(doc.version)} · ${escapeHtml(doc.checksum)}</p>
      ${(doc.renderedSections || [])
        .map(
          (section) => `<article>${
            section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ""
          }<div>${escapeHtml(section.text)}</div></article>`
        )
        .join("")}
    </section>`
    )
    .join("");

  const operator = agreement.operatorSnapshot || {};

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(
    agreement.agreementId
  )}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:820px;margin:0 auto;padding:32px;color:#263238;line-height:1.6}
h1{font-size:22px}h2{font-size:18px;margin-top:32px}h3{font-size:15px;margin-bottom:4px}
article div{white-space:pre-line}
.meta{color:#78909c;font-size:12px}
table{border-collapse:collapse;font-size:13px;margin:16px 0}
td{border-bottom:1px solid #eceff1;padding:4px 12px 4px 0;vertical-align:top}
td:first-child{color:#607d8b}
</style></head><body>
<h1>${escapeHtml(labels.title)}</h1>
<table>
<tr><td>${escapeHtml(labels.agreementId)}</td><td>${escapeHtml(
    agreement.agreementId
  )}</td></tr>
<tr><td>${escapeHtml(labels.partner)}</td><td>${escapeHtml(
    agreement.partnerLegalName
  )}</td></tr>
<tr><td>${escapeHtml(labels.signer)}</td><td>${escapeHtml(
    agreement.signerName
  )} — ${escapeHtml(agreement.signerRole)} (${escapeHtml(
    agreement.signerEmail
  )})</td></tr>
<tr><td>${escapeHtml(labels.acceptedAt)}</td><td>${escapeHtml(
    formatUtcDateTime(agreement.acceptedAt)
  )}</td></tr>
<tr><td>${escapeHtml(labels.method)}</td><td>${escapeHtml(
    agreement.acceptanceMethod
  )}</td></tr>
<tr><td>${escapeHtml(labels.checksum)}</td><td><code>${escapeHtml(
    agreement.packageChecksum
  )}</code></td></tr>
<tr><td>${escapeHtml(labels.operator)}</td><td>${escapeHtml(
    [operator.ownerLegalName, operator.tradingName, operator.countryOfEstablishment]
      .filter(Boolean)
      .join(" · ")
  )}</td></tr>
</table>
<p class="meta">${escapeHtml(agreement.authorityStatement || "")}</p>
${documents}
</body></html>`;
}

/**
 * Master Partner Agreement — reading and signing.
 *
 * The package is resolved entirely on the server: this screen cannot choose
 * a version, and the checksum it displays is the one the server will record.
 * Signer name and role are the only things the partner supplies; IP, user
 * agent, authenticated user id and the UTC timestamp are all taken from the
 * request by `/api/partner/legal/agreement`.
 */
export default function PartnerAgreementSection() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();

  const [data, setData] = useState(null);
  const [gate, setGate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [hasRead, setHasRead] = useState(false);

  const [snapshot, setSnapshot] = useState(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  const scrollRef = useRef(null);
  const language = i18n.language || "en";

  const load = useCallback(async () => {
    setError("");
    try {
      const [agreementRes, profileRes, statusRes] = await Promise.all([
        fetch(`/api/partner/legal/agreement?lang=${encodeURIComponent(language)}`, {
          cache: "no-store",
        }),
        fetch("/api/partner/legal/profile", { cache: "no-store" }),
        fetch("/api/partner/legal/status", { cache: "no-store" }),
      ]);

      const agreementJson = await agreementRes.json();
      if (!agreementJson.success) {
        throw new Error(agreementJson.message || t("partnerLegal.agreement.loadFailed"));
      }
      setData(agreementJson);

      const profileJson = await profileRes.json();
      if (profileJson.success && profileJson.profile) {
        setSignerName((prev) => prev || profileJson.profile.signatoryName || "");
        setSignerRole((prev) => prev || profileJson.profile.signatoryRole || "");
      }

      const statusJson = await statusRes.json();
      setGate(statusJson.success ? statusJson.gate : null);
    } catch (err) {
      setError(err.message || t("partnerLegal.agreement.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    load();
  }, [load]);

  // A package short enough to fit without scrolling still counts as read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || hasRead) return;
    if (el.scrollHeight <= el.clientHeight + 8) setHasRead(true);
  }, [data, hasRead]);

  function onScroll(event) {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setHasRead(true);
  }

  const active = data?.activeAgreement || null;
  const signedCurrentVersion =
    Boolean(active) && active.packageChecksum === data?.packageChecksum;
  const needsReacceptance = Boolean(active) && !signedCurrentVersion;

  // Anything the gate reports that is not about the agreement itself has to
  // be cleared first — the accept endpoint refuses an unverified partner.
  const verificationBlockers = (gate?.blockers || []).filter(
    (blocker) => blocker.step !== PARTNER_GATE_STEP.AGREEMENT
  );
  const signingBlocked =
    !data ||
    data.containsDrafts ||
    signedCurrentVersion ||
    verificationBlockers.length > 0;

  const canSubmit =
    !signingBlocked &&
    hasRead &&
    authorityConfirmed &&
    accepted &&
    signerName.trim() &&
    signerRole.trim() &&
    !submitting;

  async function submit() {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/partner/legal/agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          signerName: signerName.trim(),
          signerRole: signerRole.trim(),
          signerEmail: session?.user?.email || "",
          confirmationOfAuthority: authorityConfirmed,
          acceptedCheckbox: accepted,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || t("partnerLegal.agreement.submitFailed"));
      }
      setNotice(t("partnerLegal.agreement.submitted", { id: json.agreementId }));
      setAccepted(false);
      setAuthorityConfirmed(false);
      setSnapshot(null);
      await load();
    } catch (err) {
      setError(err.message || t("partnerLegal.agreement.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const loadSnapshot = useCallback(async () => {
    if (!active) return null;
    if (snapshot?.agreementId === active.agreementId) return snapshot;
    setSnapshotBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/partner/legal/agreement/${encodeURIComponent(active.agreementId)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || t("partnerLegal.agreement.snapshotFailed"));
      }
      setSnapshot(json.agreement);
      return json.agreement;
    } catch (err) {
      setError(err.message || t("partnerLegal.agreement.snapshotFailed"));
      return null;
    } finally {
      setSnapshotBusy(false);
    }
  }, [active, snapshot, t]);

  async function download() {
    const loaded = await loadSnapshot();
    if (!loaded) return;
    const html = buildSnapshotHtml(loaded, {
      title: t("partnerLegal.agreement.snapshotTitle"),
      agreementId: t("partnerLegal.agreement.agreementId"),
      partner: t("partnerLegal.agreement.partner"),
      signer: t("partnerLegal.agreement.signer"),
      acceptedAt: t("partnerLegal.agreement.acceptedAt"),
      method: t("partnerLegal.agreement.method"),
      checksum: t("partnerLegal.agreement.checksum"),
      operator: t("partnerLegal.agreement.operator"),
    });
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${loaded.agreementId}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: { xs: 1, md: 2 },
        pb: 6,
        pt: { xs: 2, md: 2 },
        maxWidth: { xs: "100%", md: 960 },
        mx: "auto",
        overflowX: "hidden",
      }}
    >
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
        {t("partnerLegal.agreement.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("partnerLegal.agreement.subtitle")}
      </Typography>

      <PartnerComplianceGate gate={gate} />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}

      {data?.containsDrafts ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{t("partnerLegal.agreement.draftTitle")}</AlertTitle>
          {t("partnerLegal.agreement.draftBody")}
        </Alert>
      ) : null}

      {active ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip
              size="small"
              color={signedCurrentVersion ? "success" : "warning"}
              label={
                signedCurrentVersion
                  ? t("partnerLegal.agreement.signedCurrent")
                  : t("partnerLegal.agreement.signedOutdated")
              }
            />
            <Typography sx={{ fontWeight: 700 }}>
              {t("partnerLegal.agreement.signedTitle")}
            </Typography>
          </Stack>

          <Stack spacing={0.5} sx={{ fontSize: "0.88rem" }}>
            <Typography variant="body2">
              {t("partnerLegal.agreement.agreementId")}: {active.agreementId}
            </Typography>
            <Typography variant="body2">
              {t("partnerLegal.agreement.acceptedAt")}:{" "}
              {formatUtcDateTime(active.acceptedAt)}
            </Typography>
            <Typography variant="body2">
              {t("partnerLegal.agreement.signer")}: {active.signerName} —{" "}
              {active.signerRole}
            </Typography>
            <Typography variant="body2">
              {t("partnerLegal.agreement.method")}: {active.acceptanceMethod}
            </Typography>
            <Typography variant="body2">
              {t("partnerLegal.agreement.acceptedVersions")}:{" "}
              {(active.documents || [])
                .map((d) => `${d.documentType} ${d.language} v${d.version}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {t("partnerLegal.agreement.checksum")}:{" "}
              <code>{active.packageChecksum}</code>
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              disabled={snapshotBusy}
              onClick={loadSnapshot}
            >
              {t("partnerLegal.agreement.viewSnapshot")}
            </Button>
            <Button size="small" disabled={snapshotBusy} onClick={download}>
              {t("partnerLegal.agreement.downloadSnapshot")}
            </Button>
            {snapshotBusy ? <CircularProgress size={18} /> : null}
          </Stack>

          {snapshot ? (
            <Box
              sx={{
                mt: 2,
                p: 2,
                maxHeight: 420,
                overflowY: "auto",
                bgcolor: "#fafafa",
                borderRadius: 1,
              }}
            >
              {(snapshot.documents || []).map((doc) => (
                <Box key={`${doc.documentType}-${doc.language}-${doc.version}`} sx={{ mb: 3 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {doc.renderedTitle || doc.documentType}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    v{doc.version} · {doc.language.toUpperCase()} · {doc.checksum}
                  </Typography>
                  {(doc.renderedSections || []).map((section) => (
                    <Box key={section.id} sx={{ mt: 1.5 }}>
                      {section.heading ? (
                        <Typography sx={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {section.heading}
                        </Typography>
                      ) : null}
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-line", color: "#37474f" }}
                      >
                        {section.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          ) : null}
        </Paper>
      ) : null}

      {needsReacceptance ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>{t("partnerLegal.agreement.newVersionTitle")}</AlertTitle>
          {t("partnerLegal.agreement.newVersionBody")}
        </Alert>
      ) : null}

      {signedCurrentVersion ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("partnerLegal.agreement.alreadySigned")}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700, mb: 1 }}>
          {t("partnerLegal.agreement.packageTitle")}
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
          {(data?.documents || []).map((doc) => (
            <Chip
              key={doc.ref}
              size="small"
              variant="outlined"
              label={`${t(`partnerLegal.agreement.documentTypes.${doc.documentType}`, {
                defaultValue: doc.documentType,
              })} · v${doc.version}${
                doc.effectiveFrom
                  ? ` · ${t("partnerLegal.agreement.effectiveFrom")} ${formatUtcDate(
                      doc.effectiveFrom
                    )}`
                  : ""
              }`}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          {t("partnerLegal.agreement.checksum")}: <code>{data?.packageChecksum}</code>
        </Typography>

        <Box
          ref={scrollRef}
          onScroll={onScroll}
          sx={{
            mt: 2,
            p: 2,
            maxHeight: 520,
            overflowY: "auto",
            border: "1px solid #eceff1",
            borderRadius: 1,
            bgcolor: "#fff",
          }}
        >
          {(data?.documents || []).map((doc) => (
            <Box key={doc.ref} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
                {doc.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("partnerLegal.agreement.versionLine", {
                  version: doc.version,
                  language: doc.language.toUpperCase(),
                })}
                {doc.effectiveFrom
                  ? ` · ${t("partnerLegal.agreement.effectiveFrom")} ${formatUtcDate(
                      doc.effectiveFrom
                    )}`
                  : ""}
                {doc.status === "draft"
                  ? ` · ${t("partnerLegal.agreement.draftLabel")}`
                  : ""}
              </Typography>
              <Divider sx={{ my: 1 }} />
              {(doc.sections || []).map((section) => (
                <Box key={section.id} sx={{ mb: 2 }}>
                  {section.heading ? (
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", mb: 0.5 }}>
                      {section.heading}
                    </Typography>
                  ) : null}
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-line", lineHeight: 1.7, color: "#37474f" }}
                  >
                    {section.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>

        <Alert severity={hasRead ? "success" : "info"} sx={{ mt: 2 }}>
          {hasRead
            ? t("partnerLegal.agreement.readConfirmed")
            : t("partnerLegal.agreement.scrollToEnd")}
        </Alert>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
        <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700, mb: 2 }}>
          {t("partnerLegal.agreement.signTitle")}
        </Typography>

        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 1 }}>
          <TextField
            size="small"
            required
            label={t("partnerLegal.agreement.signerName")}
            value={signerName}
            disabled={signingBlocked}
            onChange={(event) => setSignerName(event.target.value)}
            sx={{ width: 280 }}
          />
          <TextField
            size="small"
            required
            label={t("partnerLegal.agreement.signerRole")}
            value={signerRole}
            disabled={signingBlocked}
            onChange={(event) => setSignerRole(event.target.value)}
            sx={{ width: 280 }}
          />
          <TextField
            size="small"
            label={t("partnerLegal.agreement.signerEmail")}
            value={session?.user?.email || ""}
            helperText={t("partnerLegal.agreement.signerEmailHint")}
            disabled
            sx={{ width: 280 }}
          />
        </Stack>

        <FormControlLabel
          control={
            <Checkbox
              checked={authorityConfirmed}
              disabled={signingBlocked || !hasRead}
              onChange={(event) => setAuthorityConfirmed(event.target.checked)}
            />
          }
          label={t("partnerLegal.agreement.authorityCheckbox")}
        />
        <FormControlLabel
          sx={{ alignItems: "flex-start", mt: 1 }}
          control={
            <Checkbox
              checked={accepted}
              disabled={signingBlocked || !hasRead}
              onChange={(event) => setAccepted(event.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              {data?.acceptanceStatement || t("partnerLegal.agreement.acceptanceFallback")}
            </Typography>
          }
        />

        <Alert severity="info" sx={{ mt: 2 }}>
          <AlertTitle>{t("partnerLegal.agreement.recordedTitle")}</AlertTitle>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
            {t("partnerLegal.agreement.recordedBody")}
          </Typography>
        </Alert>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
          <Button variant="contained" disabled={!canSubmit} onClick={submit}>
            {submitting
              ? t("partnerLegal.agreement.accepting")
              : needsReacceptance
                ? t("partnerLegal.agreement.acceptNewVersion")
                : t("partnerLegal.agreement.accept")}
          </Button>
          <Button component={Link} href="/admin/legal-profile" color="secondary">
            {t("partnerLegal.agreement.backToProfile")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
