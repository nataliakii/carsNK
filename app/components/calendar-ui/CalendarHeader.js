"use client";
import React from "react";
import {
  TableHead,
  TableRow,
  TableCell,
  Box,
  Select,
  MenuItem,
} from "@mui/material";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

import { CalendarNavButton, CalendarDayCell } from "../ui";
import { calendarStyles } from "@/theme";

const HEADER_STYLES = {
  firstCellHeight: 54,
  firstCellBottomPadding: 0.4,
  dayCellPadding: "1px 2px",
  /** ~11.5px */
  dayFontSize: "0.72rem",
  dayLineHeight: 1.05,
  /** ~9.6px */
  weekFontSize: "0.6rem",
  weekLineHeight: 1.02,
  yearSelectFont: 12,
  monthSelectFont: 12,
  menuItemFont: 12,
};

/** Компактная подпись дня недели: «Пн»→«П», длинные названия → 2 символа. */
function abbrevWeekdayLabel(label) {
  const s = String(label ?? "").trim();
  if (!s) return "";
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0];
  return s.slice(0, 2);
}

/**
 * Шапка таблицы календаря: навигация по месяцу/году и строка дней.
 * (Структура и стили совпадают с прежним BigCalendarHeader.)
 */
export default function CalendarHeader({
  data,
  actions,
}) {
  const {
    days,
    month,
    year,
    todayIndex,
    highlightToday,
    viewMode,
    rangeDirection,
    calendarDayRange,
    monthNames,
    weekday2,
    currentLang,
    isPortraitPhone,
    headerStyles,
    calendarRef,
  } = data;
  const { onPrevMonth, onNextMonth, onMonthChange, onYearChange, onDayClick } =
    actions;

  return (
    <TableHead>
      <TableRow>
        {/* Первая ячейка — выбор года/месяца */}
        <TableCell
          sx={{
            ...calendarStyles.headerFirstCell,
            backgroundColor: headerStyles.baseBg,
            height: HEADER_STYLES.firstCellHeight,
            // Use CSS variable for width to match body first column
            width: "var(--resource-col-width, auto)",
            minWidth: "var(--resource-col-width, auto)",
            maxWidth: "var(--resource-col-width, auto)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              height: "100%",
              pb: HEADER_STYLES.firstCellBottomPadding,
            }}
          >
            {/* Верхняя строка: год */}
            <Box sx={calendarStyles.yearRow}>
              <Select
                className="bigcalendar-year-select" // Для globals.css
                value={year}
                onChange={onYearChange}
                size="small"
                sx={{
                  ...calendarStyles.yearSelect,
                  fontSize: HEADER_STYLES.yearSelectFont,
                  "& .MuiSelect-select": {
                    ...((calendarStyles.yearSelect &&
                      calendarStyles.yearSelect["& .MuiSelect-select"]) ||
                      {}),
                    fontSize: HEADER_STYLES.yearSelectFont,
                  },
                }}
                renderValue={() => {
                  if (calendarDayRange === "2m") {
                    const start = dayjs().year(year).month(month).date(1);
                    const end = start.add(1, "month").endOf("month");
                    const y1 = start.year();
                    const y2 = end.year();
                    return y1 === y2 ? `${y1}` : `${y1}–${y2}`;
                  }
                  if (viewMode === "range15") {
                    const start =
                      rangeDirection === "forward"
                        ? dayjs().year(year).month(month).date(15)
                        : dayjs()
                            .year(year)
                            .month(month)
                            .subtract(1, "month")
                            .date(15);
                    const end =
                      rangeDirection === "forward"
                        ? start.add(1, "month").date(15)
                        : dayjs().year(year).month(month).date(15);
                    const y1 = start.year();
                    const y2 = end.year();
                    return y1 === y2 ? `${y1}` : `${y1}-${y2}`;
                  }
                  return `${year}`;
                }}
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <MenuItem
                    key={index}
                    value={year - 2 + index}
                    sx={{ fontSize: HEADER_STYLES.menuItemFont, py: 0.2 }}
                  >
                    {year - 2 + index}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Нижняя строка: стрелки + месяц */}
            <Box
              sx={{
                ...calendarStyles.monthRow,
                width: "100%",
                display: "grid",
                gridTemplateColumns:
                  "minmax(24px, 10%) minmax(0, 80%) minmax(24px, 10%)",
                alignItems: "center",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarNavButton
                  direction="prev"
                  onClick={onPrevMonth}
                  color={headerStyles.weekdayText}
                />
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Select
                  className="bigcalendar-month-select" // ??? globals.css
                  value={month}
                  onChange={onMonthChange}
                  size="small"
                  sx={{
                    ...calendarStyles.monthSelect,
                    width: "100%",
                    minWidth: 0,
                    fontSize: HEADER_STYLES.monthSelectFont,
                    "& .MuiSelect-select": {
                      ...(calendarStyles.monthSelect["& .MuiSelect-select"] ||
                        {}),
                      textAlign: "center",
                      fontSize: HEADER_STYLES.monthSelectFont,
                    },
                  }}
                  renderValue={() => {
                    const months = monthNames[currentLang] || monthNames.en;
                    const abbr = (name) =>
                      isPortraitPhone && viewMode === "range15"
                        ? name.slice(0, 3)
                        : name;
                    if (calendarDayRange === "2m") {
                      const a = months[month];
                      const b = months[(month + 1) % 12];
                      return isPortraitPhone
                        ? `${abbr(a)}–${abbr(b)}`
                        : `${a} – ${b}`;
                    }
                    if (viewMode === "range15") {
                      if (rangeDirection === "forward") {
                        const currentLabel = months[month];
                        const nextLabel = months[(month + 1) % 12];
                        return `${abbr(currentLabel)}-${abbr(nextLabel)}`;
                      } else {
                        const prevLabel = months[(month + 11) % 12];
                        const currentLabel = months[month];
                        return `${abbr(prevLabel)}-${abbr(currentLabel)}`;
                      }
                    }
                    return months[month];
                  }}
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <MenuItem
                      key={index}
                      value={index}
                      sx={{ fontSize: HEADER_STYLES.menuItemFont, py: 0.2 }}
                    >
                      {(monthNames[currentLang] || monthNames.en)[index]}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarNavButton
                  direction="next"
                  onClick={onNextMonth}
                  color={headerStyles.weekdayText}
                />
              </Box>
            </Box>
          </Box>
        </TableCell>

        {/* Ячейки дней */}
        {days.map((day, idx) => {
          const weekdayFull =
            (weekday2[currentLang] || weekday2.en)[day.dayjs.day()] ?? "";
          const weekdayShort = abbrevWeekdayLabel(weekdayFull);
          return (
          <CalendarDayCell
            key={day.dayjs.valueOf()}
            colIndex={idx}
            isToday={highlightToday && idx === todayIndex}
            backgroundColor={
              highlightToday && idx === todayIndex
                ? headerStyles.todayBg
                : headerStyles.baseBg
            }
            onClick={() => onDayClick(day)}
            onMouseEnter={() =>
              calendarRef?.current?.setAttribute("data-hover-col", idx)
            }
            onMouseLeave={() =>
              calendarRef?.current?.removeAttribute("data-hover-col")
            }
            title={`${weekdayFull ? `${weekdayFull}, ` : ""}${day.date}. Нажмите для просмотра всех начинающихся и заканчивающихся заказов на эту дату`}
            sx={{
              py: 0,
              px: 0.25,
              "& .calendar-header-day-date": {
                fontSize: HEADER_STYLES.dayFontSize,
                lineHeight: HEADER_STYLES.dayLineHeight,
                fontWeight: 600,
              },
              "& .calendar-header-day-week": {
                fontSize: HEADER_STYLES.weekFontSize,
                lineHeight: HEADER_STYLES.weekLineHeight,
                opacity: 0.88,
              },
              "& .calendar-header-day-wrap": {
                padding: HEADER_STYLES.dayCellPadding,
              },
            }}
          >
            <div className="calendar-header-day-wrap">
              <div
                className="calendar-header-day-date"
                style={{
                  color: day.isSunday ? headerStyles.sundayText : "inherit",
                }}
              >
                {day.date}
              </div>
              <div
                className="calendar-header-day-week"
                style={{
                  color: day.isSunday ? headerStyles.sundayText : "inherit",
                }}
              >
                {weekdayShort}
              </div>
            </div>
          </CalendarDayCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
}
