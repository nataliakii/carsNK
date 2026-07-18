"use client";

import React from "react";
import { Box, Stack, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import DefaultButton from "@/app/components/ui/buttons/DefaultButton";
import LegendCalendarAdmin from "@/app/components/calendar-ui/LegendCalendarAdmin";

const StyledTopBar = styled(Box)(({ theme, scrolled }) => ({
  zIndex: 996,
  position: "fixed",
  top: scrolled ? 10 : 20,
  left: 0,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: theme.spacing(2),
  backgroundColor: theme.palette.backgroundDark1?.bg || "#1a1a1a",
  transition: "top 0.2s ease-in-out",
}));

/**
 * AdminTopBar - верхняя панель для админки
 * @param {object} props
 * @param {string} props.feature - активная feature: 'cars' | 'orders' | 'calendar'
 * @param {function} props.onAddClick - callback для кнопки добавления
 */
export default function AdminTopBar({ feature, onAddClick }) {
  const { t } = useTranslation();
  const { scrolled } = useMainContext();

  const isCars = feature === "cars";
  const isBigCalendar = feature === "calendar";
  const isOrdersTable = feature === "orders-table";

  // BigCalendar имеет встроенную легенду
  // OrdersTable has its own title and filters built-in
  const showTopBar = isCars;

  if (!showTopBar) return null;

  return (
    <StyledTopBar
      scrolled={scrolled}
      className="admin-topbar"
      sx={{
        display: {
          xs: "flex",
          "@media (maxWidth: 900px) and (orientation: landscape)": isCars
            ? "flex"
            : "none",
        },
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        width="100%"
        justifyContent="center"
      >
        {isCars && onAddClick && (
          <DefaultButton
            onClick={onAddClick}
            minWidth="600px"
            padding={scrolled ? 0 : 1.5}
            relative
            sx={{
              width: "100%",
              mt: { xs: 1.75, sm: 2 },
            }}
          >
            {t("carPark.addCar")}
          </DefaultButton>
        )}
      </Box>
    </StyledTopBar>
  );
}

