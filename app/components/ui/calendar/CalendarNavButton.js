"use client";
import React from "react";
import { IconButton, Box } from "@mui/material";
import { calendarStyles } from "@/theme";

/**
 * Кнопка навигации календаря (стрелки влево/вправо)
 * @param {string} direction - "prev" или "next"
 * @param {function} onClick - обработчик клика
 * @param {string} color - цвет стрелки (по умолчанию из темы)
 */
export default function CalendarNavButton({ direction, onClick, color = "text.primary", sx = {} }) {
  const arrow = direction === "prev" ? "\u25C0" : "\u25B6";
  const margin = direction === "prev" ? { mr: 0 } : { ml: 0 };

  return (
    <IconButton 
      size="small" 
      onClick={onClick} 
      sx={{ ...calendarStyles.navButton, ...margin, ...sx }}
    >
      <Box 
        component="span" 
        sx={{ ...calendarStyles.navArrow, color }}
      >
        {arrow}
      </Box>
    </IconButton>
  );
}

