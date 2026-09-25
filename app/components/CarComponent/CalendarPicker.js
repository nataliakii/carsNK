"use client";

/**
 * Compact, fully controlled availability calendar for one car.
 *
 * Controlled on purpose: the selected range and the displayed month are owned
 * by this car's slice of `calendarStateByCarId`. The component holds no date
 * state of its own, so it cannot drift from — or bleed into — another card.
 *
 * It renders one day number per cell and never calls `scrollIntoView`,
 * `window.scrollTo` or `history.replaceState`.
 */

import React, { useCallback, useMemo } from "react";
import { Box, Typography, styled } from "@mui/material";
import IconButton from "@mui/material/IconButton";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import {
  DAYS_IN_WEEK,
  DAY_STATE,
  addMonths,
  buildCalendarCells,
  monthKey,
} from "@/domain/booking/calendarGrid";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEK_STARTS_ON = 1; // Monday

const Root = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  // Fixed inside its card: the grid divides the available width, it never
  // demands a minimum that would overflow the document.
  overflowX: "hidden",
  padding: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: theme.palette.background.paper,
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(0.5),
  marginBottom: theme.spacing(0.5),
}));

const MonthLabel = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.subtitle2.fontSize,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: theme.typography.subtitle2.lineHeight,
  color: theme.palette.text.primary,
  textAlign: "center",
  flex: 1,
  minWidth: 0,
}));

const Grid = styled(Box)({
  display: "grid",
  gridTemplateColumns: `repeat(${DAYS_IN_WEEK}, minmax(0, 1fr))`,
  width: "100%",
  minWidth: 0,
});

const WeekdayLabel = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.secondary,
  textAlign: "center",
  paddingBlock: theme.spacing(0.5),
  minWidth: 0,
  overflow: "hidden",
}));

/**
 * One cell, one number. Range shading is a background on this same element,
 * never a second overlaid node carrying the day number again.
 */
const DayCell = styled("button", {
  shouldForwardProp: (prop) => prop !== "dayState" && prop !== "outsideMonth",
})(({ theme, dayState, outsideMonth }) => {
  const selected =
    dayState === DAY_STATE.RANGE_START ||
    dayState === DAY_STATE.RANGE_END ||
    dayState === DAY_STATE.SELECTED_SINGLE;
  const middle = dayState === DAY_STATE.RANGE_MIDDLE;
  const blocked =
    dayState === DAY_STATE.UNAVAILABLE || dayState === DAY_STATE.PAST;
  const radius = Number(theme.shape.borderRadius);

  return {
    appearance: "none",
    border: 0,
    minWidth: 0,
    width: "100%",
    // Square-ish cells keep the grid compact and stop the giant calendar.
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    fontWeight: selected
      ? theme.typography.fontWeightBold
      : theme.typography.fontWeightRegular,
    borderRadius: middle ? 0 : radius,
    cursor: blocked ? "not-allowed" : "pointer",
    opacity: outsideMonth ? theme.palette.action.disabledOpacity : 1,
    color: selected
      ? theme.palette.primary.contrastText
      : blocked
        ? theme.palette.text.disabled
        : theme.palette.text.primary,
    backgroundColor: selected
      ? theme.palette.primary.main
      : middle
        ? alpha(theme.palette.primary.main, 0.16)
        : dayState === DAY_STATE.UNAVAILABLE
          ? theme.palette.action.disabledBackground
          : "transparent",
    textDecoration: dayState === DAY_STATE.UNAVAILABLE ? "line-through" : "none",
    "&:hover:not(:disabled)": {
      backgroundColor: selected
        ? theme.palette.primary.dark
        : alpha(theme.palette.primary.main, 0.08),
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: -2,
    },
  };
});

const Legend = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: theme.spacing(1),
  marginTop: theme.spacing(0.75),
}));

const LegendItem = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight,
  color: theme.palette.text.secondary,
}));

const LegendSwatch = styled(Box, {
  shouldForwardProp: (prop) => prop !== "swatch",
})(({ theme, swatch }) => ({
  width: theme.spacing(1.5),
  height: theme.spacing(1.5),
  borderRadius: Number(theme.shape.borderRadius) / 2,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor:
    swatch === "selected"
      ? theme.palette.primary.main
      : swatch === "unavailable"
        ? theme.palette.action.disabledBackground
        : theme.palette.background.paper,
}));

