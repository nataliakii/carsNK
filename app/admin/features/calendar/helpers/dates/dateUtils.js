/**
 * Утилиты для работы с датами заказов
 */
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { formatDate, BUSINESS_TZ } from "@utils/businessTime";

dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Проверяет, попадает ли дата в диапазон заказа
 * @param {Object} order - заказ
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {boolean}
 */
export function isDateWithinOrder(order, dateStr) {
  if (!order) return false;
  // Используем бизнес-таймзону для корректного сравнения дат
  const rentalStart = formatDate(order.rentalStartDate, "YYYY-MM-DD");
  const rentalEnd = formatDate(order.rentalEndDate, "YYYY-MM-DD");
  return dayjs(dateStr).isBetween(rentalStart, rentalEnd, "day", "[]");
}

/**
 * Проверяет, завершён ли заказ (дата окончания раньше сегодня)
 * @param {Object} order - заказ
 * @returns {boolean}
 */
export function isOrderCompleted(order) {
  // Сравниваем в бизнес-таймзоне для корректности
  const endDate = dayjs(order.rentalEndDate).tz(BUSINESS_TZ);
  const now = dayjs().tz(BUSINESS_TZ);
  return endDate.isBefore(now, "day");
}

/**
 * Проверяет, относится ли дата к завершённому заказу
 * @param {Array} carOrders - массив заказов
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {boolean}
 */
export function isDateInCompletedOrder(carOrders, dateStr) {
  return carOrders.some((order) => {
    return isOrderCompleted(order) && isDateWithinOrder(order, dateStr);
  });
}

