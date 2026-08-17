"use client";

import React from "react";
import { Box, Button, Stack, styled } from "@mui/material";
import { useTranslation } from "react-i18next";

const TOPBAR_HEIGHT_PX = 48;

const StyledTopBar = styled(Box)(({ theme }) => ({
  zIndex: 996,
  position: "fixed",
  top: 60,
  left: 0,
  width: "100%",
  height: TOPBAR_HEIGHT_PX,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  backgroundColor: theme.palette.backgroundDark1?.bg || "#0B1F3A",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
}));

/**
 * AdminTopBar — compact action strip under the admin navbar (cars page).
 */
export default function AdminTopBar({ feature, onAddClick, onBulkAddClick }) {
  const { t } = useTranslation();

  const isCars = feature === "cars";
  if (!isCars) return null;

  const btnSx = {
    flex: "1 1 0",
    minWidth: 0,
    maxWidth: 260,
    py: 0.6,
    px: 1.5,
    fontSize: "0.8rem",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    borderRadius: 1,
    boxShadow: "none",
    whiteSpace: "nowrap",
  };

  return (
    <StyledTopBar className="admin-topbar">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={1.25}
        sx={{
          width: "100%",
          maxWidth: 560,
          px: 2,
        }}
      >
        {onAddClick && (
          <Button
            variant="contained"
            color="secondary"
            onClick={onAddClick}
            sx={btnSx}
          >
            {t("carPark.addCar")}
          </Button>
        )}
        {onBulkAddClick && (
          <Button
            variant="outlined"
            onClick={onBulkAddClick}
            sx={{
              ...btnSx,
              color: "common.white",
              borderColor: "rgba(255,255,255,0.4)",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.7)",
                backgroundColor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            {t("carPark.bulkAddCars")}
          </Button>
        )}
      </Stack>
    </StyledTopBar>
  );
}

export { TOPBAR_HEIGHT_PX };
