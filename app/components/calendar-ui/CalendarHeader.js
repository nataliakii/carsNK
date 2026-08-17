"use client";
import React, { useMemo } from "react";
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

const MONTH_BAND_HEIGHT_PX = 22;

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

function shortMonthName(name, max = 3) {
  const s = String(name || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/**
 * Consecutive day columns sharing the same calendar month → label bands.
 * @returns {{ key: string, colSpan: number, label: string, shortLabel: string, month: number, year: number }[]}
 */
function buildMonthBands(days, monthNames, lang) {
  const months = monthNames[lang] || monthNames.en || [];
  const bands = [];
  for (let i = 0; i < (days?.length || 0); i++) {
    const d = days[i]?.dayjs;
    if (!d) continue;
    const key = `${d.year()}-${d.month()}`;
    const last = bands[bands.length - 1];
    if (last && last.key === key) {
      last.colSpan += 1;
      continue;
    }
    const full = months[d.month()] || d.format("MMM");
    bands.push({
      key,
      colSpan: 1,
      label: full,
      shortLabel: shortMonthName(full, 3),
      month: d.month(),
      year: d.year(),
    });
  }
  return bands;
}

/**
 * Шапка таблицы календаря: навигация по месяцу/году и строка дней.
 * For 2-month / multi-month ranges: sticky month label band + month-start markers.
 */
export default function CalendarHeader({ data, actions }) {
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

  const monthBands = useMemo(
    () => buildMonthBands(days, monthNames, currentLang),
    [days, monthNames, currentLang]
  );
  const showMonthBand = monthBands.length > 1;
  const dayHeaderTop = showMonthBand ? MONTH_BAND_HEIGHT_PX : 0;

  const monthsList = monthNames[currentLang] || monthNames.en;

  return (
    <TableHead>
      {showMonthBand ? (
        <TableRow>
          <TableCell
            rowSpan={2}
            sx={{
              ...calendarStyles.headerFirstCell,
              backgroundColor: headerStyles.baseBg,
              height: HEADER_STYLES.firstCellHeight + MONTH_BAND_HEIGHT_PX,
              verticalAlign: "bottom",
              width: "var(--resource-col-width, auto)",
              minWidth: "var(--resource-col-width, auto)",
              maxWidth: "var(--resource-col-width, auto)",
              position: "sticky",
              left: 0,
              top: 0,
              zIndex: 6,
            }}
          >
            <HeaderNavBlock
              year={year}
              month={month}
              viewMode={viewMode}
              rangeDirection={rangeDirection}
              calendarDayRange={calendarDayRange}
              monthNames={monthNames}
              currentLang={currentLang}
              isPortraitPhone={isPortraitPhone}
              headerStyles={headerStyles}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              onMonthChange={onMonthChange}
              onYearChange={onYearChange}
              preferShortMonthLabels
            />
          </TableCell>
          {monthBands.map((band, bandIdx) => (
            <TableCell
              key={band.key}
              colSpan={band.colSpan}
              align="center"
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                height: MONTH_BAND_HEIGHT_PX,
                py: 0,
                px: 0.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                borderLeft:
                  bandIdx > 0 ? "2px solid rgba(0,194,184,0.65)" : undefined,
                backgroundColor:
                  bandIdx % 2 === 0
                    ? "rgba(0,194,184,0.14)"
                    : "rgba(11,31,58,0.08)",
                color: "text.primary",
              }}
            >
              <Box
                sx={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${band.label} ${band.year}`}
              >
                {band.colSpan >= 6
                  ? `${band.label} ${band.year}`
                  : `${band.shortLabel} ’${String(band.year).slice(-2)}`}
              </Box>
            </TableCell>
          ))}
        </TableRow>
      ) : (
        <TableRow>
          <TableCell
            sx={{
              ...calendarStyles.headerFirstCell,
              backgroundColor: headerStyles.baseBg,
              height: HEADER_STYLES.firstCellHeight,
              width: "var(--resource-col-width, auto)",
              minWidth: "var(--resource-col-width, auto)",
              maxWidth: "var(--resource-col-width, auto)",
            }}
          >
            <HeaderNavBlock
              year={year}
              month={month}
              viewMode={viewMode}
              rangeDirection={rangeDirection}
              calendarDayRange={calendarDayRange}
              monthNames={monthNames}
              currentLang={currentLang}
              isPortraitPhone={isPortraitPhone}
              headerStyles={headerStyles}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              onMonthChange={onMonthChange}
              onYearChange={onYearChange}
              preferShortMonthLabels={false}
            />
          </TableCell>
          {days.map((day, idx) => (
            <DayHeaderCell
              key={day.dayjs.valueOf()}
              day={day}
              idx={idx}
              todayIndex={todayIndex}
              highlightToday={highlightToday}
              headerStyles={headerStyles}
              weekday2={weekday2}
              currentLang={currentLang}
              calendarRef={calendarRef}
              onDayClick={onDayClick}
              stickyTop={0}
              showMonthCue={false}
            />
          ))}
        </TableRow>
      )}

      {showMonthBand ? (
        <TableRow>
          {days.map((day, idx) => (
            <DayHeaderCell
              key={day.dayjs.valueOf()}
              day={day}
              idx={idx}
              todayIndex={todayIndex}
              highlightToday={highlightToday}
              headerStyles={headerStyles}
              weekday2={weekday2}
              currentLang={currentLang}
              calendarRef={calendarRef}
              onDayClick={onDayClick}
              stickyTop={dayHeaderTop}
              showMonthCue={Boolean(day.isMonthStart)}
              monthCue={shortMonthName(monthsList[day.dayjs.month()] || "", 3)}
            />
          ))}
        </TableRow>
      ) : null}
    </TableHead>
  );
}

function HeaderNavBlock({
  year,
  month,
  viewMode,
  rangeDirection,
  calendarDayRange,
  monthNames,
  currentLang,
  isPortraitPhone,
  headerStyles,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onYearChange,
  preferShortMonthLabels,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        height: "100%",
        pb: HEADER_STYLES.firstCellBottomPadding,
      }}
    >
      <Box sx={calendarStyles.yearRow}>
        <Select
          className="bigcalendar-year-select"
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

      <Box
        sx={{
          ...calendarStyles.monthRow,
          width: "100%",
          display: "grid",
          gridTemplateColumns:
            "minmax(22px, 12%) minmax(0, 76%) minmax(22px, 12%)",
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
            minWidth: 0,
          }}
        >
          <Select
            className="bigcalendar-month-select"
            value={month}
            onChange={onMonthChange}
            size="small"
            sx={{
              ...calendarStyles.monthSelect,
              width: "100%",
              minWidth: 0,
              fontSize: HEADER_STYLES.monthSelectFont,
              "& .MuiSelect-select": {
                ...(calendarStyles.monthSelect["& .MuiSelect-select"] || {}),
                textAlign: "center",
                fontSize: HEADER_STYLES.monthSelectFont,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            }}
            renderValue={() => {
              const months = monthNames[currentLang] || monthNames.en;
              const useShort =
                preferShortMonthLabels ||
                isPortraitPhone ||
                calendarDayRange === "2m" ||
                viewMode === "range15";
              const abbr = (name) =>
                useShort ? shortMonthName(name, 3) : name;
              if (calendarDayRange === "2m") {
                const a = months[month];
                const b = months[(month + 1) % 12];
                return `${abbr(a)}–${abbr(b)}`;
              }
              if (viewMode === "range15") {
                if (rangeDirection === "forward") {
                  return `${abbr(months[month])}–${abbr(
                    months[(month + 1) % 12]
                  )}`;
                }
                return `${abbr(months[(month + 11) % 12])}–${abbr(
                  months[month]
                )}`;
              }
              return useShort && isPortraitPhone
                ? abbr(months[month])
                : months[month];
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
  );
}

function DayHeaderCell({
  day,
  idx,
  todayIndex,
  highlightToday,
  headerStyles,
  weekday2,
  currentLang,
  calendarRef,
  onDayClick,
  stickyTop,
  showMonthCue,
  monthCue,
}) {
  const weekdayFull =
    (weekday2[currentLang] || weekday2.en)[day.dayjs.day()] ?? "";
  const weekdayShort = abbrevWeekdayLabel(weekdayFull);
  const isMonthStart = Boolean(day.isMonthStart);

  return (
    <CalendarDayCell
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
      title={`${weekdayFull ? `${weekdayFull}, ` : ""}${day.dayjs.format(
        "D MMM YYYY"
      )}`}
      sx={{
        py: 0,
        px: 0.25,
        top: stickyTop,
        borderLeft: isMonthStart && idx > 0
          ? "2px solid rgba(0,194,184,0.55)"
          : undefined,
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
        "& .calendar-header-month-cue": {
          fontSize: "0.52rem",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: 0.2,
          textTransform: "uppercase",
          opacity: 0.85,
          color: "secondary.main",
        },
      }}
    >
      <div className="calendar-header-day-wrap">
        {showMonthCue && monthCue ? (
          <div className="calendar-header-month-cue">{monthCue}</div>
        ) : null}
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
}
