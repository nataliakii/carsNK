/**
 * Утилиты для работы с временем в бизнес-таймзоне (Греция)
 *
 * ВАЖНО: Все даты и время в системе интерпретируются как греческое время,
 * независимо от того, где находится пользователь (Австралия, США и т.д.)
 *
 * Принцип "как у авиабилетов" — время всегда локальное для места получения машины.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Бизнес-таймзона (где находятся машины)
 */
export const BUSINESS_TZ = "Europe/Athens";

/**
 * Форматирует дату из БД для отображения пользователю
 * ВСЕГДА в греческой таймзоне, независимо от браузера
 *
 * @param {Date|string} dbDate - Дата из базы данных (UTC)
 * @param {string} format - Формат вывода (по умолчанию "DD.MM.YYYY")
 * @returns {string} Отформатированная дата в греческой таймзоне
 *
 * @example
 * // В БД: "2026-01-15T12:00:00Z" (UTC)
 * formatDate(order.rentalStartDate, "DD.MM.YY")
 * // Результат: "15.01.26" (Athens)
 */
export function formatDate(dbDate, format = "DD.MM.YYYY") {
  if (!dbDate) return "";
  return dayjs(dbDate).tz(BUSINESS_TZ).format(format);
}

/**
 * Форматирует время из БД для отображения пользователю
 * ВСЕГДА в греческой таймзоне, независимо от браузера
 *
 * @param {Date|string} dbDate - Дата/время из базы данных (UTC)
 * @param {string} format - Формат вывода (по умолчанию "HH:mm")
 * @returns {string} Отформатированное время в греческой таймзоне
 *
 * @example
 * // В БД: "2026-01-15T12:00:00Z" (UTC = 14:00 Athens зимой)
 * formatTime(order.timeIn)
 * // Результат: "14:00" (Athens)
 */
export function formatTime(dbDate, format = "HH:mm") {
  if (!dbDate) return "";
  return dayjs(dbDate).tz(BUSINESS_TZ).format(format);
}

/**
 * Форматирует дату+время из БД для отображения
 *
 * @param {Date|string} dbDate - Дата/время из базы данных (UTC)
 * @param {string} format - Формат вывода (по умолчанию "DD.MM.YYYY HH:mm")
 * @returns {string} Отформатированная дата+время в греческой таймзоне
 */
export function formatDateTime(dbDate, format = "DD.MM.YYYY HH:mm") {
  if (!dbDate) return "";
  return dayjs(dbDate).tz(BUSINESS_TZ).format(format);
}

/**
 * Парсит введённое пользователем время как греческое
 * НЕ использует браузерную таймзону!
 *
 * @param {string} dateStr - Дата в формате "YYYY-MM-DD"
 * @param {string} timeStr - Время в формате "HH:mm"
 * @returns {dayjs.Dayjs} dayjs объект в греческой таймзоне
 *
 * @example
 * // Пользователь в Австралии вводит 14:00
 * parseBusinessTime("2026-01-15", "14:00")
 * // Результат: dayjs объект = 14:00 Athens (НЕ 14:00 Sydney!)
 */
export function parseBusinessTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return dayjs.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", BUSINESS_TZ);
}

/**
 * Конвертирует греческое время в UTC для сохранения в БД
 *
 * @param {dayjs.Dayjs} businessDayjs - dayjs объект в греческой таймзоне
 * @returns {Date} JavaScript Date объект в UTC для MongoDB
 *
 * @example
 * const greekTime = parseBusinessTime("2026-01-15", "14:00");
 * const utcDate = toStorageUTC(greekTime);
 * // Результат: Date("2026-01-15T12:00:00Z") — для сохранения в БД
 */
export function toStorageUTC(businessDayjs) {
  if (!businessDayjs) return null;
  return businessDayjs.utc().toDate();
}

/**
 * Возвращает dayjs объект в греческой таймзоне из значения БД
 *
 * @param {Date|string} dbDate - Дата из базы данных (UTC)
 * @returns {dayjs.Dayjs|null} dayjs объект в греческой таймзоне
 *
 * @example
 * const greekTime = fromStorage(order.timeIn);
 * greekTime.format("HH:mm") // "14:00" (Athens)
 */
export function fromStorage(dbDate) {
  if (!dbDate) return null;
  return dayjs(dbDate).tz(BUSINESS_TZ);
}

/**
 * Проверяет, является ли дата "сегодня" в греческой таймзоне
 *
 * @param {Date|string} dbDate - Дата из базы данных
 * @returns {boolean}
 */
export function isToday(dbDate) {
  if (!dbDate) return false;
  const dateInAthens = dayjs(dbDate).tz(BUSINESS_TZ);
  const todayInAthens = dayjs().tz(BUSINESS_TZ);
  return dateInAthens.isSame(todayInAthens, "day");
}

/**
 * Проверяет, находится ли дата в прошлом (по греческому времени)
 *
 * @param {Date|string} dbDate - Дата из базы данных
 * @returns {boolean}
 */
export function isPast(dbDate) {
  if (!dbDate) return false;
  const dateInAthens = dayjs(dbDate).tz(BUSINESS_TZ);
  const nowInAthens = dayjs().tz(BUSINESS_TZ);
  return dateInAthens.isBefore(nowInAthens, "day");
}

/**
 * Возвращает текущую дату в греческой таймзоне
 *
 * @returns {dayjs.Dayjs}
 */
export function nowInBusiness() {
  return dayjs().tz(BUSINESS_TZ);
}

/**
 * Сравнивает две даты по дням в греческой таймзоне
 *
 * @param {Date|string} date1
 * @param {Date|string} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = dayjs(date1).tz(BUSINESS_TZ);
  const d2 = dayjs(date2).tz(BUSINESS_TZ);
  return d1.isSame(d2, "day");
}

/**
 * Форматирует диапазон дат
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {string} format
 * @returns {string}
 *
 * @example
 * formatDateRange(order.rentalStartDate, order.rentalEndDate)
 * // "15.01.26 - 20.01.26"
 */
export function formatDateRange(startDate, endDate, format = "DD.MM.YY") {
  if (!startDate || !endDate) return "";
  return `${formatDate(startDate, format)} - ${formatDate(endDate, format)}`;
}

/**
 * Для отладки: показывает все представления даты
 *
 * @param {string} label - Метка для логов
 * @param {Date|string} dbDate - Дата из БД
 */
export function debugTime(label, dbDate) {
  if (!dbDate) {
    console.log(`[TIMEZONE DEBUG] ${label}: null/undefined`);
    return;
  }
  console.log(`[TIMEZONE DEBUG] ${label}:`);
  console.log(`  Raw value: ${dbDate}`);
  console.log(`  As UTC: ${dayjs(dbDate).utc().format("YYYY-MM-DD HH:mm:ss Z")}`);
  console.log(
    `  As Athens: ${dayjs(dbDate).tz(BUSINESS_TZ).format("YYYY-MM-DD HH:mm:ss Z")}`
  );
  console.log(`  Display date: ${formatDate(dbDate)}`);
  console.log(`  Display time: ${formatTime(dbDate)}`);
}

