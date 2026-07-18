/**
 * Group Orders for Admin View
 *
 * Группирует заказы для админского представления по:
 * - confirmed + my_order
 * - pending + my_order
 *
 * Группы:
 * - confirmedBusiness — подтверждённые бизнес-заказы (клиенты)
 * - confirmedInternal — подтверждённые внутренние (ТО, бронь компании)
 * - pendingBusiness — ожидающие бизнес-заказы (заявки клиентов)
 * - pendingInternal — ожидающие внутренние
 * - cancelled — отменённые (опционально)
 */

import {
  getOrderOwnership,
  isBusinessOrder,
  isInternalOrder,
  isConfirmedOrder,
  isPendingOrder,
  isCancelledOrder,
} from "./orderOwnership";

/**
 * @typedef {Object} GroupedOrders
 * @property {Array} confirmedBusiness - Подтверждённые бизнес-заказы
 * @property {Array} confirmedInternal - Подтверждённые внутренние заказы
 * @property {Array} pendingBusiness - Ожидающие бизнес-заказы
 * @property {Array} pendingInternal - Ожидающие внутренние заказы
 * @property {Array} cancelled - Отменённые заказы
 * @property {Object} stats - Статистика по группам
 */

/**
 * Группирует массив заказов для админского представления
 *
 * @param {Array} orders - Массив заказов
 * @param {Object} [options] - Опции
 * @param {boolean} [options.includeCancelled=false] - Включать отменённые
 * @param {boolean} [options.includeStats=true] - Добавлять статистику
 * @returns {GroupedOrders}
 *
 * @example
 * const groups = groupOrdersForAdmin(orders);
 * console.log(groups.confirmedBusiness); // [{...}, {...}]
 * console.log(groups.stats.total); // 42
 */
export function groupOrdersForAdmin(orders, options = {}) {
  const { includeCancelled = false, includeStats = true } = options;

  const result = {
    confirmedBusiness: [],
    confirmedInternal: [],
    pendingBusiness: [],
    pendingInternal: [],
    cancelled: [],
  };

  if (!Array.isArray(orders)) {
    if (includeStats) {
      result.stats = createEmptyStats();
    }
    return result;
  }

  orders.forEach((order) => {
    const { ownership, confirmation } = getOrderOwnership(order);

    // Отменённые в отдельную группу (опционально)
    if (confirmation === "cancelled") {
      if (includeCancelled) {
        result.cancelled.push(order);
      }
      return;
    }

    // Группируем по ownership + confirmation
    if (confirmation === "confirmed") {
      if (ownership === "business") {
        result.confirmedBusiness.push(order);
      } else {
        result.confirmedInternal.push(order);
      }
    } else if (confirmation === "pending") {
      if (ownership === "business") {
        result.pendingBusiness.push(order);
      } else {
        result.pendingInternal.push(order);
      }
    }
  });

  // Добавляем статистику
  if (includeStats) {
    result.stats = {
      confirmedBusiness: result.confirmedBusiness.length,
      confirmedInternal: result.confirmedInternal.length,
      pendingBusiness: result.pendingBusiness.length,
      pendingInternal: result.pendingInternal.length,
      cancelled: result.cancelled.length,
      totalConfirmed:
        result.confirmedBusiness.length + result.confirmedInternal.length,
      totalPending:
        result.pendingBusiness.length + result.pendingInternal.length,
      totalBusiness:
        result.confirmedBusiness.length + result.pendingBusiness.length,
      totalInternal:
        result.confirmedInternal.length + result.pendingInternal.length,
      total:
        result.confirmedBusiness.length +
        result.confirmedInternal.length +
        result.pendingBusiness.length +
        result.pendingInternal.length +
        result.cancelled.length,
    };
  }

  return result;
}

/**
 * Создаёт пустую статистику
 */
function createEmptyStats() {
  return {
    confirmedBusiness: 0,
    confirmedInternal: 0,
    pendingBusiness: 0,
    pendingInternal: 0,
    cancelled: 0,
    totalConfirmed: 0,
    totalPending: 0,
    totalBusiness: 0,
    totalInternal: 0,
    total: 0,
  };
}

/**
 * @typedef {Object} DateMetadata
 * @property {boolean} hasConfirmedBusiness - Есть подтверждённый бизнес-заказ
 * @property {boolean} hasConfirmedInternal - Есть подтверждённый внутренний заказ
 * @property {boolean} hasPendingBusiness - Есть ожидающий бизнес-заказ
 * @property {boolean} hasPendingInternal - Есть ожидающий внутренний заказ
 * @property {string} blockingLevel - "blocking" | "warning" | "informational" | "free"
 * @property {Array} orders - Заказы на эту дату
 */

