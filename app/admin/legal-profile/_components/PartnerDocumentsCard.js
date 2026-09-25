"use client";

import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
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
 * Supporting evidence — uploaded files first; empty optional kinds stay in a
 * compact “Add document” picker instead of a long wall of empty rows.
 */
export default function PartnerDocumentsCard({
  documents,
  editable,
  onChanged,
  companyId,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [busyKind, setBusyKind] = useState("");
  const [error, setError] = useState("");
  const [addKind, setAddKind] = useState("");

  const byKind = useMemo(() => {
    const map = new Map();
    for (const doc of documents || []) {
      if (doc?.kind && (doc.storageRef || doc.uploadedAt || doc.label)) {
        map.set(doc.kind, doc);
      }
    }
    return map;
  }, [documents]);

  const uploadedRows = useMemo(
    () => PARTNER_DOCUMENT_ROWS.filter(({ kind }) => byKind.has(kind)),
    [byKind]
  );

  const missingRows = useMemo(
    () => PARTNER_DOCUMENT_ROWS.filter(({ kind }) => !byKind.has(kind)),
    [byKind]
  );

  const requiredMissing = useMemo(
    () => missingRows.filter((row) => row.required),
    [missingRows]
  );

  const optionalMissing = useMemo(
    () => missingRows.filter((row) => !row.required),
    [missingRows]
  );

  async function upload(kind, file) {
    if (!file || !kind) return;
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
      setAddKind("");
      await onChanged?.();
      window.dispatchEvent(new Event("rovaro-inbox-refresh"));
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
    const tab = window.open("about:blank", "_blank");
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
      let href = match.url;
      if (match.resourceType === "raw") {
        const fileRes = await fetch(match.url);
        if (!fileRes.ok) {
          throw new Error(t("partnerLegal.documents.viewFailed"));
        }
        const bytes = await fileRes.blob();
        href = URL.createObjectURL(
          new Blob([bytes], { type: "application/pdf" })
        );
      }
      if (tab) {
        tab.location.href = href;
        tab.opener = null;
      } else {
        window.location.assign(href);
      }
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setBusyKind("");
    }
  }

  function startAttach(kind) {
    setAddKind(kind);
    // Defer so the controlled Select updates before the picker opens.
    requestAnimationFrame(() => fileInputRef.current?.click());
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

      <input
        hidden
        type="file"
        accept={ACCEPT}
        ref={fileInputRef}
        onChange={(event) => {
          const file = event.target.files?.[0];
          const kind = addKind;
          event.target.value = "";
          if (file && kind) upload(kind, file);
        }}
      />

      {uploadedRows.length === 0 && !editable ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("partnerLegal.documents.emptyLocked", {
            defaultValue: "No documents attached yet.",
          })}
        </Typography>
      ) : null}

      {uploadedRows.length > 0 ? (
        <Stack
          spacing={0}
          divider={<Box sx={{ borderBottom: "1px solid #f0f0f0" }} />}
          sx={{ mb: editable && missingRows.length ? 2.5 : 0 }}
        >
          {uploadedRows.map(({ kind, required }) => {
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
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
                      {t(`partnerLegal.documents.kinds.${kind}`)}
                    </Typography>
                    {required ? (
                      <Chip
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={t("partnerLegal.form.required")}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      color={stored.accepted ? "success" : "info"}
                      label={
                        stored.accepted
                          ? t("partnerLegal.documents.accepted")
                          : t("partnerLegal.documents.pendingReview")
                      }
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t("partnerLegal.documents.uploadedOn", {
                      date: formatUtc(stored.uploadedAt),
                    })}
                  </Typography>
                  {stored?.note ? (
                    <Typography
                      variant="caption"
                      display="block"
                      color="warning.main"
                    >
                      {stored.note}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {busy ? <CircularProgress size={18} /> : null}
                  <Button size="small" onClick={() => view(kind)} disabled={busy}>
                    {t("partnerLegal.documents.view")}
                  </Button>
                  {editable ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={busy}
                        onClick={() => startAttach(kind)}
                      >
                        {t("partnerLegal.documents.replace")}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => remove(kind)}
                      >
                        {t("partnerLegal.documents.remove")}
                      </Button>
                    </>
                  ) : null}
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      ) : null}

      {editable && requiredMissing.length > 0 ? (
        <Box sx={{ mb: 2.5 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 1 }}
          >
            {t("partnerLegal.documents.requiredTitle", {
              defaultValue: "Required",
            })}
          </Typography>
          <Stack spacing={1}>
            {requiredMissing.map(({ kind }) => {
              const busy = busyKind === kind;
              return (
                <Stack
                  key={kind}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                  sx={{
                    py: 1.25,
                    px: 1.5,
                    border: "1px solid",
                    borderColor: "warning.light",
                    borderRadius: 1,
                    bgcolor: "warning.lighter",
                  }}
                >
                  <Typography sx={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    {t(`partnerLegal.documents.kinds.${kind}`)}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={
                      busy ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : (
                        <UploadFileIcon fontSize="small" />
                      )
                    }
                    disabled={busy}
                    onClick={() => startAttach(kind)}
                    sx={{ textTransform: "none" }}
                  >
                    {t("partnerLegal.documents.attach", {
                      defaultValue: "Attach file",
                    })}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {editable && optionalMissing.length > 0 ? (
        <Box
          sx={{
            p: 2,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "grey.50",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t("partnerLegal.documents.addTitle", {
              defaultValue: "Add a document",
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("partnerLegal.documents.addHint", {
              defaultValue:
                "Nothing here is required. Pick a type and attach a PDF or image if you have it.",
            })}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
          >
            <FormControl size="small" sx={{ minWidth: { sm: 280 }, flex: 1 }}>
              <InputLabel id="partner-doc-add-label">
                {t("partnerLegal.documents.chooseType", {
                  defaultValue: "Document type",
                })}
              </InputLabel>
              <Select
                labelId="partner-doc-add-label"
                label={t("partnerLegal.documents.chooseType", {
                  defaultValue: "Document type",
                })}
                value={
                  optionalMissing.some((row) => row.kind === addKind)
                    ? addKind
                    : ""
                }
                onChange={(event) => setAddKind(event.target.value)}
              >
                {optionalMissing.map(({ kind }) => (
                  <MenuItem key={kind} value={kind}>
                    {t(`partnerLegal.documents.kinds.${kind}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={
                busyKind && addKind === busyKind ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <UploadFileIcon />
                )
              }
              disabled={!addKind || Boolean(busyKind)}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              {t("partnerLegal.documents.attach", {
                defaultValue: "Attach file",
              })}
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!editable ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, display: "block" }}
        >
          {t("partnerLegal.documents.locked")}
        </Typography>
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 2, display: "block" }}
        >
          {t("partnerLegal.documents.formats")}
        </Typography>
      )}
    </Paper>
  );
}
