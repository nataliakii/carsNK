"use client";

import { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import LegalRichTextEditor from "./LegalRichTextEditor";
import { htmlToSections, markdownToHtml } from "@/domain/legal/documentMarkup";
import { PLATFORM_DOCUMENT_CATALOG } from "@/domain/legal/platformCatalog";
import { LEGAL_TRANSLATION_LANGUAGES } from "@/domain/legal/translationAdapter";

async function post(payload) {
  const res = await fetch("/api/admin/legal/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.message || "Request failed");
  return json;
}

export default function LegalDocumentWorkspace({
  document,
  documentMeta,
  mode,
  open = true,
  onClose,
}) {
  const active = documentMeta || document;
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const meta = PLATFORM_DOCUMENT_CATALOG.find((row) => row.documentType === active?.documentType);
  if (!open || !active) return null;

  async function saveDraft() {
    setError("");
    const content = htmlToSections(html, meta?.name || "Document");
    await post({
      action: "saveDraft",
      documentType: active.documentType,
      language: "en",
      content,
    });
    setMessage("Draft saved. Nothing was published.");
  }

  async function onFile(file) {
    setError("");
    const base64 = await file.arrayBuffer().then((buf) => {
      let binary = "";
      const bytes = new Uint8Array(buf);
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      return btoa(binary);
    });
    const json = await post({
      action: "importPreview",
      documentType: active.documentType,
      filename: file.name,
      base64,
    });
    setPreview(json.import);
    setMessage("Import preview only. Save the draft yourself. Nothing was published.");
  }

  async function saveImport() {
    if (!preview?.content) return;
    await post({
      action: "importSave",
      documentType: active.documentType,
      language: "en",
      content: preview.content,
      format: preview.format,
      pdf: preview.format === "pdf" ? undefined : null,
    });
    setMessage("Imported content saved as a draft.");
  }

  async function translate(language, modeName) {
    setError("");
    const json = await post({
      action: "createTranslationDraft",
      documentType: active.documentType,
      language,
      sourceLanguage: "en",
      mode: modeName,
    });
    setPreview({ content: json.document?.content, translation: json.publishable });
    setMessage(`Translation draft created for ${language}. It is not published.`);
  }

  return (
    <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ fontWeight: 800 }}>{meta?.name} — {mode}</Typography>
        <Button onClick={onClose}>Close</Button>
      </Stack>
      {error ? <Alert severity="error" sx={{ my: 1 }}>{error}</Alert> : null}
      {message ? <Alert severity="info" sx={{ my: 1 }}>{message}</Alert> : null}

      {mode === "edit" ? (
        <Stack spacing={1}>
          <LegalRichTextEditor value={null} onChange={setHtml} />
          <Button variant="contained" onClick={() => saveDraft().catch((err) => setError(err.message))}>
            Save draft
          </Button>
        </Stack>
      ) : null}

      {mode === "import" ? (
        <Stack spacing={1}>
          <Button component="label" variant="outlined">
            Upload DOCX, Markdown, text or PDF
            <input
              hidden
              type="file"
              accept=".docx,.md,.markdown,.txt,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file).catch((err) => setError(err.message));
              }}
            />
          </Button>
          {preview?.extractionNotice ? <Alert severity="warning">{preview.extractionNotice}</Alert> : null}
          {preview?.content ? (
            <Box sx={{ p: 1, bgcolor: "action.hover" }}>
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml((preview.content.sections || []).map((s) => `## ${s.heading}\n\n${s.body}`).join("\n\n")) }} />
              <Button sx={{ mt: 1 }} variant="contained" onClick={() => saveImport().catch((err) => setError(err.message))}>
                Save reviewed draft
              </Button>
            </Box>
          ) : null}
        </Stack>
      ) : null}

      {mode === "translations" ? (
        <Stack spacing={1}>
          {LEGAL_TRANSLATION_LANGUAGES.filter((language) => language !== "en").map((language) => (
            <Stack key={language} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ width: 40 }}>{language}</Typography>
              <Button size="small" onClick={() => translate(language, "missing").catch((err) => setError(err.message))}>
                Create missing translations
              </Button>
              <Button size="small" onClick={() => translate(language, "outdated").catch((err) => setError(err.message))}>
                Regenerate outdated translation
              </Button>
              <Button size="small" onClick={() => translate(language, "sections").catch((err) => setError(err.message))}>
                Regenerate changed sections
              </Button>
            </Stack>
          ))}
          <Typography variant="caption">Statuses: Missing, Draft translation, Outdated, Ready for review, Published. Publishing stays on the document card.</Typography>
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
