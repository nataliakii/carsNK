"use client";
import { useEffect, useMemo } from "react";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useMainContext } from "@app/Context";

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";

/** Short toolbar period (`15d` / range15): 15 consecutive days, larger cards. */
export const SHORT_PERIOD_DAYS = 15;

/**
 * Start of the short calendar window (still stored as `15d`).
 * Forward: 15th of the selected month. Backward: 15th of the previous month.
 */
export function getShortPeriodStart({ year, month, rangeDirection }) {
  return rangeDirection === "forward"
    ? dayjs().year(year).month(month).date(15)
    : dayjs().year(year).month(month).subtract(1, "month").date(15);
}

export function getShortPeriodEnd(start) {
  return start.add(SHORT_PERIOD_DAYS - 1, "day");
}

function tzOf(order, fallback = BUSINESS_TZ) {
  return order?.timezone || fallback;
}

/* =========================
   Pure helpers
========================= */

/** Средняя длина месяца (Gregorian) — масштаб для опционального --calendar-day-width-factor */
export const MEAN_GREGORIAN_MONTH_DAYS = 365.2425 / 12;

/** Toolbar period → сколько целых календарных месяцев показываем. */
export const DAY_RANGE_MONTHS = {
  "1m": 1,
  "2m": 2,
  "3m": 3,
  "6m": 6,
};

/** @returns {number} число месяцев в окне; неизвестный/пустой диапазон → 1 */
export function getDayRangeMonths(calendarDayRange) {
  return DAY_RANGE_MONTHS[calendarDayRange] ?? 1;
}

/** Первое число выбранного месяца. date(1) первым — иначе month() может «перепрыгнуть» с 31-го числа. */
function startOfMonth(year, month) {
  return dayjs().date(1).year(year).month(month).startOf("day");
}

function toCalendarDay(date) {
  return {
    dayjs: date,
    date: date.date(),
    weekday: date.format("dd"),
    isSunday: date.day() === 0,
    isMonthStart: date.date() === 1,
  };
}

/**
 * Генерирует массив дней для календаря
 * @param {Object} params
 * @param {number} params.month - месяц (0-11)
 * @param {number} params.year - год
 * @param {string} params.viewMode - 'full' | 'range15'
 * @param {string} params.rangeDirection - 'forward' | 'backward'
 * @param {'15d'|'1m'|'2m'|'3m'|'6m'|null|undefined} [params.calendarDayRange] — если задан, переопределяет выбор ветки
 * @returns {Array} массив дней с dayjs, date, weekday, isSunday
 */
export function buildCalendarDays({
  month,
  year,
  viewMode,
  rangeDirection,
  calendarDayRange,
}) {
  const use15d =
    calendarDayRange === "15d" ||
    (calendarDayRange == null && viewMode === "range15");

  if (use15d) {
    const start = getShortPeriodStart({ year, month, rangeDirection });
    return Array.from({ length: SHORT_PERIOD_DAYS }, (_, index) =>
      toCalendarDay(start.add(index, "day"))
    );
  }

  // 1m / 2m / 3m / 6m: N целых календарных месяцев, начиная с выбранного.
  // Длину считаем суммой daysInMonth, а не diff("day") — иначе переход на
  // летнее время съедает последний день окна.
  const monthSpan = getDayRangeMonths(calendarDayRange);
  const start = startOfMonth(year, month);
  let totalDays = 0;
  for (let i = 0; i < monthSpan; i++) {
    totalDays += start.add(i, "month").daysInMonth();
  }

  return Array.from({ length: totalDays }, (_, index) =>
    toCalendarDay(start.add(index, "day"))
  );
}

/**
 * Последний день окна для выбранного периода (нужен для подписей месяца/года).
 * @param {{ year: number, month: number, calendarDayRange?: string }} params
 */
export function getDayRangeEnd({ year, month, calendarDayRange }) {
  return startOfMonth(year, month)
    .add(getDayRangeMonths(calendarDayRange) - 1, "month")
    .endOf("month");
}

/**
 * Генерирует массив дат (строки YYYY-MM-DD) для заказа
 * @param {Object} order - заказ с rentalStartDate и rentalEndDate
 * @returns {Array<string>} массив дат в формате YYYY-MM-DD
 */
