"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";

import { livePathForDocument } from "@/domain/legal/documentCardStatus";

/**
 * Critical banner when invalid test content is currently live.
 */
export default function LiveTestContentBanner({
  items = [],
  onRestore,
  busy = false,
}) {
  if (!items.length) return null;

  return (
    <Alert
      severity="error"
      data-testid="legal-live-test-content-banner"
      sx={{ "& .MuiAlert-message": { width: "100%" } }}
    >
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        Invalid test content is currently live.
      </Typography>
      <Stack spacing={1.25}>
        {items.map((item) => {
          const path = livePathForDocument(item.documentType);
          return (
            <Stack
              key={`${item.documentType}-${item.language}-${item.version}`}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="body2">
                {item.documentType} / {item.language} v{item.version}
                {item.title ? ` — “${item.title}”` : ""}
              </Typography>
              <Stack direction="row" spacing={1}>
                {path ? (
                  <Button
                    size="small"
                    href={`/${item.language}${path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View live
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  disabled={busy}
                  onClick={() =>
                    onRestore?.({
                      documentType: item.documentType,
                      language: item.language,
                      jurisdiction: item.jurisdiction,
                    })
                  }
                >
                  Restore previous version
                </Button>
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Alert>
  );
}
