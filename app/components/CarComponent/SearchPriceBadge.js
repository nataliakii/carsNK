"use client";

import React from "react";
import { Box, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Catalog date-search price chip. Sits above each available car's calendar
 * when From/To are set in the top filter.
 */
export default function SearchPriceBadge({
  loading = false,
  totalPrice = null,
  days = null,
  showApprox = false,
}) {
  const { t } = useTranslation();
  const ready = !loading && totalPrice != null && days != null;
  const ariaLabel = ready
    ? t("catalog.searchPriceLabel", { price: totalPrice, days })
    : t("basic.loading");

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        mb: { xs: 1, sm: 1.25 },
      }}
    >
      <Chip
        color="primary"
        variant="outlined"
        aria-label={ariaLabel}
        label={
          ready ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.1,
                py: 0.1,
                lineHeight: 1.15,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 0.55,
                }}
              >
                {showApprox ? (
                  <Box
                    component="span"
                    sx={{
                      fontSize: { xs: "0.62rem", sm: "0.72rem" },
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      opacity: 0.85,
                    }}
                  >
                    {t("catalog.searchPriceApprox")}
                  </Box>
                ) : null}
                <Box
                  component="span"
                  sx={{
                    fontSize: { xs: "1.05rem", sm: "1.2rem" },
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {`${totalPrice}€`}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: { xs: "0.68rem", sm: "0.75rem" },
                  fontWeight: 600,
                  opacity: 0.9,
                }}
              >
                {t("catalog.searchPriceForDays", { days })}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: { xs: "0.58rem", sm: "0.65rem" },
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  opacity: 0.7,
                }}
              >
                {t("catalog.searchPriceSource")}
              </Box>
            </Box>
          ) : (
            t("basic.loading")
          )
        }
        sx={{
          height: "auto",
          fontWeight: 700,
          bgcolor: "rgba(255,255,255,0.94)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          "& .MuiChip-label": {
            display: "block",
            px: { xs: 1.25, sm: 1.75 },
            py: { xs: 0.6, sm: 0.85 },
          },
        }}
      />
    </Box>
  );
}
