"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import {
  PLATFORM_DOCUMENT_CATALOG,
} from "@/domain/legal/platformCatalog";

function languageStatus(entry, language) {
  const row = entry?.languages?.[language];
  if (!row || row.latestStatus === "missing" || !row.latestVersion) return "Missing";
  if (row.published) return "Published";
  if (row.latestStatus === "draft") return "Draft translation";
  return row.latestStatus || "Missing";
}

export default function LegalDocumentCards({ overview = [], onEdit }) {
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
        const published = ["en", "es", "ru", "uk"].filter(
          (language) => entry?.languages?.[language]?.published
        );
        const missing = ["en", "es", "ru", "uk"].filter(
          (language) => !entry?.languages?.[language]?.published
        );
        return (
          <Box
            key={doc.documentType}
            sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
          >
            <Typography sx={{ fontWeight: 800 }}>{doc.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              Audience: {doc.audience === "customer" ? "Customer" : "Supplier"}
            </Typography>
            <Typography variant="body2">Source language: English</Typography>
            <Typography variant="body2">
              Current version: {entry?.languages?.en?.published?.version || entry?.languages?.en?.latestVersion || "—"}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: "wrap" }}>
              <Chip size="small" label={entry?.languages?.en?.latestStatus || "missing"} />
              <Chip size="small" variant="outlined" label={`Published: ${published.join(", ") || "none"}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Missing translations: {missing.join(", ") || "none"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {["en", "es", "ru", "uk"].map((language) => `${language}: ${languageStatus(entry, language)}`).join(" · ")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
              <Button size="small" onClick={() => onEdit?.(doc, "edit")}>Edit</Button>
              <Button size="small" onClick={() => onEdit?.(doc, "preview")}>Preview</Button>
              <Button size="small" onClick={() => onEdit?.(doc, "import")}>Import</Button>
              <Button size="small" onClick={() => onEdit?.(doc, "translations")}>Translations</Button>
              <Button size="small" onClick={() => onEdit?.(doc, "history")}>Version history</Button>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
