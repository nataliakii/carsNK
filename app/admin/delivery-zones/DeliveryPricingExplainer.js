"use client";

import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Simple visual: office at center, service radius circle,
 * inside rule vs outside (beyond radius) rule.
 */
export default function DeliveryPricingExplainer({
  insideMode = "perKm",
  radiusKm = null,
}) {
  const { t } = useTranslation();
  const hasRadius =
    radiusKm !== null &&
    radiusKm !== "" &&
    Number.isFinite(Number(radiusKm)) &&
    Number(radiusKm) >= 0;

  const insideLabel =
    insideMode === "fixed"
      ? t("deliveryZonesPage.diagramInsideFixed")
      : insideMode === "free"
        ? t("deliveryZonesPage.diagramInsideFree")
        : t("deliveryZonesPage.diagramInsidePerKm");

  return (
    <PaperLike>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Box
          component="svg"
          viewBox="0 0 280 180"
          sx={{
            width: "100%",
            maxWidth: 280,
            height: "auto",
            flexShrink: 0,
            display: "block",
          }}
          role="img"
          aria-label={t("deliveryZonesPage.diagramAria")}
        >
          {/* Outside region */}
          <rect
            x="8"
            y="8"
            width="264"
            height="164"
            rx="12"
            fill="#F3F4F6"
            stroke="#D1D5DB"
            strokeWidth="1"
          />
          {/* Radius circle */}
          <circle
            cx="140"
            cy="92"
            r="58"
            fill="#FCE7F3"
            stroke="#DB2777"
            strokeWidth="2"
            strokeDasharray={hasRadius ? "0" : "6 4"}
            opacity={hasRadius ? 1 : 0.55}
          />
          {/* Office pin */}
          <circle cx="140" cy="92" r="8" fill="#BE185D" />
          <circle cx="140" cy="92" r="3.5" fill="#fff" />
          <text
            x="140"
            y="118"
            textAnchor="middle"
            fill="#831843"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            {t("deliveryZonesPage.diagramOffice")}
          </text>
          {/* Inside label */}
          <text
            x="140"
            y="52"
            textAnchor="middle"
            fill="#9D174D"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            {insideLabel}
          </text>
          {/* Outside label */}
          <text
            x="48"
            y="28"
            textAnchor="start"
            fill="#4B5563"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            {t("deliveryZonesPage.diagramOutside")}
          </text>
          {/* Radius arrow */}
          <line
            x1="140"
            y1="92"
            x2="198"
            y2="92"
            stroke="#BE185D"
            strokeWidth="1.5"
            markerEnd="url(#radiusArrow)"
          />
          <defs>
            <marker
              id="radiusArrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6 Z" fill="#BE185D" />
            </marker>
          </defs>
          <text
            x="168"
            y="86"
            textAnchor="middle"
            fill="#BE185D"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
          >
            {hasRadius
              ? t("deliveryZonesPage.diagramRadiusKm", { km: Number(radiusKm) })
              : t("deliveryZonesPage.diagramRadiusEmpty")}
          </text>
        </Box>

        <Stack spacing={1} sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t("deliveryZonesPage.diagramTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("deliveryZonesPage.diagramLead")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight={600} color="text.primary">
              {t("deliveryZonesPage.diagramOptionFixedTitle")}
            </Box>
            {" — "}
            {t("deliveryZonesPage.diagramOptionFixedBody")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight={600} color="text.primary">
              {t("deliveryZonesPage.diagramOptionPerKmTitle")}
            </Box>
            {" — "}
            {t("deliveryZonesPage.diagramOptionPerKmBody")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("deliveryZonesPage.diagramOutsideNote")}
          </Typography>
        </Stack>
      </Stack>
    </PaperLike>
  );
}

function PaperLike({ children }) {
  return (
    <Box
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {children}
    </Box>
  );
}
