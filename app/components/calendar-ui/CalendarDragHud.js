"use client";

import { Box, Typography } from "@mui/material";

/**
 * Floating HUD while dragging an order on the admin calendar.
 */
export default function CalendarDragHud({ hud }) {
  if (!hud || hud.x == null || hud.y == null) return null;

  const ok = Boolean(hud.canDrop);

  return (
    <Box
      sx={{
        position: "fixed",
        left: hud.x + 18,
        top: hud.y + 14,
        zIndex: 1400,
        pointerEvents: "none",
        px: 1.5,
        py: 1,
        borderRadius: 2,
        minWidth: 160,
        maxWidth: 280,
        bgcolor: ok ? "rgba(11, 31, 58, 0.94)" : "rgba(90, 24, 24, 0.94)",
        color: "#fff",
        boxShadow: ok
          ? "0 10px 28px rgba(11,31,58,0.35)"
          : "0 10px 28px rgba(90,24,24,0.4)",
        border: ok
          ? "1px solid rgba(255,235,59,0.55)"
          : "1px solid rgba(255,138,128,0.5)",
        backdropFilter: "blur(6px)",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <Typography
        sx={{
          fontSize: 12.5,
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: 0.2,
        }}
      >
        {hud.action}
      </Typography>
      {hud.deltaLabel ? (
        <Typography
          sx={{
            mt: 0.4,
            fontSize: 11,
            fontWeight: 600,
            opacity: 0.85,
            color: ok ? "#FFE082" : "#FFCDD2",
          }}
        >
          {hud.deltaLabel}
        </Typography>
      ) : null}
      <Typography
        sx={{
          mt: 0.55,
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          opacity: 0.75,
        }}
      >
        {ok ? "Можно отпустить" : "Сюда нельзя"}
      </Typography>
    </Box>
  );
}
