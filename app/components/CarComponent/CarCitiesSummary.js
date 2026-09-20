"use client";

import React from "react";
import { Box, Typography, Chip } from "@mui/material";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import { useTranslation } from "react-i18next";

/**
 * Compact "available in <cities>" preview for the collapsed catalog card.
 * The full chip list lives in CarDeliveryInfo inside the expanded section;
 * this only shows the first few places and hands the rest to `onShowAll`.
 */
const PREVIEW_COUNT = 3;

const chipSx = {
  height: 22,
  maxWidth: "100%",
  fontSize: "0.68rem",
  borderColor: "divider",
  color: "text.secondary",
  bgcolor: "transparent",
  "& .MuiChip-label": { px: 0.75 },
};

export default function CarCitiesSummary({ zones = [], onShowAll }) {
  const { t } = useTranslation();

  if (!zones.length) return null;

  const preview = zones.slice(0, PREVIEW_COUNT);
  const moreCount = zones.length - preview.length;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0.75,
        minWidth: 0,
        color: "text.secondary",
        textAlign: "left",
      }}
    >
      <LocationOnOutlinedIcon
        sx={{ fontSize: 16, mt: "3px", flex: "0 0 auto", opacity: 0.7 }}
      />
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.5,
          minWidth: 0,
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: { xs: "0.74rem", sm: "0.78rem" },
            fontWeight: 600,
            lineHeight: 1.4,
            mr: 0.25,
          }}
        >
          {t("car.availableIn")}:
        </Typography>
        {preview.map((zone) => (
          <Chip
            key={zone}
            label={zone}
            size="small"
            variant="outlined"
            sx={chipSx}
          />
        ))}
        {moreCount > 0 ? (
          <Chip
            label={t("car.operatingZonesMore", { count: moreCount })}
            size="small"
            variant="outlined"
            onClick={onShowAll}
            sx={{
              ...chipSx,
              cursor: "pointer",
              fontWeight: 600,
              color: "primary.main",
              borderColor: "primary.main",
            }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
