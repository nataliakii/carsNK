"use client";

import React from "react";
import { Box, Stack, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import DefaultButton from "@/app/components/ui/buttons/DefaultButton";

const StyledTopBar = styled(Box)(({ theme }) => ({
  zIndex: 996,
  position: "fixed",
  top: 60,
  left: 0,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: theme.spacing(1.25),
  paddingBottom: theme.spacing(1.25),
  backgroundColor: theme.palette.backgroundDark1?.bg || "#0B1F3A",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
}));

/**
 * AdminTopBar — action strip under the admin navbar (cars page).
 */
export default function AdminTopBar({ feature, onAddClick, onBulkAddClick }) {
  const { t } = useTranslation();
  const { scrolled } = useMainContext();

  const isCars = feature === "cars";
  if (!isCars) return null;

  return (
    <StyledTopBar
      className="admin-topbar"
      sx={{
        display: {
          xs: "flex",
          "@media (maxWidth: 900px) and (orientation: landscape)": "flex",
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={1.5}
        sx={{
          width: "100%",
          maxWidth: 720,
          px: 2,
        }}
      >
        {onAddClick && (
          <DefaultButton
            onClick={onAddClick}
            relative
            padding={scrolled ? 0.75 : 1.25}
            sx={{
              flex: "1 1 0",
              minWidth: 0,
              maxWidth: 320,
            }}
          >
            {t("carPark.addCar")}
          </DefaultButton>
        )}
        {onBulkAddClick && (
          <DefaultButton
            onClick={onBulkAddClick}
            relative
            padding={scrolled ? 0.75 : 1.25}
            sx={{
              flex: "1 1 0",
              minWidth: 0,
              maxWidth: 320,
              border: "1px solid rgba(255,255,255,0.35)",
              backgroundColor: "transparent",
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.55)",
              },
            }}
          >
            Bulk add cars
          </DefaultButton>
        )}
      </Stack>
    </StyledTopBar>
  );
}
