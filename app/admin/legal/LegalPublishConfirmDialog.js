"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

function previewText(content) {
  const title = content?.title || "";
  const first = content?.sections?.[0];
  const body = String(first?.body || "").replace(/\s+/g, " ").trim();
  const snippet = body.slice(0, 220);
  return { title, snippet: snippet ? `${snippet}${body.length > 220 ? "…" : ""}` : "" };
}

/**
 * Production publish confirmation: shows document metadata and requires typing PUBLISH.
 */
export default function LegalPublishConfirmDialog({
  open,
  onClose,
  onConfirm,
  busy = false,
  documentName = "",
  language = "en",
  draftVersion = null,
  content = null,
  effectiveFrom = null,
  previousLiveVersion = null,
  requireTypedConfirm = true,
}) {
  const [typed, setTyped] = useState("");
  const { title, snippet } = useMemo(() => previewText(content), [content]);
  const ready =
    !requireTypedConfirm || String(typed).trim().toUpperCase() === "PUBLISH";

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      data-testid="legal-publish-confirm-dialog"
    >
      <DialogTitle>Confirm publish</DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ mt: 0.5 }}>
          <Alert severity="warning">
            Publishing replaces the live public document for this language.
          </Alert>
          <Typography variant="body2">Document: {documentName || "—"}</Typography>
          <Typography variant="body2">Language: {String(language || "").toUpperCase()}</Typography>
          <Typography variant="body2">Draft version: v{draftVersion ?? "—"}</Typography>
          <Typography variant="body2">Title: {title || "—"}</Typography>
          <Typography variant="body2">
            Effective date:{" "}
            {effectiveFrom
              ? new Date(effectiveFrom).toLocaleString()
              : "On publish (now)"}
          </Typography>
          <Typography variant="body2">
            Previous live version:{" "}
            {previousLiveVersion != null ? `v${previousLiveVersion}` : "none"}
          </Typography>
          {snippet ? (
            <Box
              sx={{
                p: 1.25,
                bgcolor: "action.hover",
                borderRadius: 1,
                fontSize: "0.85rem",
              }}
              data-testid="legal-publish-content-preview"
            >
              {snippet}
            </Box>
          ) : null}
          {requireTypedConfirm ? (
            <TextField
              label='Type PUBLISH to confirm'
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              fullWidth
              autoComplete="off"
              inputProps={{ "data-testid": "legal-publish-confirm-input" }}
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={!ready || busy}
          onClick={() => onConfirm?.()}
          data-testid="legal-publish-confirm-submit"
        >
          Publish
        </Button>
      </DialogActions>
    </Dialog>
  );
}
