"use client";
import { useEffect, useMemo } from "react";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";

/* =========================
   Pure helpers
========================= */

/** Средняя длина месяца (Gregorian) — масштаб для опционального --calendar-day-width-factor */
export const MEAN_GREGORIAN_MONTH_DAYS = 365.2425 / 12;

/**
 * Генерирует массив дней для календаря
 * @param {Object} params
 * @param {number} params.month - месяц (0-11)
 * @param {number} params.year - год
 * @param {string} params.viewMode - 'full' | 'range15'
 * @param {string} params.rangeDirection - 'forward' | 'backward'
 * @param {'15d'|'1m'|'2m'|null|undefined} [params.calendarDayRange] — если задан, переопределяет выбор ветки (15d / один месяц / два месяца)
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
    const start =
      rangeDirection === "forward"
        ? dayjs().year(year).month(month).date(15)
        : dayjs().year(year).month(month).subtract(1, "month").date(15);

    const end =
      rangeDirection === "forward"
        ? start.add(1, "month").date(15)
        : dayjs().year(year).month(month).date(15);

    const totalDays = end.diff(start, "day");

    return Array.from({ length: totalDays + 1 }, (_, index) => {
      const date = start.add(index, "day");
      return {
        dayjs: date,
        date: date.date(),
        weekday: date.format("dd"),
        isSunday: date.day() === 0,
      };
    });
  }

  if (calendarDayRange === "2m") {
    const start = dayjs().year(year).month(month).date(1).startOf("day");
    const end = start.add(1, "month").endOf("month").startOf("day");
    const totalDays = end.diff(start, "day");
    return Array.from({ length: totalDays + 1 }, (_, index) => {
      const date = start.add(index, "day");
      return {
        dayjs: date,
        date: date.date(),
        weekday: date.format("dd"),
        isSunday: date.day() === 0,
      };
    });
  }

  // 1m или full без calendarDayRange: один календарный месяц
  const dim = dayjs().year(year).month(month).daysInMonth();

  return Array.from({ length: dim }, (_, index) => {
    const date = dayjs().year(year).month(month).date(1).add(index, "day");
    return {
      dayjs: date,
      date: date.date(),
      weekday: date.format("dd"),
      isSunday: date.day() === 0,
    };
  });
}

/**
 * Генерирует массив дат (строки YYYY-MM-DD) для заказа
 * @param {Object} order - заказ с rentalStartDate и rentalEndDate
 * @returns {Array<string>} массив дат в формате YYYY-MM-DD
 */
export function buildOrderDateRange(order) {
  if (!order?.rentalStartDate || !order?.rentalEndDate) return [];

  const startDate = dayjs
    .utc(order.rentalStartDate)
    .tz(BUSINESS_TZ)
    .startOf("day");
  const endDate = dayjs
    .utc(order.rentalEndDate)
    .tz(BUSINESS_TZ)
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
 * Возвращает индекс текущего дня в массиве days
 * @param {Array} days - массив дней календаря
 * @returns {number} индекс текущего дня или -1
 */
export function getTodayIndex(days) {
  const today = dayjs();
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

function getTheadFirstRowCells(table) {
  if (!table) return null;
  const thead = table.tHead || table.getElementsByTagName("thead")[0];
  if (!thead?.rows?.length) return null;
  return thead.rows[0].cells;
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
 * Горизонтально центрирует колонку «сегодня» во viewport скролла.
 * @param {Object} params
 * @param {HTMLElement} params.container — MUI TableContainer root (scroll element)
 * @param {number} params.todayIndex — индекс сегодня в массиве days
 */
export function scrollCalendarToToday({ container, todayIndex }) {
  if (!container || typeof todayIndex !== "number" || todayIndex < 0) return;

  try {
    const table = findTableInScrollContainer(container);
    if (!table) return;

    const cells = getTheadFirstRowCells(table);
    if (!cells || cells.length === 0) return;

    const todayColumnIndex = 1 + todayIndex;
    if (todayColumnIndex < 1 || todayColumnIndex >= cells.length) return;

    const containerWidth = container.clientWidth;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return;

    const columnLeft = sumCellWidthsBeforeIndex(cells, todayColumnIndex);
    if (columnLeft == null) return;

    const todayCell = cells[todayColumnIndex];
    const cellWidth = todayCell?.offsetWidth ?? 0;
    if (!Number.isFinite(cellWidth) || cellWidth <= 0) return;

    const columnCenter = columnLeft + cellWidth / 2;
    const maxScroll = Math.max(
      0,
      (container.scrollWidth || 0) - containerWidth
    );
    let targetScrollLeft = columnCenter - containerWidth / 2;
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
 * @param {'15d'|'1m'|'2m'|null|undefined} [params.calendarDayRange]
 * @returns {{ days: Array, todayIndex: number }}
 */
export function useCalendarDays({
  month,
  year,
  viewMode,
  rangeDirection,
  calendarDayRange,
}) {
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

  const todayIndex = useMemo(() => getTodayIndex(days), [days]);

  return { days, todayIndex };
}

/**
 * Хук для автоматического скролла к текущему дню на мобильных устройствах
 * @param {Object} params
 * @param {Array} params.days - массив дней календаря
 * @param {number} params.todayIndex - индекс текущего дня
 * @param {{ current: HTMLElement | null }} params.containerRef - ref на MUI TableContainer
 */
export function useMobileCalendarScroll({
  days,
  todayIndex,
  containerRef,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled || !isPhoneViewport()) return;

    const runScroll = () => {
      const container = containerRef?.current;
      if (!container) return;
      scrollCalendarToToday({ container, todayIndex });
    };

    /** After timeout + rAF so thead cell widths are settled (fonts, hydration). */
    const scheduleScroll = () =>
      setTimeout(() => {
        requestAnimationFrame(runScroll);
      }, 50);

    const t = scheduleScroll();

    const onResize = () => scheduleScroll();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [todayIndex, days, containerRef, enabled]);
}
