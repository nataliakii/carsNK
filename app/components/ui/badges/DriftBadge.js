"use client";

import { Chip, Tooltip, Typography, Box } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

/**
 * DriftBadge — small indicator shown next to a field that changed
 * after the order was confirmed (price was frozen).
 *
 * @param {Object} props
 * @param {string} props.frozenValue - value when price was frozen
 * @param {string} props.currentValue - current value of the field
 * @param {string} [props.label] - optional label for the tooltip
 */
export default function DriftBadge({ frozenValue, currentValue, label }) {
  const frozenDisplay = formatDriftValue(frozenValue);
  const currentDisplay = formatDriftValue(currentValue);

  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ fontSize: "0.75rem" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
            {label ? `${label}: changed` : "Changed since confirmation"}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 0.25 }}>
            Was: <b>{frozenDisplay}</b>
          </Typography>
          <Typography variant="caption" sx={{ display: "block" }}>
            Now: <b>{currentDisplay}</b>
          </Typography>
        </Box>
      }
    >
      <Chip
        icon={<WarningAmberIcon sx={{ fontSize: "0.8rem !important" }} />}
        label="changed"
        size="small"
        color="warning"
        variant="outlined"
        sx={{
          height: 20,
          fontSize: "0.6rem",
          fontWeight: 600,
          ml: 0.5,
          "& .MuiChip-label": { px: 0.5 },
          "& .MuiChip-icon": { ml: 0.25 },
        }}
      />
    </Tooltip>
  );
}

function formatDriftValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }
  return String(value);
}
