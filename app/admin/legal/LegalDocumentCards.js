"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import { PLATFORM_DOCUMENT_CATALOG } from "@/domain/legal/platformCatalog";
import {
  livePathForDocument,
  splitLiveAndDraft,
} from "@/domain/legal/documentCardStatus";
import { LEGAL_LANGUAGE_LABELS } from "@/domain/legal/languageStatus";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function LanguageBlock({
  documentType,
  language,
  info,
  onEdit,
  onPublish,
  onDeleteDraft,
  busy,
}) {
  const { live, draft } = splitLiveAndDraft(info);
  const livePath = livePathForDocument(documentType);
  const langLabel = LEGAL_LANGUAGE_LABELS[language] || language.toUpperCase();

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
      }}
      data-testid={`legal-lang-${documentType}-${language}`}
    >
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        {langLabel} ({language.toUpperCase()})
      </Typography>

      <Box
        sx={{
          mb: draft ? 1.5 : 0,
          p: 1.25,
          borderRadius: 1,
          bgcolor: live ? "#e8f5e9" : "action.hover",
          border: "1px solid",
          borderColor: live ? "#a5d6a7" : "divider",
        }}
        data-testid={`legal-live-${documentType}-${language}`}
      >
        <Typography variant="caption" fontWeight={800} color="text.secondary">
          LIVE VERSION
        </Typography>
        {live ? (
          <Stack spacing={0.35} sx={{ mt: 0.5 }}>
            <Typography variant="body2">Language: {language.toUpperCase()}</Typography>
            <Typography variant="body2">Version: v{live.version}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Status:</Typography>
              <Chip size="small" color="success" label="Published" />
            </Stack>
            <Typography variant="body2">
              Published: {formatWhen(live.publishedAt)}
            </Typography>
            <Typography variant="body2">
              Published by: {live.publishedBy || "—"}
            </Typography>
            {livePath ? (
              <Button
                size="small"
                href={`/${language}${livePath}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ alignSelf: "flex-start", mt: 0.5 }}
              >
                View live page
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Nothing published yet.
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          p: 1.25,
          borderRadius: 1,
          bgcolor: draft ? "#fff8e1" : "transparent",
          border: "1px solid",
          borderColor: draft ? "#ffe082" : "transparent",
        }}
        data-testid={`legal-draft-${documentType}-${language}`}
      >
        <Typography variant="caption" fontWeight={800} color="text.secondary">
          UNPUBLISHED CHANGES
        </Typography>
        {draft ? (
          <Stack spacing={0.35} sx={{ mt: 0.5 }}>
            <Typography variant="body2">Language: {language.toUpperCase()}</Typography>
            <Typography variant="body2">Next version: v{draft.version}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Status:</Typography>
              <Chip size="small" color="warning" label="Draft" />
            </Stack>
            <Typography variant="body2">
              Source file: {draft.sourceFilename || "—"}
            </Typography>
            <Typography variant="body2">Saved: {formatWhen(draft.savedAt)}</Typography>
            <Typography variant="body2">Saved by: {draft.savedBy || "—"}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
              <Button
                size="small"
                variant="outlined"
                disabled={busy}
                onClick={() => onEdit?.(documentType, "edit", language)}
              >
                Edit draft
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={busy}
                onClick={() => onEdit?.(documentType, "preview", language)}
              >
                Preview
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={busy}
                onClick={() => onPublish?.(documentType, language, draft.version)}
              >
                Publish update
              </Button>
              <Button
                size="small"
                color="warning"
                disabled={busy}
                onClick={() => onDeleteDraft?.(documentType, language, draft.version)}
              >
                Delete draft
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            No unpublished draft.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function LegalDocumentCards({
  overview = [],
  onEdit,
  onPublish,
  onDeleteDraft,
  busy = false,
}) {
  const byType = new Map((overview || []).map((row) => [row.documentType, row]));

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2,
      }}
    >
      {PLATFORM_DOCUMENT_CATALOG.map((doc) => {
        const entry = byType.get(doc.documentType);
        return (
          <Box
            key={doc.documentType}
            sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
            data-testid={`legal-card-${doc.documentType}`}
          >
            <Typography sx={{ fontWeight: 800 }}>{doc.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Audience: {doc.audience === "customer" ? "Customer" : "Supplier"}
            </Typography>
            <Typography variant="body2">Source language: English</Typography>

            <Stack direction="row" spacing={1} sx={{ my: 1.5, flexWrap: "wrap" }}>
              <Button size="small" onClick={() => onEdit?.(doc, "import")}>
                Import
              </Button>
              <Button size="small" onClick={() => onEdit?.(doc, "translations")}>
                Translations
              </Button>
              <Button size="small" onClick={() => onEdit?.(doc, "history")}>
                Version history
              </Button>
            </Stack>

            {["en", "es"].map((language) => (
              <LanguageBlock
                key={language}
                documentType={doc.documentType}
                language={language}
                info={entry?.languages?.[language]}
                onEdit={(_type, mode) => onEdit?.(doc, mode)}
                onPublish={onPublish}
                onDeleteDraft={onDeleteDraft}
                busy={busy}
              />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
