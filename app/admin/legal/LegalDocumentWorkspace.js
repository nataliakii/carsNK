"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import LegalRichTextEditor from "./LegalRichTextEditor";
import { htmlToSections, markdownToHtml } from "@/domain/legal/documentMarkup";
import { PLATFORM_DOCUMENT_CATALOG } from "@/domain/legal/platformCatalog";
import { LEGAL_TRANSLATION_LANGUAGES } from "@/domain/legal/translationAdapter";
import {
  livePathForDocument,
  nextImportDraftVersion,
} from "@/domain/legal/documentCardStatus";

const IMPORT_STATES = {
  idle: "idle",
  uploading: "Uploading…",
  reading: "Reading document…",
  ready: "Import preview — not saved yet",
  failed: "Import failed",
  saved: "Draft saved",
  published: "Published",
};

async function post(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch("/api/admin/legal/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      const err = new Error(json.message || `Request failed (${res.status})`);
      err.code = json.code || String(res.status);
      err.status = res.status;
      throw err;
    }
    return json;
  } catch (err) {
    if (err?.name === "AbortError") {
      const timeoutErr = new Error("Server timeout while processing the file");
      timeoutErr.code = "timeout";
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function fileToBase64(file) {
  return file.arrayBuffer().then((buf) => {
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  });
}

function formatBytes(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sectionsPreviewHtml(content) {
  const sections = content?.sections || [];
  if (!sections.length) return "";
  const md = sections
    .map((section) => `## ${section.heading || ""}\n\n${section.body || ""}`)
    .join("\n\n");
  return markdownToHtml(md);
}

export default function LegalDocumentWorkspace({
  document,
  documentMeta,
  overviewEntry = null,
  mode,
  open = true,
  busy = false,
  onClose,
  onAction,
  onImported,
}) {
  const active = documentMeta || document;
  const rootRef = useRef(null);
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importStatus, setImportStatus] = useState(IMPORT_STATES.idle);
  const [savedDraft, setSavedDraft] = useState(null);
  const [publishedLive, setPublishedLive] = useState(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const meta = PLATFORM_DOCUMENT_CATALOG.find(
    (row) => row.documentType === active?.documentType
  );
  const livePath = livePathForDocument(active?.documentType);
  const expectedDraftVersion = nextImportDraftVersion(
    overviewEntry?.languages?.en
  );

  const dirtyPreview = Boolean(
    preview && importStatus === IMPORT_STATES.ready && !savedDraft
  );

  useEffect(() => {
    if (!open || !rootRef.current?.scrollIntoView) return;
    rootRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, mode, importStatus, savedDraft]);

  useEffect(() => {
    if (!dirtyPreview) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyPreview]);

  const sectionCount = useMemo(
    () => Number(preview?.sectionCount ?? preview?.content?.sections?.length ?? 0),
    [preview]
  );

  if (!open || !active) return null;

  function resetImport() {
    setPreview(null);
    setSelectedFile(null);
    setImportStatus(IMPORT_STATES.idle);
    setSavedDraft(null);
    setPublishedLive(null);
    setReviewMode(false);
    setError("");
    setMessage("");
  }

  function requestClose() {
    if (dirtyPreview) {
      const leave = window.confirm(
        "The imported preview has not been saved. Leave and discard it?"
      );
      if (!leave) return;
    }
    resetImport();
    onClose?.();
  }

  async function saveDraft() {
    setError("");
    const content = htmlToSections(html, meta?.name || "Document");
    const run = onAction || post;
    await run({
      action: "saveDraft",
      documentType: active.documentType,
      language: "en",
      content,
    });
    setMessage("Draft saved. Nothing was published.");
    onImported?.();
  }

  async function onFile(file) {
    setError("");
    setMessage("");
    setSavedDraft(null);
    setReviewMode(false);
    setSelectedFile({
      name: file.name,
      type: file.type || "unknown",
      size: file.size,
    });
    setImportStatus(IMPORT_STATES.uploading);
    setPreview(null);
    try {
      const lower = String(file.name || "").toLowerCase();
      const allowed = [".docx", ".md", ".markdown", ".txt", ".pdf"];
      if (!allowed.some((ext) => lower.endsWith(ext))) {
        throw Object.assign(
          new Error("Upload DOCX, Markdown, plain text or PDF"),
          { code: "unsupported" }
        );
      }
      if (file.size > 8 * 1024 * 1024) {
        throw Object.assign(new Error("The file is larger than 8 MB"), {
          code: "too_large",
        });
      }
      const base64 = await fileToBase64(file);
      setImportStatus(IMPORT_STATES.reading);
      const run = onAction || post;
      const json = await run({
        action: "importPreview",
        documentType: active.documentType,
        filename: file.name,
        base64,
        fileType: file.type || "",
        fileSize: file.size,
      });
      setPreview({
        ...json.import,
        filename: json.import?.filename || file.name,
        fileType: json.import?.fileType || file.type || "unknown",
        fileSize: json.import?.fileSize ?? file.size,
      });
      setImportStatus(IMPORT_STATES.ready);
      setMessage("");
    } catch (err) {
      setImportStatus(IMPORT_STATES.failed);
      setPreview(null);
      if (err?.status === 401 || err?.status === 403) {
        setError("Authentication or permission failed. Sign in as superadmin and try again.");
      } else {
        setError(err.message || "Import failed");
      }
    }
  }

  async function saveImport({ asPdfOriginal = false } = {}) {
    if (!preview) return;
    setError("");
    setMessage("");
    try {
      if (!asPdfOriginal && preview.format === "pdf" && preview.extractionComplete === false) {
        setError(
          "We could not reliably convert this PDF into editable text. Save the original PDF as draft, or review extracted text first."
        );
        return;
      }
      if (!asPdfOriginal && !(preview.content?.sections || []).length) {
        setError("Nothing to save — the extracted document is empty.");
        return;
      }
      const payload = {
        action: "importSave",
        documentType: active.documentType,
        language: "en",
        content: preview.content || { title: preview.filename || "PDF", sections: [] },
        format: asPdfOriginal ? "pdf" : preview.format || "sections",
        filename: preview.filename || selectedFile?.name || "",
        fileType: preview.fileType || selectedFile?.type || "",
        fileSize: preview.fileSize ?? selectedFile?.size ?? 0,
        note: `Imported from ${preview.filename || selectedFile?.name || "upload"}`,
        pdf:
          preview.format === "pdf"
            ? {
                filename: preview.filename || selectedFile?.name,
                size: preview.fileSize ?? selectedFile?.size,
                sha256: preview.pdf?.sha256 || "",
                extractionComplete: Boolean(preview.extractionComplete),
                preserved: true,
              }
            : null,
      };
      const run = onAction || post;
      const json = await run(payload);
      const version = json.document?.version;
      setSavedDraft({
        version,
        filename: preview.filename || selectedFile?.name || "",
        createdAt: json.document?.updatedAt || new Date().toISOString(),
        savedBy: json.document?.savedByEmail || "",
        publishedVersion:
          json.publishedVersion ??
          overviewEntry?.languages?.en?.published?.version ??
          null,
        content: preview.content,
      });
      setImportStatus(IMPORT_STATES.saved);
      setMessage(`Draft v${version} saved. Nothing was published.`);
      onImported?.();
    } catch (err) {
      setImportStatus(IMPORT_STATES.failed);
      setError(err.message || "Could not save draft");
    }
  }

  async function publishSavedDraft() {
    if (!savedDraft?.version) {
      setError("Save a draft before publishing.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const run = onAction || post;
      const json = await run({
        action: "publish",
        documentType: active.documentType,
        language: "en",
        version: savedDraft.version,
        changeClass: "material",
      });
      if (json.published === false && json.success === false) {
        throw new Error(json.message || "Publish failed");
      }
      setPublishedLive({
        version: json.document?.version || savedDraft.version,
        href: livePath ? `/en${livePath}` : null,
      });
      setImportStatus(IMPORT_STATES.published);
      setMessage(
        `Published v${json.document?.version || savedDraft.version}. The previous published version remains in Version history.`
      );
      setSavedDraft(null);
      onImported?.();
    } catch (err) {
      setError(err.message || "Could not publish update");
    }
  }

  async function translate(language, modeName) {
    setError("");
    const run = onAction || post;
    const json = await run({
      action: "createTranslationDraft",
      documentType: active.documentType,
      language,
      sourceLanguage: "en",
      mode: modeName,
    });
    setPreview({ content: json.document?.content, translation: json.publishable });
    setMessage(`Translation draft created for ${language}. It is not published.`);
    onImported?.();
  }

  const incompletePdf =
    preview?.format === "pdf" && preview?.extractionComplete === false;

  return (
    <Box
      ref={rootRef}
      data-testid="legal-document-workspace"
      sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontWeight: 800 }}>
          {meta?.name} — {mode}
        </Typography>
        <Button onClick={requestClose}>Close</Button>
      </Stack>
      {error ? (
        <Alert
          severity="error"
          sx={{ my: 1 }}
          action={
            mode === "import" ? (
              <Button color="inherit" size="small" onClick={resetImport}>
                Try again
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      ) : null}
      {message ? <Alert severity="success" sx={{ my: 1 }}>{message}</Alert> : null}

      {mode === "edit" ? (
        <Stack spacing={1}>
          <LegalRichTextEditor value={null} onChange={setHtml} />
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => saveDraft().catch((err) => setError(err.message))}
          >
            Save draft
          </Button>
        </Stack>
      ) : null}

      {mode === "import" ? (
        <Stack spacing={1.5} data-testid="legal-import-panel">
          <Button component="label" variant="outlined" disabled={busy}>
            Upload DOCX, Markdown, text or PDF
            <input
              hidden
              type="file"
              accept=".docx,.md,.markdown,.txt,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onFile(file);
              }}
            />
          </Button>

          {(selectedFile || preview || importStatus !== IMPORT_STATES.idle) && (
            <Box
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "background.paper",
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Import panel
              </Typography>
              <Typography variant="body2">
                Selected file: {selectedFile?.name || preview?.filename || "—"}
              </Typography>
              <Typography variant="body2">
                File type: {selectedFile?.type || preview?.fileType || "—"}
              </Typography>
              <Typography variant="body2">
                File size:{" "}
                {formatBytes(selectedFile?.size ?? preview?.fileSize ?? 0)}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Status:{" "}
                {importStatus === IMPORT_STATES.uploading ||
                importStatus === IMPORT_STATES.reading ? (
                  <CircularProgress size={12} sx={{ mx: 0.5 }} />
                ) : null}
                {importStatus}
              </Typography>
              {preview ? (
                <>
                  <Typography variant="body2">
                    Detected language: {preview.detectedLanguage || "en"}
                  </Typography>
                  <Typography variant="body2">
                    Extracted sections: {sectionCount}
                  </Typography>
                  {preview.incomplete || incompletePdf ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {preview.extractionNotice ||
                        "We could not reliably convert this PDF into editable text. You can keep it as a PDF or create the text manually."}
                    </Alert>
                  ) : null}
                </>
              ) : null}
            </Box>
          )}

          {importStatus === IMPORT_STATES.ready && preview ? (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Parsed document preview
              </Typography>
              {preview.format === "pdf" ? (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Selectable text extracted:{" "}
                  {preview.extractionComplete ? "yes" : "no / incomplete"}
                </Alert>
              ) : null}
              {sectionCount > 0 ? (
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sectionsPreviewHtml(preview.content),
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No editable text sections were extracted.
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 1 }}>
                Import preview — not saved yet. Expected draft version after save: v
                {expectedDraftVersion}. Nothing is public until you publish.
              </Typography>

              {incompletePdf ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="contained"
                    onClick={() =>
                      saveImport({ asPdfOriginal: true }).catch((err) =>
                        setError(err.message || "Could not save draft")
                      )
                    }
                  >
                    Save as draft
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!sectionCount}
                    onClick={() => setReviewMode(true)}
                  >
                    Review extracted text
                  </Button>
                  <Button variant="text" onClick={resetImport}>
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="contained"
                    onClick={() =>
                      saveImport().catch((err) =>
                        setError(err.message || "Could not save draft")
                      )
                    }
                  >
                    Save as draft
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setReviewMode(true);
                    }}
                  >
                    Edit before saving
                  </Button>
                  <Button variant="text" onClick={resetImport}>
                    Cancel import
                  </Button>
                </Stack>
              )}

              {reviewMode && !incompletePdf ? (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  <LegalRichTextEditor
                    value={preview.content}
                    onChange={(next) => {
                      setHtml(next);
                      setPreview((prev) =>
                        prev
                          ? {
                              ...prev,
                              content: htmlToSections(next, meta?.name || "Document"),
                              sectionCount: htmlToSections(
                                next,
                                meta?.name || "Document"
                              ).sections.length,
                            }
                          : prev
                      );
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={() =>
                      saveImport().catch((err) =>
                        setError(err.message || "Could not save draft")
                      )
                    }
                  >
                    Save as draft
                  </Button>
                </Stack>
              ) : null}

              {reviewMode && incompletePdf && sectionCount > 0 ? (
                <Box
                  sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  dangerouslySetInnerHTML={{
                    __html: sectionsPreviewHtml(preview.content),
                  }}
                />
              ) : null}
            </Box>
          ) : null}

          {savedDraft ? (
            <Box
              data-testid="legal-import-saved"
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "success.light",
                borderRadius: 1.5,
              }}
            >
              <Alert severity="success" sx={{ mb: 1 }}>
                Draft v{savedDraft.version} saved. It is not public yet.
              </Alert>
              <Typography variant="body2">
                LIVE:{" "}
                {savedDraft.publishedVersion
                  ? `Published English v${savedDraft.publishedVersion}`
                  : "none yet"}
              </Typography>
              <Typography variant="body2">
                UNPUBLISHED: Draft English v{savedDraft.version}
              </Typography>
              <Typography variant="body2">
                Source file: {savedDraft.filename || "—"}
              </Typography>
              <Typography variant="body2">
                Saved: {String(savedDraft.createdAt)}
              </Typography>
              <Typography variant="body2">
                Saved by: {savedDraft.savedBy || "—"}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  variant="outlined"
                  onClick={() => setReviewMode(true)}
                >
                  Edit draft
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setReviewMode(true)}
                >
                  Preview
                </Button>
                <Button
                  variant="contained"
                  onClick={() =>
                    publishSavedDraft().catch((err) =>
                      setError(err.message || "Could not publish update")
                    )
                  }
                >
                  Publish update
                </Button>
              </Stack>
              {reviewMode ? (
                <Box
                  sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  dangerouslySetInnerHTML={{
                    __html: sectionsPreviewHtml(savedDraft.content),
                  }}
                />
              ) : null}
            </Box>
          ) : null}

          {publishedLive ? (
            <Alert
              severity="success"
              data-testid="legal-import-published"
              action={
                publishedLive.href ? (
                  <Button
                    color="inherit"
                    size="small"
                    href={publishedLive.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View live page
                  </Button>
                ) : null
              }
            >
              Published v{publishedLive.version} successfully. The previous
              published version remains in Version history.
            </Alert>
          ) : null}
        </Stack>
      ) : null}

      {mode === "translations" ? (
        <Stack spacing={1}>
          {LEGAL_TRANSLATION_LANGUAGES.filter((language) => language !== "en").map(
            (language) => (
              <Stack key={language} direction="row" spacing={1} alignItems="center">
                <Typography sx={{ width: 40 }}>{language}</Typography>
                <Button
                  size="small"
                  onClick={() =>
                    translate(language, "missing").catch((err) => setError(err.message))
                  }
                >
                  Create missing translations
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    translate(language, "outdated").catch((err) => setError(err.message))
                  }
                >
                  Regenerate outdated translation
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    translate(language, "sections").catch((err) => setError(err.message))
                  }
                >
                  Regenerate changed sections
                </Button>
              </Stack>
            )
          )}
          <Typography variant="caption">
            Statuses: Missing, Draft translation, Outdated, Ready for review, Published.
            Publishing stays on the document card.
          </Typography>
        </Stack>
      ) : null}

      {mode === "preview" || mode === "history" ? (
        <Typography variant="body2" color="text.secondary">
          {mode === "history"
            ? "Version history is listed on the document card. Restoring a draft does not change accepted bookings."
            : "Open a saved draft from the card list to preview desktop and mobile rendering before you publish."}
        </Typography>
      ) : null}
    </Box>
  );
}