export function buildOrderDateRange(order) {
  if (!order?.rentalStartDate || !order?.rentalEndDate) return [];
  const tz = tzOf(order);

  const startDate = dayjs
    .utc(order.rentalStartDate)
    .tz(tz)
    .startOf("day");
  const endDate = dayjs
    .utc(order.rentalEndDate)
    .tz(tz)
    .startOf("day");
  const dates = [];

  let currentDate = startDate;
  while (currentDate.isSameOrBefore(endDate, "day")) {
    dates.push(currentDate.format("YYYY-MM-DD"));
    currentDate = currentDate.add(1, "day");
  }

  return dates;
}

/**
 * Shift an order's rental window by whole calendar days (Athens).
 * Keeps clock times for timeIn/timeOut; returns null if delta is 0/invalid.
 *
 * @param {Object} order
 * @param {number} dayDelta
 * @returns {{ rentalStartDate: string, rentalEndDate: string, timeIn: Date, timeOut: Date, dayDelta: number } | null}
 */
export function shiftOrderByDays(order, dayDelta) {
  const delta = Number(dayDelta);
  if (!order?.rentalStartDate || !order?.rentalEndDate) return null;
  if (!Number.isFinite(delta) || delta === 0) return null;
  const tz = tzOf(order);

  const start = dayjs
    .utc(order.rentalStartDate)
    .tz(tz)
    .startOf("day")
    .add(delta, "day");
  const end = dayjs
    .utc(order.rentalEndDate)
    .tz(tz)
    .startOf("day")
    .add(delta, "day");

  if (!end.isAfter(start, "day")) return null;

  const timeIn = order.timeIn
    ? dayjs(order.timeIn).tz(tz).add(delta, "day").toDate()
    : start.hour(14).minute(0).second(0).toDate();
  const timeOut = order.timeOut
    ? dayjs(order.timeOut).tz(tz).add(delta, "day").toDate()
    : end.hour(12).minute(0).second(0).toDate();

  return {
    rentalStartDate: start.format("YYYY-MM-DD"),
    rentalEndDate: end.format("YYYY-MM-DD"),
    timeIn,
    timeOut,
    dayDelta: delta,
  };
}

/**
 * Day delta between two YYYY-MM-DD strings (to − from).
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @returns {number}
 */
export function calendarDayDelta(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return 0;
  const from = dayjs.tz(fromDateStr, "YYYY-MM-DD", BUSINESS_TZ);
  const to = dayjs.tz(toDateStr, "YYYY-MM-DD", BUSINESS_TZ);
  if (!from.isValid() || !to.isValid()) return 0;
  return to.diff(from, "day");
}

/**
 * Возвращает индекс текущего дня в массиве days
 * @param {Array} days - массив дней календаря
 * @returns {number} индекс текущего дня или -1
 */
export function getTodayIndex(days, timezone) {
  const today = timezone ? dayjs().tz(timezone) : dayjs();
  return days.findIndex((d) => d.dayjs.isSame(today, "day"));
}

/**
 * Проверяет, является ли viewport мобильным телефоном
 * @returns {boolean}
 */
export function isPhoneViewport() {
  if (typeof window === "undefined") return false;

  const isPortraitPhone = window.matchMedia(
    "(max-width: 600px) and (orientation: portrait)"
  ).matches;

  const isSmallLandscape = window.matchMedia(
    "(max-width: 900px) and (orientation: landscape)"
  ).matches;

  return isPortraitPhone || isSmallLandscape;
}

function findTableInScrollContainer(container) {
  if (!container?.getElementsByTagName) return null;
  const tables = container.getElementsByTagName("table");
  return tables[0] ?? null;
}

/** Day columns live on the last thead row (month-band row may sit above). */
function getTheadDayRow(table) {
  if (!table) return null;
  const thead = table.tHead || table.getElementsByTagName("thead")[0];
  if (!thead?.rows?.length) return null;
  return thead.rows[thead.rows.length - 1];
}

function sumCellWidthsBeforeIndex(cells, index) {
  let left = 0;
  const n = Math.min(index, cells.length);
  for (let i = 0; i < n; i++) {
    const w = cells[i].offsetWidth;
    if (!Number.isFinite(w) || w <= 0) return null;
    left += w;
  }
  return left;
}

/**
 * Горизонтально центрирует колонку «сегодня» в *usable* viewport
 * (как clean crew-week matrix: sticky resource column не перекрывает цель).
 * @param {Object} params
 * @param {HTMLElement} params.container — MUI TableContainer root (scroll element)
 * @param {number} params.todayIndex — индекс сегодня в массиве days
 */
