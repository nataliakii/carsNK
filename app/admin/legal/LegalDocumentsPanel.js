"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import LegalRichTextEditor from "./LegalRichTextEditor";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";
import { htmlToSections, markdownToHtml, sectionsToPlain } from "@/domain/legal/documentMarkup";
import { getSeedDocument } from "@/domain/legal/documentRegistry";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import {
  ADMIN_LEGAL_LANGUAGES,
  ADMIN_LANGUAGE_LABELS,
  attentionMessage,
  canonicalPublicPath,
  customerDocumentRows,
  documentLanguageSummary,
  formatLegalPublishedDate,
  languagePublicationState,
  orderedAdminDocuments,
  partnerDocumentRows,
  summarizeAdminLanguages,
} from "@/domain/legal/legalAdminUi";
import {
  prepareLegalContentForPublish,
  selectWorkingLegalContent,
} from "@/domain/legal/workingLegalContent";

function sameLanguageSeed(documentType, lang) {
  const seeded = getSeedDocument(documentType, lang);
  return seeded?.language === lang ? seeded : null;
}

function languageName(lang) {
  return ADMIN_LANGUAGE_LABELS[lang] || String(lang || "").toUpperCase();
}

export default function LegalDocumentsPanel() {
  const [overview, setOverview] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [openType, setOpenType] = useState("");
  const [language, setLanguage] = useState("en");
  const [content, setContent] = useState({ title: "", sections: [] });
  const [html, setHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const editorRef = useRef(null);

  const summary = useMemo(
    () => summarizeAdminLanguages(overview),
    [overview]
  );
  const attention = attentionMessage(summary);
  const catalog = orderedAdminDocuments();
  const openMeta = catalog.find((row) => row.documentType === openType) || null;
  const openEntry = overview.find((row) => row.documentType === openType);
  const langInfo = openEntry?.languages?.[language];
  const langState = languagePublicationState(langInfo);
  const editorState = dirty ? { key: "unpublished_changes", label: "Unpublished changes" } : langState;
  const canPublish =
    dirty ||
    editorState.key === "unpublished_changes" ||
    editorState.key === "not_published";
  const liveUrl = openMeta ? canonicalPublicPath(openMeta.documentType, language) : "";

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/legal/config", { cache: "no-store" });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Failed to load");
    setOverview(json.documents || []);
    return json.documents || [];
  }, []);

  useEffect(() => {
    loadOverview().catch((err) => setError(err.message));
  }, [loadOverview]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function loadEditor(documentType, lang) {
    const seed = sameLanguageSeed(documentType, lang);
    const params = new URLSearchParams({
      includeContent: "1",
      documentType,
      language: lang,
    });
    const res = await fetch(`/api/admin/legal/documents?${params}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Failed to load document");
    const next = selectWorkingLegalContent(json.documents || [], seed);
    setContent(next);
    setHtml("");
    setDirty(false);
    setPreview(false);
    setSavedMessage("");
    setLoadedKey(`${documentType}:${lang}`);
  }

  async function openDocument(documentType) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    const nextOpen = openType === documentType ? "" : documentType;
    setOpenType(nextOpen);
    if (!nextOpen) return;
    setLanguage("en");
    setError("");
    try {
      await loadEditor(documentType, "en");
    } catch (err) {
      setError(err.message);
    }
  }

  async function switchLanguage(nextLang) {
    if (nextLang === language) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setLanguage(nextLang);
    if (!openType) return;
    try {
      await loadEditor(openType, nextLang);
    } catch (err) {
      setError(err.message);
    }
  }

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
        throw new Error(json.message || "Action failed");
      }
      await loadOverview();
      return json;
    } finally {
      setSaving(false);
    }
  }

  function onHtmlChange(nextHtml) {
    setHtml(nextHtml);
    setDirty(true);
    setSavedMessage("");
    setNotice("");
  }

  function flushEditorContent(title) {
    const liveHtml = editorRef.current?.getHtml?.() || html;
    if (liveHtml) {
      const next = htmlToSections(liveHtml, title);
      next.title = title;
      return { content: next, html: liveHtml };
    }
    return {
      content: { ...content, title: content.title || title },
      html: liveHtml,
    };
  }

  async function saveChanges() {
    if (!openType) return;
    const title = content.title || openMeta?.name || "Document";
    const flushed = flushEditorContent(title);
    const ready = prepareLegalContentForPublish(
      flushed.content,
      sameLanguageSeed(openType, language)
    );
    await documentAction({
      action: "saveDraft",
      documentType: openType,
      language,
      content: ready,
    });
    setContent(ready);
    setHtml(flushed.html || "");
    setDirty(false);
    setSavedMessage("Changes saved. They are not visible on the website yet.");
  }

  async function confirmPublish() {
    if (!openType) return;
    setError("");
    const title = content.title || openMeta?.name || "Document";
    const flushed = flushEditorContent(title);
    const ready = prepareLegalContentForPublish(
      flushed.content,
      sameLanguageSeed(openType, language)
    );
    const saved = await documentAction({
      action: "saveDraft",
      documentType: openType,
      language,
      content: ready,
    });
    setContent(ready);
    setHtml(flushed.html || "");
    setDirty(false);

    const version = Number(saved?.document?.version);
    if (!version) {
      throw new Error(
        "No draft version to publish. Save changes first, then try again."
      );
    }
    const result = await documentAction({
      action: "publish",
      documentType: openType,
      language,
      version,
      changeClass: "material",
      publishConfirm: "PUBLISH",
    });
    setPublishOpen(false);
    if (result?.unchanged) {
      setNotice(
        "This version was already published. Edit the text, then publish again."
      );
    } else {
      setNotice("Published successfully · View on website");
    }
    setSavedMessage("");
    await loadEditor(openType, language);
  }

  function renderGroup(title, rows) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: 0.6, color: "text.secondary", fontWeight: 700 }}
        >
          {title}
        </Typography>
        <Stack spacing={0} sx={{ mt: 1, borderTop: "1px solid", borderColor: "divider" }}>
          {rows.map((row) => {
            const entry = overview.find((item) => item.documentType === row.documentType);
            const expanded = openType === row.documentType;
            return (
              <Accordion
                key={row.documentType}
                disableGutters
                elevation={0}
                expanded={expanded}
                onChange={() => openDocument(row.documentType)}
                data-testid={`legal-doc-row-${row.documentType}`}
                sx={{
                  "&:before": { display: "none" },
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: "transparent",
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  id={`legal-doc-${row.documentType}`}
                  sx={{ px: 0, minHeight: 72 }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={{ xs: 0.75, sm: 2 }}
                    alignItems={{ sm: "center" }}
                    justifyContent="space-between"
                    sx={{ width: "100%", pr: 1 }}
                  >
                    <Typography sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
                      {row.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ flexShrink: 0 }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        data-testid={`legal-doc-summary-${row.documentType}`}
                      >
                        {documentLanguageSummary(entry?.languages)}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Open
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0, pb: 3 }}>
                  {expanded && loadedKey.startsWith(`${row.documentType}:`) ? (
                    <Stack spacing={2} data-testid="legal-doc-editor">
                      <Typography sx={{ fontWeight: 800, fontSize: "1.2rem" }}>
                        {row.name}
                      </Typography>
                      <Tabs
                        value={language}
                        onChange={(_e, value) => switchLanguage(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        {ADMIN_LEGAL_LANGUAGES.map((lang) => {
                          const tabState = languagePublicationState(
                            openEntry?.languages?.[lang]
                          );
                          const base = ADMIN_LANGUAGE_LABELS[lang] || lang;
                          const suffix =
                            tabState.key === "published"
                              ? ""
                              : tabState.key === "unpublished_changes"
                                ? " · edits"
                                : " · draft";
                          return (
                            <Tab
                              key={lang}
                              value={lang}
                              label={`${base}${suffix}`}
                            />
                          );
                        })}
                      </Tabs>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        data-testid="legal-doc-editor-status"
                      >
                        {editorState.label}
                      </Typography>
                      <Box
                        sx={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          bgcolor: "background.paper",
                          py: 1,
                          borderBottom: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          flexWrap="wrap"
                        >
                          <Button
                            size="small"
                            variant={preview ? "contained" : "outlined"}
                            onClick={() => setPreview((value) => !value)}
                          >
                            Preview
                          </Button>
                          <Button
                            size="small"
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View live page
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={saving || !dirty}
                            onClick={() => saveChanges().catch((err) => setError(err.message))}
                          >
                            Save changes
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={saving || !canPublish}
                            title={!canPublish ? "No unpublished changes." : undefined}
                            onClick={() => {
                              setError("");
                              setPublishOpen(true);
                            }}
                          >
                            Publish
                          </Button>
                        </Stack>
                        {!canPublish ? (
                          <Typography variant="caption" color="text.secondary">
                            No unpublished changes.
                          </Typography>
                        ) : null}
                      </Box>
                      {savedMessage ? (
                        <Alert severity="success">{savedMessage}</Alert>
                      ) : null}
                      {preview ? (
                        <Box
                          data-testid="legal-doc-preview"
                          sx={{
                            minHeight: 500,
                            maxHeight: "70vh",
                            overflowY: "auto",
                            overflowX: "hidden",
                            pr: 1,
                            "& h2": { fontSize: 17, fontWeight: 600 },
                            "& p": { lineHeight: 1.7 },
                          }}
                          dangerouslySetInnerHTML={{
                            __html: markdownToHtml(sectionsToPlain(content.sections)),
                          }}
                        />
                      ) : (
                        <LegalRichTextEditor
                          ref={editorRef}
                          value={content}
                          onChange={onHtmlChange}
                        />
                      )}
                      {row.documentType ===
                        LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS && preview ? (
                        <BookingFeeOutcomesTable language={language} compact />
                      ) : null}
                    </Stack>
                  ) : expanded ? (
                    <CircularProgress size={22} />
                  ) : null}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      </Box>
    );
  }

  if (!overview.length && !error) return <CircularProgress size={22} />;

  return (
    <Stack spacing={2} data-testid="legal-documents-panel" sx={{ overflowX: "hidden" }}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? (
        <Alert
          severity="success"
          action={
            liveUrl ? (
              <Button color="inherit" size="small" href={liveUrl} target="_blank">
                View on website
              </Button>
            ) : null
          }
        >
          {notice}
        </Alert>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {summary.total} language versions
        {" · "}
        {summary.published} published
        {" · "}
        {summary.notPublished} not published
        {summary.unpublishedChanges
          ? ` · ${summary.documentsWithUnpublishedChanges} document has unpublished changes`
          : ""}
      </Typography>
      {attention ? (
        <Alert
          severity="info"
          sx={{ cursor: "pointer" }}
          onClick={() => {
            const target = summary.firstAttentionType;
            if (target) {
              document
                .getElementById(`legal-doc-${target}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        >
          {attention}
        </Alert>
      ) : null}

      {renderGroup("Customer documents", customerDocumentRows())}
      {renderGroup("Partner documents", partnerDocumentRows())}

      <Dialog
        open={publishOpen}
        onClose={saving ? undefined : () => setPublishOpen(false)}
        fullWidth
        maxWidth="sm"
        data-testid="legal-publish-confirm-dialog"
      >
        <DialogTitle>
          Publish {openMeta?.name || "document"} in {languageName(language)}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            This will replace the version currently shown on the website.
          </Typography>
          <Typography variant="body2">
            Current published date:{" "}
            {langState.publishedAt
              ? formatLegalPublishedDate(langState.publishedAt)
              : "Not published"}
          </Typography>
          <Typography variant="body2">
            New publication date: {formatLegalPublishedDate(new Date())}
          </Typography>
          <Typography variant="body2">Live URL: {liveUrl}</Typography>
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() =>
              confirmPublish().catch((err) =>
                setError(err?.message || "Publish failed")
              )
            }
            data-testid="legal-publish-confirm-submit"
          >
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
