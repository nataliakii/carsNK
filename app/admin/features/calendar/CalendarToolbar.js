"use client";

import React from "react";
import {
  Box,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import dynamic from "next/dynamic";
import LegendCalendarAdmin from "@/app/components/calendar-ui/LegendCalendarAdmin";

const SettingsIcon = dynamic(() => import("@mui/icons-material/Settings"), {
  ssr: false,
});

export default function CalendarToolbar({
  dayRange,
  showLegend,
  legendPlacement,
  showBufferInLegend,
  showDeliveryInLegend,
  onDayRangeChange,
  onOpenCalendarSettings,
}) {
  const showInlineLegend =
    Boolean(showLegend) && legendPlacement === "inline";
  const toggleGroupSx = {
    "& .MuiToggleButtonGroup-grouped": {
      minHeight: 26,
      px: 0.85,
      borderRadius: "8px !important",
    },
    "& .MuiToggleButton-root": {
      color: "rgba(255,255,255,0.74)",
      opacity: 0.9,
      borderColor: "rgba(255,255,255,0.14)",
      textTransform: "none",
      fontSize: "0.72rem",
      px: 1,
      py: 0.3,
      lineHeight: 1.2,
      transition: "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
      "&:hover": {
        backgroundColor: "rgba(255,255,255,0.09)",
        color: "rgba(255,255,255,0.88)",
      },
      "&.Mui-selected": {
        color: "#fff",
        opacity: 1,
        backgroundColor: "primary.main",
        borderColor: "primary.main",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset, 0 1px 4px rgba(0,0,0,0.32)",
        fontWeight: 600,
      },
      "&.Mui-selected:hover": {
        backgroundColor: "primary.dark",
      },
      "&.Mui-focusVisible": {
        outline: "2px solid rgba(255,255,255,0.7)",
        outlineOffset: 1,
      },
    },
  };

  return (
    <Box
      sx={{
        flexShrink: 0,
        px: "10px",
        py: "4px",
        borderBottom: 1,
        borderColor: "rgba(255,255,255,0.1)",
        bgcolor: "#2a2a2a",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          width: "100%",
          columnGap: 1.5,
          rowGap: 1,
        }}
      >
        {/* LEFT: period controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            minWidth: 0,
            justifyContent: { xs: "center", sm: "flex-start" },
          }}
        >
          <ToolbarGroup label="Период">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={dayRange}
              onChange={(_, v) => v != null && onDayRangeChange(v)}
              aria-label="Диапазон дней календаря"
              sx={toggleGroupSx}
            >
              <ToggleButton value="15d">15 дн.</ToggleButton>
              <ToggleButton value="1m">1 мес.</ToggleButton>
              <ToggleButton value="2m">2 мес.</ToggleButton>
            </ToggleButtonGroup>
          </ToolbarGroup>
        </Box>

        {/* CENTER: buffer + delivery (mx auto + equal flex wings keeps block visually centered) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            flex: { xs: "1 1 100%", sm: "0 1 auto" },
            minWidth: 0,
            mx: { xs: 0, sm: "auto" },
            order: { xs: 3, sm: 0 },
          }}
        >
          <LegendCalendarAdmin
            showLegendItems={false}
            showBufferControls={showBufferInLegend}
            showDeliveryInfo={showDeliveryInLegend}
            inToolbar
          />
        </Box>

        {/* RIGHT: legend (icons) + settings */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flex: { xs: "1 1 auto", sm: "1 1 0" },
            minWidth: 0,
            justifyContent: { xs: "center", sm: "flex-end" },
            order: { xs: 2, sm: 0 },
          }}
        >
          {showInlineLegend ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                minWidth: 0,
                maxWidth: "100%",
                width: "auto",
                flexShrink: 1,
              }}
            >
              <LegendCalendarAdmin
                showLegendItems
                legendIconsOnly
                showBufferControls={false}
                showDeliveryInfo={false}
                inToolbar
              />
            </Box>
          ) : null}

          <Tooltip title="Настройки календаря" arrow>
            <IconButton
              size="small"
              onClick={onOpenCalendarSettings}
              aria-label="Настройки календаря"
              sx={{
                color: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 1,
                p: 0.35,
                minWidth: 30,
                minHeight: 30,
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.45)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

function ToolbarGroup({ label, children }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
      <Typography
        variant="caption"
        sx={{
          minWidth: 56,
          color: "rgba(255,255,255,0.66)",
          fontSize: "0.69rem",
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Typography>
      {children}
    </Stack>
  );
}
