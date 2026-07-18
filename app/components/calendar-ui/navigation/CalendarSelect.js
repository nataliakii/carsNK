"use client";
import React from "react";
import { Select, MenuItem } from "@mui/material";
import { calendarStyles } from "@/theme";

/**
 * Селект для выбора года/месяца в календаре
 * @param {string} type - "year" или "month"
 * @param {any} value - текущее значение
 * @param {function} onChange - обработчик изменения
 * @param {function} renderValue - кастомный рендер выбранного значения
 * @param {Array} options - массив опций { value, label }
 * @param {string} className - className для globals.css
 */
export default function CalendarSelect({ 
  type, 
  value, 
  onChange, 
  renderValue, 
  options, 
  className,
  sx = {} 
}) {
  const baseStyles = type === "year" 
    ? calendarStyles.yearSelect 
    : calendarStyles.monthSelect;

  return (
    <Select
      className={className}
      value={value}
      onChange={onChange}
      size="small"
      sx={{ ...baseStyles, ...sx }}
      renderValue={renderValue}
    >
      {options.map((option) => (
        <MenuItem 
          key={option.value} 
          value={option.value} 
          sx={{ fontSize: 13, py: 0.2 }}
        >
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

