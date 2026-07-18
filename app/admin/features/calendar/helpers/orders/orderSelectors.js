/**
 * Селекторы для работы с заказами
 */
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { formatDate } from "@utils/businessTime";

dayjs.extend(isBetween);

/**
 * Возвращает все заказы, покрывающие указанную дату
 * @param {Array} carOrders - массив заказов
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {Array} массив заказов
 */
export function getOrdersForDate(carOrders, dateStr) {
  return carOrders.filter((order) => {
    // Используем бизнес-таймзону для корректного сравнения
    const rentalStart = formatDate(order.rentalStartDate, "YYYY-MM-DD");
    const rentalEnd = formatDate(order.rentalEndDate, "YYYY-MM-DD");
    return dayjs(dateStr).isBetween(rentalStart, rentalEnd, "day", "[]");
  });
}

/**
 * Получает выбранный заказ по ID
 * @param {Array} carOrders - массив заказов
 * @param {string} selectedOrderId - ID выбранного заказа
 * @returns {Object|null}
 */
export function getSelectedOrder(carOrders, selectedOrderId) {
  if (!selectedOrderId) return null;
  return carOrders.find((o) => o._id === selectedOrderId) || null;
}

