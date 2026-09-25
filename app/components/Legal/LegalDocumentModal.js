"use client";

import { useCallback, useEffect, useRef } from "react";
import { Box, Button, Dialog, DialogContent, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Published legal text, or the Booking Fee outcomes table.
 * The trigger stays a button so site-wide `a { font-size: 1.5rem }` cannot
 * turn an inline label into a heading.
 *
 * When `onReachedEnd` is set, scrolling (or a short document) reports that
 * the reader reached the bottom — used for clickwrap "scroll to accept".
 */
export default function LegalDocumentModal({
  open,
  onClose,
  title,
  version,
  publishedAt,
  language,
  publicHref,
  openInNewTabLabel = "Open in new tab",
  closeLabel = "Close",
  onReachedEnd,
  children,
}) {
  const contentRef = useRef(null);
  const reportedRef = useRef(false);

  const meta = [
    version ? `Version ${version}` : "",
    publishedAt ? `Published ${publishedAt}` : "",
    language ? String(language).toUpperCase() : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const checkReachedEnd = useCallback(() => {
    if (!onReachedEnd || reportedRef.current) return;
    const el = contentRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Short docs that fit without scrolling also count as read.
    if (remaining <= 24 || el.scrollHeight <= el.clientHeight + 8) {
      reportedRef.current = true;
      onReachedEnd();
    }
  }, [onReachedEnd]);

  useEffect(() => {
    if (!open) {
      reportedRef.current = false;
      return undefined;
    }
    reportedRef.current = false;
    const id = requestAnimationFrame(() => checkReachedEnd());
    return () => cancelAnimationFrame(id);
  }, [open, title, checkReachedEnd]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="paper"
      aria-labelledby="legal-document-modal-title"
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 24px)", sm: "min(1000px, calc(100vw - 64px))" },
          maxWidth: "none",
          maxHeight: "90vh",
          m: { xs: "12px", sm: "32px" },
        },
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 1,
          px: 2.5,
          py: 1.5,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="legal-document-modal-title" variant="h6" sx={{ fontSize: "1.15rem", fontWeight: 700 }}>
            {title}
          </Typography>
          {meta ? (
            <Typography variant="caption" color="text.secondary">
              {meta}
            </Typography>
          ) : null}
        </Box>
        {publicHref ? (
          <Button
            component="a"
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{ fontSize: "0.8rem", mt: 0 }}
          >
            {openInNewTabLabel}
          </Button>
        ) : null}
        <IconButton aria-label={closeLabel} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent
        ref={contentRef}
        onScroll={checkReachedEnd}
        dividers
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
        }}
      >
        <Box sx={{ maxWidth: "80ch", mx: "auto", fontSize: "1rem", lineHeight: 1.6 }}>
          {children}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