const CalendarPicker = ({
  car,
  carId,
  // Blocked days are resolved once by the panel and shared with the selection
  // reducer, so what is painted and what is selectable cannot disagree.
  unavailableDates = [],
  selectedStart = null,
  selectedEnd = null,
  displayMonth = null,
  onSelectDay,
  onMonthChange,
  onClearSelection,
}) => {
  const { t, i18n } = useTranslation();
  const { company, platform } = useMainContext();
  const locale = (i18n?.language || "en").split("-")[0];

  const calendarTz = resolveBusinessTimezone({
    company,
    countryCode: company?.country || platform?.country,
    platformSettings: platform,
    forNewOrder: true,
  });

  // "Today" in the company's timezone, as a plain key. No UTC round-trip, so
  // a late-evening customer cannot lose or gain a day.
  const today = useMemo(
    () => dayjs().tz(calendarTz).format("YYYY-MM-DD"),
    [calendarTz]
  );

  const month = displayMonth || selectedStart?.slice(0, 7) || today.slice(0, 7);

  const cells = useMemo(
    () =>
      buildCalendarCells(month, {
        startDate: selectedStart,
        endDate: selectedEnd,
        unavailableDates,
        today,
        weekStartsOn: WEEK_STARTS_ON,
      }),
    [month, selectedStart, selectedEnd, unavailableDates, today]
  );

  // 1–7 January 2024 runs Monday to Sunday, matching WEEK_STARTS_ON.
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
        dayjs.utc(`2024-01-0${index + 1}`).locale(locale).format("dd")
      ),
    [locale]
  );

  const monthLabel = useMemo(() => {
    const label = dayjs(`${month}-01`).locale(locale).format("MMMM YYYY");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [month, locale]);

  const goToMonth = useCallback(
    (delta) => onMonthChange?.(addMonths(month, delta)),
    [month, onMonthChange]
  );

  const handleDayClick = useCallback(
    (cell) => {
      if (!cell.selectable) return;
      onSelectDay?.(cell.dateKey);
    },
    [onSelectDay]
  );

  return (
    <Root data-testid="mini-calendar" data-car-id={String(carId || car?._id || "")}>
      <Header>
        <IconButton
          size="small"
          onClick={() => goToMonth(-1)}
          aria-label={t("catalog.booking.previousMonth", {
            defaultValue: "Previous month",
          })}
          data-testid="calendar-prev-month"
        >
          <ArrowBackIosNewIcon fontSize="inherit" />
        </IconButton>
        <MonthLabel component="h3" data-testid="calendar-month">
          {monthLabel}
        </MonthLabel>
        <IconButton
          size="small"
          onClick={() => goToMonth(1)}
          aria-label={t("catalog.booking.nextMonth", { defaultValue: "Next month" })}
          data-testid="calendar-next-month"
        >
          <ArrowForwardIosIcon fontSize="inherit" />
        </IconButton>
      </Header>

      <Grid role="grid" aria-label={monthLabel}>
        {weekdayLabels.map((label, index) => (
          <WeekdayLabel
            key={`weekday-${index}`}
            component="span"
            role="columnheader"
            aria-hidden="true"
          >
            {label}
          </WeekdayLabel>
        ))}

        {cells.map((cell) => {
          const blocked =
            cell.state === DAY_STATE.UNAVAILABLE || cell.state === DAY_STATE.PAST;
          const stateLabel = blocked
            ? t("catalog.booking.legendUnavailable", { defaultValue: "Unavailable" })
            : cell.state === DAY_STATE.AVAILABLE
              ? t("catalog.booking.legendAvailable", { defaultValue: "Available" })
              : t("catalog.booking.legendSelected", { defaultValue: "Selected" });

          return (
            <DayCell
              key={cell.dateKey}
              type="button"
              role="gridcell"
              dayState={cell.state}
              outsideMonth={cell.outsideMonth}
              disabled={!cell.selectable}
              aria-disabled={!cell.selectable}
              aria-label={`${dayjs(cell.dateKey).locale(locale).format("D MMMM YYYY")}, ${stateLabel}`}
              aria-selected={
                cell.state === DAY_STATE.RANGE_START ||
                cell.state === DAY_STATE.RANGE_END ||
                cell.state === DAY_STATE.RANGE_MIDDLE ||
                cell.state === DAY_STATE.SELECTED_SINGLE
              }
              data-testid={`calendar-day-${cell.dateKey}`}
              data-state={cell.state}
              onClick={() => handleDayClick(cell)}
            >
              {cell.dayNumber}
            </DayCell>
          );
        })}
      </Grid>

      <Legend data-testid="calendar-legend">
        <LegendItem>
          <LegendSwatch swatch="available" />
          {t("catalog.booking.legendAvailable", { defaultValue: "Available" })}
        </LegendItem>
        <LegendItem>
          <LegendSwatch swatch="unavailable" />
          {t("catalog.booking.legendUnavailable", { defaultValue: "Unavailable" })}
        </LegendItem>
        <LegendItem>
          <LegendSwatch swatch="selected" />
          {t("catalog.booking.legendSelected", { defaultValue: "Selected" })}
        </LegendItem>
      </Legend>

      {selectedStart && onClearSelection ? (
        <Legend>
          <LegendItem
            component="button"
            type="button"
            onClick={onClearSelection}
            data-testid="calendar-clear"
          >
            {t("catalog.booking.clearDates", { defaultValue: "Clear dates" })}
          </LegendItem>
        </Legend>
      ) : null}
    </Root>
  );
};

export default CalendarPicker;
