"use client";
import React, { forwardRef } from "react";
import { TableCell } from "@mui/material";
import { calendarStyles } from "@/theme";

/**
 * Первый столбец календаря (название машины)
 * @param {function} onClick - обработчик клика
 * @param {string} title - tooltip
 * @param {React.ReactNode} children - содержимое ячейки
 * @param {Object} sx - дополнительные стили
 */
const CalendarFirstColumn = forwardRef(function CalendarFirstColumn(
  {
    onClick,
    title,
    children,
    sx = {},
    onDragOver,
    onDragLeave,
    onDrop,
  },
  ref
) {
  return (
    <TableCell
      ref={ref}
      className="bigcalendar-first-column" // Для globals.css (белый текст)
      onClick={onClick}
      title={title}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        ...calendarStyles.firstColumn,
        // Use CSS variable for width if available, otherwise fallback to theme defaults
        width: "var(--resource-col-width, auto)",
        minWidth: "var(--resource-col-width, auto)",
        maxWidth: "var(--resource-col-width, auto)",
        ...sx,
      }}
    >
      {children}
    </TableCell>
  );
});

export default CalendarFirstColumn;