/**
 * Получает метаданные для конкретной даты
 *
 * Уровни блокировки:
 * - blocking: confirmedBusiness или confirmedInternal (полная блокировка)
 * - warning: pendingBusiness (есть заявка клиента)
 * - informational: pendingInternal (внутренняя заявка)
 * - free: нет заказов
 *
 * @param {Array} ordersOnDate - Заказы, попадающие на эту дату
 * @returns {DateMetadata}
 */
export function getDateMetadata(ordersOnDate) {
  const groups = groupOrdersForAdmin(ordersOnDate, {
    includeCancelled: false,
    includeStats: false,
  });

  const hasConfirmedBusiness = groups.confirmedBusiness.length > 0;
  const hasConfirmedInternal = groups.confirmedInternal.length > 0;
  const hasPendingBusiness = groups.pendingBusiness.length > 0;
  const hasPendingInternal = groups.pendingInternal.length > 0;

  // Определяем уровень блокировки
  let blockingLevel = "free";

  if (hasConfirmedBusiness || hasConfirmedInternal) {
    blockingLevel = "blocking";
  } else if (hasPendingBusiness) {
    blockingLevel = "warning";
  } else if (hasPendingInternal) {
    blockingLevel = "informational";
  }

  return {
    hasConfirmedBusiness,
    hasConfirmedInternal,
    hasPendingBusiness,
    hasPendingInternal,
    blockingLevel,
    orders: ordersOnDate,
    // Детальная информация для UI (без цветов)
    isBlocking: blockingLevel === "blocking",
    isWarning: blockingLevel === "warning",
    isInformational: blockingLevel === "informational",
    isFree: blockingLevel === "free",
  };
}

/**
 * Создаёт Map метаданных для диапазона дат
 *
 * @param {Array} orders - Все заказы
 * @param {Function} getOrderDates - Функция для получения дат заказа
 * @returns {Map<string, DateMetadata>} Map: dateStr → metadata
 *
 * @example
 * const dateMetadataMap = buildDateMetadataMap(orders, (order) => {
 *   // Возвращаем массив дат в формате YYYY-MM-DD
 *   return getDatesInRange(order.rentalStartDate, order.rentalEndDate);
 * });
 *
 * const metadata = dateMetadataMap.get("2026-01-15");
 * console.log(metadata.blockingLevel); // "blocking"
 */
export function buildDateMetadataMap(orders, getOrderDates) {
  const dateOrdersMap = new Map();

  // Группируем заказы по датам
  orders.forEach((order) => {
    const dates = getOrderDates(order);
    dates.forEach((dateStr) => {
      if (!dateOrdersMap.has(dateStr)) {
        dateOrdersMap.set(dateStr, []);
      }
      dateOrdersMap.get(dateStr).push(order);
    });
  });

  // Создаём метаданные для каждой даты
  const metadataMap = new Map();
  dateOrdersMap.forEach((ordersOnDate, dateStr) => {
    metadataMap.set(dateStr, getDateMetadata(ordersOnDate));
  });

  return metadataMap;
}

/**
 * Фильтрует заказы для конкретной машины и группирует
 *
 * @param {Array} orders - Все заказы
 * @param {string} carId - ID машины
 * @returns {GroupedOrders}
 */
export function groupOrdersByCarForAdmin(orders, carId) {
  const carOrders = orders.filter((order) => {
    const orderCarId = order.car?._id || order.car;
    return orderCarId?.toString() === carId?.toString();
  });

  return groupOrdersForAdmin(carOrders);
}

/**
 * Получает приоритетный заказ для даты (для отображения)
 *
 * Приоритет:
 * 1. confirmedBusiness (самый важный — клиент)
 * 2. confirmedInternal (внутренняя блокировка)
 * 3. pendingBusiness (заявка клиента)
 * 4. pendingInternal (внутренняя заявка)
 *
 * @param {Array} ordersOnDate - Заказы на дату
 * @returns {Object|null} Приоритетный заказ или null
 */
export function getPriorityOrder(ordersOnDate) {
  const groups = groupOrdersForAdmin(ordersOnDate, {
    includeCancelled: false,
    includeStats: false,
  });

  if (groups.confirmedBusiness.length > 0) {
    return groups.confirmedBusiness[0];
  }
  if (groups.confirmedInternal.length > 0) {
    return groups.confirmedInternal[0];
  }
  if (groups.pendingBusiness.length > 0) {
    return groups.pendingBusiness[0];
  }
  if (groups.pendingInternal.length > 0) {
    return groups.pendingInternal[0];
  }

  return null;
}

