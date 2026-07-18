"use client";
import React from "react";
import { TableCell } from "@mui/material";
import { calendarStyles } from "@/theme";

/**
 * Ячейка дня в шапке календаря
 * @param {number} colIndex - индекс колонки
 * @param {boolean} isToday - сегодняшний день
 * @param {string} backgroundColor - цвет фона
 * @param {function} onClick - обработчик клика
 * @param {function} onMouseEnter - обработчик наведения
 * @param {function} onMouseLeave - обработчик ухода мыши
 * @param {React.ReactNode} children - содержимое
 */
export default function CalendarDayCell({ 
  colIndex, 
  isToday, 
  backgroundColor,
  onClick, 
  onMouseEnter, 
  onMouseLeave, 
  children,
  title = "Нажмите для просмотра заказов",
  sx = {}
}) {
  return (
    <TableCell
      data-col-index={colIndex}
      align="center"
      title={title}
      className={isToday ? "today-column-bg" : undefined}
      sx={{
        ...calendarStyles.headerDayCell,
        backgroundColor,
        ...sx,
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </TableCell>
  );
}

