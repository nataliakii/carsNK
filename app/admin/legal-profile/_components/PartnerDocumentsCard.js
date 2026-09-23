"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { PARTNER_DOCUMENT_ALLOWED_TYPES } from "@/domain/legal/partnerDocuments";

import { PARTNER_DOCUMENT_ROWS } from "./partnerLegalFields";

const ACCEPT = PARTNER_DOCUMENT_ALLOWED_TYPES.join(",");

function formatUtc(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Empty or non-JSON bodies (Next compile 500, timeouts) must not throw. */
async function readJsonBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function failureMessage(json, fallback) {
  if (typeof json?.message === "string" && json.message.trim()) return json.message;
  if (typeof json?.error === "string" && json.error.trim()) return json.error;
  return fallback;
}

/**
 * Supporting evidence.
 *
 * Files go to `/api/partner/legal/documents`, which is session-gated and
 * scopes the company from the session. Nothing here ever holds a permanent
 * URL: viewing asks the same route for a signed link that expires in
 * minutes, matching how customer driving licences are handled.
 */
export default function PartnerDocumentsCard({
  documents,
  editable,
  onChanged,
  companyId,
}) {
  const { t } = useTranslation();
  const inputRefs = useRef({});
  const [busyKind, setBusyKind] = useState("");
  const [error, setError] = useState("");

  const byKind = new Map(
    (documents || [])
      .filter((doc) => doc?.kind && (doc.storageRef || doc.uploadedAt || doc.label))
      .map((doc) => [doc.kind, doc])
  );

  async function upload(kind, file) {
    if (!file) return;
    setBusyKind(kind);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      body.append("label", file.name || "");
      const res = await fetch("/api/partner/legal/documents", {
        method: "POST",
        body,
      });
      const json = await readJsonBody(res);
      if (!res.ok || !json.success) {
        throw new Error(
          failureMessage(json, t("partnerLegal.documents.uploadFailed"))
        );
      }
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  async function remove(kind) {
    setBusyKind(kind);
    setError("");
    try {
      const res = await fetch(
        `/api/partner/legal/documents?kind=${encodeURIComponent(kind)}`,
        { method: "DELETE" }
      );
      const json = await readJsonBody(res);
      if (!res.ok || !json.success) {
        throw new Error(
          failureMessage(json, t("partnerLegal.documents.removeFailed"))
        );
      }
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  async function view(kind) {
    setBusyKind(kind);
    setError("");
    try {
      const qs = companyId
        ? `?companyId=${encodeURIComponent(companyId)}`
        : "";
      const res = await fetch(`/api/partner/legal/documents${qs}`, {
        cache: "no-store",
      });
      const json = await readJsonBody(res);
      if (!res.ok || !json.success) {
        throw new Error(
          failureMessage(json, t("partnerLegal.documents.viewFailed"))
        );
      }
      const match = (json.documents || []).find((doc) => doc.kind === kind);
      if (!match?.url) throw new Error(t("partnerLegal.documents.viewFailed"));
      window.open(match.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
      <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700 }}>
        {t("partnerLegal.documents.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("partnerLegal.documents.subtitle")}
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      <Stack divider={<Box sx={{ borderBottom: "1px solid #f0f0f0" }} />}>
        {PARTNER_DOCUMENT_ROWS.map(({ kind, required }) => {
          const stored = byKind.get(kind);
          const busy = busyKind === kind;
          return (
            <Stack
              key={kind}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
              sx={{ py: 1.25 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {t(`partnerLegal.documents.kinds.${kind}`)}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={required ? "warning" : "default"}
                    label={
                      required
                        ? t("partnerLegal.form.required")
                        : t("partnerLegal.form.optional")
                    }
                  />
                  {stored ? (
                    <Chip
                      size="small"
                      color={stored.accepted ? "success" : "info"}
                      label={
                        stored.accepted
                          ? t("partnerLegal.documents.accepted")
                          : t("partnerLegal.documents.pendingReview")
                      }
                    />
                  ) : null}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {stored
                    ? t("partnerLegal.documents.uploadedOn", {
                        date: formatUtc(stored.uploadedAt),
                      })
                    : t("partnerLegal.documents.notUploaded")}
                </Typography>
                {stored?.note ? (
                  <Typography variant="caption" display="block" color="warning.main">
                    {stored.note}
                  </Typography>
                ) : null}
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                {busy ? <CircularProgress size={18} /> : null}
                {stored ? (
                  <Button size="small" onClick={() => view(kind)} disabled={busy}>
                    {t("partnerLegal.documents.view")}
                  </Button>
                ) : null}
                {editable ? (
                  <>
                    <input
                      hidden
                      type="file"
                      accept={ACCEPT}
                      ref={(el) => {
                        inputRefs.current[kind] = el;
                      }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        upload(kind, file);
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={() => inputRefs.current[kind]?.click()}
                    >
                      {stored
                        ? t("partnerLegal.documents.replace")
                        : t("partnerLegal.documents.upload")}
                    </Button>
                    {stored ? (
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => remove(kind)}
                      >
                        {t("partnerLegal.documents.remove")}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </Stack>
          );
        })}
      </Stack>

      {!editable ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          {t("partnerLegal.documents.locked")}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
          {t("partnerLegal.documents.formats")}
        </Typography>
      )}
    </Paper>
  );
}
