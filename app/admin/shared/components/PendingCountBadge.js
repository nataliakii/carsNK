"use client";

import { Box } from "@mui/material";
import { formatPendingBadgeCount } from "@app/hooks/useAdminPendingInbox";

/**
 * Compact numeric badge for nav links / tabs.
 */
export default function PendingCountBadge({
  count,
  sx = {},
  tone = "error",
}) {
  const label = formatPendingBadgeCount(count);
  if (!label) return null;

  const bg =
    tone === "warning"
      ? "#ed6c02"
      : tone === "info"
        ? "#0288d1"
        : "#d32f2f";

  return (
    <Box
      component="span"
      aria-label={`${label} pending`}
      sx={{
        ml: 0.75,
        minWidth: 16,
        height: 16,
        px: 0.45,
        borderRadius: "999px",
        bgcolor: bg,
        color: "#fff",
        fontSize: "0.65rem",
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        letterSpacing: 0,
        flexShrink: 0,
        ...sx,
      }}
    >
      {label}
    </Box>
  );
}
