/**
 * Флаги для edge-case логики заказов
 */
import { formatDate } from "@utils/businessTime";
import { isDateWithinOrder } from "../dates/dateUtils";

/**
 * Проверяет, попадает ли дата в выбранный заказ
 * @param {Object} selectedOrder - выбранный заказ
 * @param {string} dateStr - дата
 * @returns {boolean}
 */
export function isDateInSelectedOrder(selectedOrder, dateStr) {
  return isDateWithinOrder(selectedOrder, dateStr);
}

/**
 * Получает edge-case флаги для выбранного заказа
 * @param {Object} params
 * @returns {{ hasPreviousOrderEndingHere, hasNextOrderStartingHere, isStartEdgeCase, isEndEdgeCase }}
 */
export function getSelectedOrderEdgeCaseFlags({ selectedOrder, carOrders, dateStr }) {
  if (!selectedOrder) {
    return {
      hasPreviousOrderEndingHere: false,
      hasNextOrderStartingHere: false,
      isStartEdgeCase: false,
      isEndEdgeCase: false,
    };
  }

  // Используем бизнес-таймзону для корректного сравнения дат
  const selectedOrderStart = formatDate(selectedOrder.rentalStartDate, "YYYY-MM-DD");
  const selectedOrderEnd = formatDate(selectedOrder.rentalEndDate, "YYYY-MM-DD");

  const previousOrder = carOrders.find((o) => {
    const rentalEnd = formatDate(o.rentalEndDate, "YYYY-MM-DD");
    return rentalEnd === dateStr && o._id !== selectedOrder._id;
  });

  const nextOrder = carOrders.find((o) => {
    const rentalStart = formatDate(o.rentalStartDate, "YYYY-MM-DD");
    return rentalStart === dateStr && o._id !== selectedOrder._id;
  });

  return {
    hasPreviousOrderEndingHere: Boolean(previousOrder),
    hasNextOrderStartingHere: Boolean(nextOrder),
    previousOrder: previousOrder || null,
    nextOrder: nextOrder || null,
    isStartEdgeCase: selectedOrderStart === dateStr && Boolean(previousOrder),
    isEndEdgeCase: selectedOrderEnd === dateStr && Boolean(nextOrder),
  };
}

