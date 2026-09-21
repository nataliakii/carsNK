"use client";

import { Box, Button } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Cars page actions. Calendar has no hub tabs — Cars is a top-level nav item.
 */
export default function CalendarHubTabs({ onAddClick, onBulkAddClick }) {
  const { t } = useTranslation();

  if (!onAddClick && !onBulkAddClick) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 1,
        flexShrink: 0,
        px: { xs: 1, md: 2 },
        py: 0.75,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {onAddClick ? (
        <Button
          size="small"
          variant="contained"
          color="secondary"
          onClick={onAddClick}
          sx={{
            textTransform: "none",
            letterSpacing: "normal",
            wordSpacing: "normal",
            fontWeight: 600,
          }}
        >
          {t("carPark.addCar")}
        </Button>
      ) : null}
      {onBulkAddClick ? (
        <Button
          size="small"
          variant="outlined"
          onClick={onBulkAddClick}
          sx={{
            textTransform: "none",
            letterSpacing: "normal",
            wordSpacing: "normal",
            fontWeight: 600,
          }}
        >
          {t("carPark.bulkAddCars")}
        </Button>
      ) : null}
    </Box>
  );
}
