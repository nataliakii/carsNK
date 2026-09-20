/**
 * Утилиты для работы с датами заказов
 */
import { businessToday, formatDate } from "@utils/businessTime";

/**
 * Проверяет, попадает ли дата в диапазон заказа
 * @param {Object} order - заказ
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {boolean}
 */
export function isDateWithinOrder(order, dateStr) {
  if (!order) return false;
  // Используем бизнес-таймзону для корректного сравнения дат.
  // YYYY-MM-DD сравнивается лексикографически — это дешевле, чем строить dayjs
  // на каждую ячейку календаря (на 6-месячном периоде их десятки тысяч).
  const rentalStart = formatDate(order.rentalStartDate, "YYYY-MM-DD");
  const rentalEnd = formatDate(order.rentalEndDate, "YYYY-MM-DD");
  if (!rentalStart || !rentalEnd || !dateStr) return false;
  return rentalStart <= dateStr && dateStr <= rentalEnd;
}

/**
 * Проверяет, завершён ли заказ (дата окончания раньше сегодня)
 * @param {Object} order - заказ
 * @returns {boolean}
 */
export function isOrderCompleted(order) {
  // Сравниваем в бизнес-таймзоне для корректности
  const endDate = formatDate(order?.rentalEndDate, "YYYY-MM-DD");
  if (!endDate) return false;
  return endDate < businessToday();
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