export function scrollCalendarToToday({ container, todayIndex }) {
  if (!container || typeof todayIndex !== "number" || todayIndex < 0) return;

  try {
    const table = findTableInScrollContainer(container);
    if (!table) return;

    const thead = table.tHead || table.getElementsByTagName("thead")[0];
    const dayRow = getTheadDayRow(table);
    if (!thead || !dayRow?.cells?.length) return;

    const dayCells = dayRow.cells;
    let todayColumnIndex = -1;
    for (let i = 0; i < dayCells.length; i++) {
      if (dayCells[i].getAttribute("data-col-index") === String(todayIndex)) {
        todayColumnIndex = i;
        break;
      }
    }
    if (todayColumnIndex < 0) return;

    const containerWidth = container.clientWidth;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return;

    let columnLeft = sumCellWidthsBeforeIndex(dayCells, todayColumnIndex);
    if (columnLeft == null) return;

    // Month-band layout: day row has only day cells; sticky resource col is on row 0.
    const dayRowStartsWithDay = dayCells[0]?.hasAttribute("data-col-index");
    let stickyWidth = 0;
    if (dayRowStartsWithDay) {
      stickyWidth = thead.rows[0]?.cells?.[0]?.offsetWidth ?? 0;
      if (Number.isFinite(stickyWidth) && stickyWidth > 0) {
        columnLeft += stickyWidth;
      } else {
        stickyWidth = 0;
      }
    } else if (dayCells[0] && !dayCells[0].hasAttribute("data-col-index")) {
      stickyWidth = dayCells[0].offsetWidth || 0;
    }

    const todayCell = dayCells[todayColumnIndex];
    const cellWidth = todayCell?.offsetWidth ?? 0;
    if (!Number.isFinite(cellWidth) || cellWidth <= 0) return;

    const pad = 8;
    const usableWidth = Math.max(0, containerWidth - stickyWidth - pad * 2);
    const maxScroll = Math.max(
      0,
      (container.scrollWidth || 0) - containerWidth
    );
    // Center today in the area to the right of the sticky car column.
    let targetScrollLeft =
      columnLeft -
      stickyWidth -
      pad -
      Math.max(0, (usableWidth - cellWidth) / 2);
    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));

    if (typeof container.scrollTo === "function") {
      try {
        container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
      } catch {
        container.scrollLeft = targetScrollLeft;
      }
    } else {
      container.scrollLeft = targetScrollLeft;
    }
  } catch {
    // ignore
  }
}

/* =========================
   Hooks
========================= */

/**
 * Хук для генерации дней календаря и вычисления todayIndex
 * @param {Object} params
 * @param {number} params.month - месяц (0-11)
 * @param {number} params.year - год
 * @param {string} params.viewMode - 'full' | 'range15'
 * @param {string} params.rangeDirection - 'forward' | 'backward'
 * @param {'15d'|'1m'|'2m'|'3m'|'6m'|null|undefined} [params.calendarDayRange]
 * @returns {{ days: Array, todayIndex: number }}
 */
export function useCalendarDays({
  month,
  year,
  viewMode,
  rangeDirection,
  calendarDayRange,
}) {
  const { platform, company } = useMainContext();
  const timezone =
    company?.timezone || platform?.timezone || BUSINESS_TZ;
  const days = useMemo(
    () =>
      buildCalendarDays({
        month,
        year,
        viewMode,
        rangeDirection,
        calendarDayRange,
      }),
    [month, year, viewMode, rangeDirection, calendarDayRange]
  );

  const todayIndex = useMemo(
    () => getTodayIndex(days, timezone),
    [days, timezone]
  );

  return { days, todayIndex };
}

/**
 * Автоскролл к «сегодня» (как clean: на всех viewport, не только phone).
 * Учитывает sticky колонку машин через scrollCalendarToToday.
 */
export function useMobileCalendarScroll({
  days,
  todayIndex,
  containerRef,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let timeoutId = 0;
    let outerRaf = 0;
    let innerRaf = 0;

    const runScroll = () => {
      if (cancelled) return;
      const container = containerRef?.current;
      if (!container) return;
      scrollCalendarToToday({ container, todayIndex });
    };

    /** Double rAF + short delay so thead cell widths settle (fonts, hydration). */
    const scheduleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
        outerRaf = requestAnimationFrame(() => {
          innerRaf = requestAnimationFrame(runScroll);
        });
      }, 50);
    };

    scheduleScroll();

    const onResize = () => scheduleScroll();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [todayIndex, days, containerRef, enabled]);
}
