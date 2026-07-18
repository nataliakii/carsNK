/**
 * Флаги для режима перемещения заказа
 */

/**
 * Возвращает флаги первого/последнего дня перемещения
 * @param {Array} selectedOrderDates - массив дат выбранного заказа
 * @param {string} dateStr - дата
 * @returns {{ isFirstMoveDay: boolean, isLastMoveDay: boolean }}
 */
export function getMoveDayFlags(selectedOrderDates, dateStr) {
  if (!selectedOrderDates || selectedOrderDates.length === 0) {
    return { isFirstMoveDay: false, isLastMoveDay: false };
  }
  return {
    isFirstMoveDay: selectedOrderDates[0] === dateStr,
    isLastMoveDay: selectedOrderDates[selectedOrderDates.length - 1] === dateStr,
  };
}

