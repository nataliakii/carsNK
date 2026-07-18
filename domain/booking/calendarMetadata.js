/**
 * Calendar Metadata Preparation
 *
 * Подготавливает метаданные для админского календаря.
 * Для каждой даты определяет:
 * - blocking (confirmedBusiness или confirmedInternal)
 * - warning (pendingBusiness)
 * - informational (pendingInternal)
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { BUSINESS_TZ } from "./businessTime";
import { getOrderOwnership } from "./orderOwnership";
import { groupOrdersForAdmin, getDateMetadata } from "./groupOrdersForAdmin";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);

/**
 * @typedef {Object} CalendarDateInfo
 * @property {string} dateStr - Дата в формате YYYY-MM-DD
 * @property {string} blockingLevel - "blocking" | "warning" | "informational" | "free"
 * @property {boolean} isBlocking - Полная блокировка (confirmed)
 * @property {boolean} isWarning - Есть заявка клиента (pendingBusiness)
 * @property {boolean} isInformational - Есть внутренняя заявка
 * @property {boolean} isFree - Свободно
 * @property {Array} orders - Заказы на эту дату
 * @property {Object|null} priorityOrder - Приоритетный заказ
 * @property {Object} edge - Информация о граничных условиях (start/end)
 */

/**
 * Получает все даты в диапазоне заказа
 *
 * @param {Object} order
 * @returns {string[]} Массив дат в формате YYYY-MM-DD
 */
export function getOrderDateRange(order) {
  if (!order.rentalStartDate || !order.rentalEndDate) {
    return [];
  }

  const dates = [];
  let current = dayjs(order.rentalStartDate).tz(BUSINESS_TZ).startOf("day");
  const end = dayjs(order.rentalEndDate).tz(BUSINESS_TZ).startOf("day");

  while (current.isSameOrBefore(end, "day")) {
    dates.push(current.format("YYYY-MM-DD"));
    current = current.add(1, "day");
  }

  return dates;
}

/**
 * Строит карту метаданных для календаря
 *
 * @param {Array} orders - Все заказы машины
 * @returns {Map<string, CalendarDateInfo>}
 */
export function buildCalendarMetadata(orders) {
  const dateOrdersMap = new Map();

  // Шаг 1: Группируем заказы по датам
  orders.forEach((order) => {
    const dates = getOrderDateRange(order);
    const startDate = dayjs(order.rentalStartDate).tz(BUSINESS_TZ).format("YYYY-MM-DD");
    const endDate = dayjs(order.rentalEndDate).tz(BUSINESS_TZ).format("YYYY-MM-DD");

    dates.forEach((dateStr) => {
      if (!dateOrdersMap.has(dateStr)) {
        dateOrdersMap.set(dateStr, []);
      }

      // Добавляем заказ с дополнительной информацией о границах
      dateOrdersMap.get(dateStr).push({
        ...order,
        _isStartDate: dateStr === startDate,
        _isEndDate: dateStr === endDate,
        _ownership: getOrderOwnership(order),
      });
    });
  });

  // Шаг 2: Создаём метаданные для каждой даты
  const metadataMap = new Map();

  dateOrdersMap.forEach((ordersOnDate, dateStr) => {
    const metadata = getDateMetadata(ordersOnDate);

    // Добавляем информацию о граничных условиях
    const edgeInfo = {
      hasStartingOrders: ordersOnDate.some((o) => o._isStartDate),
      hasEndingOrders: ordersOnDate.some((o) => o._isEndDate),
      startingOrders: ordersOnDate.filter((o) => o._isStartDate),
      endingOrders: ordersOnDate.filter((o) => o._isEndDate),
    };

    // Определяем приоритетный заказ
    const groups = groupOrdersForAdmin(ordersOnDate, {
      includeCancelled: false,
      includeStats: false,
    });

    let priorityOrder = null;
    if (groups.confirmedBusiness.length > 0) {
      priorityOrder = groups.confirmedBusiness[0];
    } else if (groups.confirmedInternal.length > 0) {
      priorityOrder = groups.confirmedInternal[0];
    } else if (groups.pendingBusiness.length > 0) {
      priorityOrder = groups.pendingBusiness[0];
    } else if (groups.pendingInternal.length > 0) {
      priorityOrder = groups.pendingInternal[0];
    }

    metadataMap.set(dateStr, {
      dateStr,
      ...metadata,
      edge: edgeInfo,
      priorityOrder,
      groups,
    });
  });

  return metadataMap;
}

/**
 * Получает метаданные для конкретной даты
 *
 * @param {Map} metadataMap - Карта метаданных
 * @param {string} dateStr - Дата в формате YYYY-MM-DD
 * @returns {CalendarDateInfo|null}
 */
export function getMetadataForDate(metadataMap, dateStr) {
  return metadataMap.get(dateStr) || null;
}

/**
 * Проверяет, заблокирована ли дата
 *
 * @param {Map} metadataMap
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isDateBlocked(metadataMap, dateStr) {
  const metadata = metadataMap.get(dateStr);
  return metadata?.isBlocking || false;
}

/**
 * Проверяет, есть ли предупреждение на дату
 *
 * @param {Map} metadataMap
 * @param {string} dateStr
 * @returns {boolean}
 */
export function hasDateWarning(metadataMap, dateStr) {
  const metadata = metadataMap.get(dateStr);
  return metadata?.isWarning || false;
}

/**
 * Получает сводку по диапазону дат
 *
 * @param {Map} metadataMap
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Object}
 */
export function getRangeSummary(metadataMap, startDate, endDate) {
  const summary = {
    blockedDates: [],
    warningDates: [],
    informationalDates: [],
    freeDates: [],
    hasBlocking: false,
    hasWarning: false,
    hasInformational: false,
    totalDays: 0,
  };

  let current = dayjs(startDate);
  const end = dayjs(endDate);

  while (current.isSameOrBefore(end, "day")) {
    const dateStr = current.format("YYYY-MM-DD");
    const metadata = metadataMap.get(dateStr);

    summary.totalDays++;

    if (metadata?.isBlocking) {
      summary.blockedDates.push(dateStr);
      summary.hasBlocking = true;
    } else if (metadata?.isWarning) {
      summary.warningDates.push(dateStr);
      summary.hasWarning = true;
    } else if (metadata?.isInformational) {
      summary.informationalDates.push(dateStr);
      summary.hasInformational = true;
    } else {
      summary.freeDates.push(dateStr);
    }

    current = current.add(1, "day");
  }

  return summary;
}

/**
 * Экспортируем для использования в календаре
 */
export function prepareCalendarData(orders, carId) {
  // Фильтруем заказы для машины
  const carOrders = orders.filter((order) => {
    const orderCarId = order.car?._id || order.car;
    return orderCarId?.toString() === carId?.toString();
  });

  // Строим метаданные
  const metadata = buildCalendarMetadata(carOrders);

  // Группируем заказы
  const groups = groupOrdersForAdmin(carOrders);

  return {
    metadata,
    groups,
    orders: carOrders,
  };
}

