/**
 * Conflict Validation with Extended Metadata
 *
 * Расширенная валидация конфликтов с метаданными:
 * - confirmation type
 * - ownership (business | internal)
 * - origin (client | admin | superadmin)
 *
 * Не меняет правила блокировки — только добавляет метаданные.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isBetween from "dayjs/plugin/isBetween";
import { BUSINESS_TZ, formatDate, formatTime } from "./businessTime";
import { getOrderOwnership } from "./orderOwnership";
import { groupOrdersForAdmin, getDateMetadata } from "./groupOrdersForAdmin";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

/**
 * @typedef {Object} ConflictInfo
 * @property {string} type - "confirmed" | "pending" | "time"
 * @property {string} ownership - "business" | "internal"
 * @property {string} origin - "client" | "admin" | "superadmin"
 * @property {string} confirmation - "confirmed" | "pending"
 * @property {Object} order - Конфликтующий заказ
 * @property {string} date - Дата конфликта (YYYY-MM-DD)
 * @property {string|null} time - Время конфликта (HH:mm) если time conflict
 * @property {string} message - Человекочитаемое описание
 * @property {boolean} isBlocking - Блокирует ли создание заказа
 * @property {boolean} canBeOverridden - Может ли быть переопределено (superadmin)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Можно ли создать заказ
 * @property {boolean} hasBlockingConflict - Есть ли блокирующий конфликт
 * @property {boolean} hasWarnings - Есть ли предупреждения
 * @property {Array<ConflictInfo>} conflicts - Все конфликты
 * @property {Array<ConflictInfo>} blockingConflicts - Только блокирующие
 * @property {Array<ConflictInfo>} warnings - Только предупреждения
 * @property {Object} summary - Сводка по типам
 */

/**
 * Валидирует конфликты с расширенными метаданными
 *
 * @param {Object} params
 * @param {Array} params.existingOrders - Существующие заказы машины
 * @param {string} params.newStartDate - Дата начала нового заказа
 * @param {string} params.newEndDate - Дата окончания нового заказа
 * @param {string} [params.newTimeIn] - Время начала (опционально)
 * @param {string} [params.newTimeOut] - Время окончания (опционально)
 * @param {string} [params.excludeOrderId] - ID заказа для исключения (при редактировании)
 * @returns {ValidationResult}
 */
export function validateConflictsExtended({
  existingOrders,
  newStartDate,
  newEndDate,
  newTimeIn,
  newTimeOut,
  excludeOrderId,
}) {
  const conflicts = [];

  const newStart = dayjs(newStartDate).tz(BUSINESS_TZ);
  const newEnd = dayjs(newEndDate).tz(BUSINESS_TZ);

  // Фильтруем заказы (исключаем редактируемый)
  const ordersToCheck = existingOrders.filter((order) => {
    if (excludeOrderId && order._id?.toString() === excludeOrderId) {
      return false;
    }
    return true;
  });

  ordersToCheck.forEach((order) => {
    const orderStart = dayjs(order.rentalStartDate).tz(BUSINESS_TZ);
    const orderEnd = dayjs(order.rentalEndDate).tz(BUSINESS_TZ);
    const ownership = getOrderOwnership(order);

    // Проверяем пересечение диапазонов
    const hasDateOverlap =
      newStart.isBefore(orderEnd, "day") || newStart.isSame(orderEnd, "day");
    const hasDateOverlap2 =
      newEnd.isAfter(orderStart, "day") || newEnd.isSame(orderStart, "day");

    if (!hasDateOverlap || !hasDateOverlap2) {
      return; // Нет пересечения
    }

    // Находим конкретные даты конфликта
    let current = newStart.clone();
    while (current.isSameOrBefore(newEnd, "day")) {
      const dateStr = current.format("YYYY-MM-DD");

      // Проверяем, попадает ли эта дата в диапазон существующего заказа
      const isInOrderRange =
        current.isSameOrAfter(orderStart, "day") &&
        current.isSameOrBefore(orderEnd, "day");

      if (isInOrderRange) {
        // Определяем тип конфликта
        const isStartDate = dateStr === orderStart.format("YYYY-MM-DD");
        const isEndDate = dateStr === orderEnd.format("YYYY-MM-DD");

        // Для граничных дат проверяем время
        const isTimeConflict = checkTimeConflict({
          dateStr,
          newStart,
          newEnd,
          orderStart,
          orderEnd,
          newTimeIn,
          newTimeOut,
          order,
          isStartDate,
          isEndDate,
        });

        // Определяем, блокирующий ли это конфликт
        const isBlocking = ownership.confirmation === "confirmed";
        const canBeOverridden = isBlocking; // Суперадмин может переопределить только confirmed

        const conflictInfo = {
          type: isTimeConflict
            ? "time"
            : ownership.confirmation === "confirmed"
            ? "confirmed"
            : "pending",
          ownership: ownership.ownership,
          origin: ownership.origin,
          confirmation: ownership.confirmation,
          order: {
            _id: order._id,
            customerName: order.customerName,
            phone: order.phone,
            rentalStartDate: order.rentalStartDate,
            rentalEndDate: order.rentalEndDate,
            timeIn: order.timeIn,
            timeOut: order.timeOut,
            confirmed: order.confirmed,
            my_order: order.my_order,
          },
          date: dateStr,
          time: isTimeConflict ? formatTime(order.timeIn) : null,
          message: generateConflictMessage({
            ownership,
            dateStr,
            order,
            isTimeConflict,
          }),
          isBlocking,
          canBeOverridden,
        };

        conflicts.push(conflictInfo);
      }

      current = current.add(1, "day");
    }
  });

  // Убираем дубликаты (один заказ может создать несколько конфликтов на разные даты)
  const uniqueConflicts = deduplicateConflicts(conflicts);

  // Разделяем на blocking и warnings
  const blockingConflicts = uniqueConflicts.filter((c) => c.isBlocking);
  const warnings = uniqueConflicts.filter((c) => !c.isBlocking);

  // Создаём сводку
  const summary = {
    confirmedBusinessConflicts: uniqueConflicts.filter(
      (c) => c.confirmation === "confirmed" && c.ownership === "business"
    ).length,
    confirmedInternalConflicts: uniqueConflicts.filter(
      (c) => c.confirmation === "confirmed" && c.ownership === "internal"
    ).length,
    pendingBusinessConflicts: uniqueConflicts.filter(
      (c) => c.confirmation === "pending" && c.ownership === "business"
    ).length,
    pendingInternalConflicts: uniqueConflicts.filter(
      (c) => c.confirmation === "pending" && c.ownership === "internal"
    ).length,
    timeConflicts: uniqueConflicts.filter((c) => c.type === "time").length,
    totalConflicts: uniqueConflicts.length,
    totalBlocking: blockingConflicts.length,
    totalWarnings: warnings.length,
  };

  return {
    isValid: blockingConflicts.length === 0,
    hasBlockingConflict: blockingConflicts.length > 0,
    hasWarnings: warnings.length > 0,
    conflicts: uniqueConflicts,
    blockingConflicts,
    warnings,
    summary,
  };
}

/**
 * Проверяет конфликт времени на граничных датах
 */
function checkTimeConflict({
  dateStr,
  newStart,
  newEnd,
  orderStart,
  orderEnd,
  newTimeIn,
  newTimeOut,
  order,
  isStartDate,
  isEndDate,
}) {
  // Если нет времени — не можем проверить
  if (!newTimeIn || !newTimeOut || !order.timeIn || !order.timeOut) {
    return false;
  }

  // Конфликт на граничных датах
  const newStartDateStr = newStart.format("YYYY-MM-DD");
  const newEndDateStr = newEnd.format("YYYY-MM-DD");

  // Случай 1: Новый заказ начинается в день окончания существующего
  if (newStartDateStr === orderEnd.format("YYYY-MM-DD")) {
    const existingEndTime = dayjs(order.timeOut).tz(BUSINESS_TZ);
    const newStartTime = dayjs(newTimeIn).tz(BUSINESS_TZ);

    // Конфликт если новый начинается раньше, чем заканчивается существующий
    if (
      newStartTime.isBefore(existingEndTime) ||
      newStartTime.isSame(existingEndTime)
    ) {
      return true;
    }
  }

  // Случай 2: Новый заказ заканчивается в день начала существующего
  if (newEndDateStr === orderStart.format("YYYY-MM-DD")) {
    const existingStartTime = dayjs(order.timeIn).tz(BUSINESS_TZ);
    const newEndTime = dayjs(newTimeOut).tz(BUSINESS_TZ);

    // Конфликт если новый заканчивается позже, чем начинается существующий
    if (
      newEndTime.isAfter(existingStartTime) ||
      newEndTime.isSame(existingStartTime)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Генерирует сообщение о конфликте
 */
function generateConflictMessage({ ownership, dateStr, order, isTimeConflict }) {
  const dateFormatted = formatDate(dateStr, "DD.MM.YYYY");

  const ownershipLabels = {
    business: "клиентским заказом",
    internal: "внутренним бронированием",
  };

  const confirmationLabels = {
    confirmed: "подтверждённым",
    pending: "ожидающим подтверждения",
  };

  if (isTimeConflict) {
    return `Конфликт времени ${dateFormatted} с ${confirmationLabels[ownership.confirmation]} ${ownershipLabels[ownership.ownership]}`;
  }

  if (ownership.confirmation === "confirmed") {
    return `Дата ${dateFormatted} занята ${confirmationLabels[ownership.confirmation]} ${ownershipLabels[ownership.ownership]}`;
  }

  return `На ${dateFormatted} есть ${ownershipLabels[ownership.ownership]} (${confirmationLabels[ownership.confirmation]})`;
}

/**
 * Удаляет дубликаты конфликтов (оставляет уникальные по orderId + date)
 */
function deduplicateConflicts(conflicts) {
  const seen = new Set();
  return conflicts.filter((conflict) => {
    const key = `${conflict.order._id}-${conflict.date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Проверяет, может ли суперадмин переопределить конфликты
 *
 * @param {ValidationResult} validationResult
 * @returns {boolean}
 */
export function canSuperadminOverride(validationResult) {
  // Суперадмин может переопределить любые confirmed конфликты
  return validationResult.blockingConflicts.every((c) => c.canBeOverridden);
}

/**
 * Генерирует предупреждение для суперадмина перед override
 *
 * @param {ValidationResult} validationResult
 * @returns {string}
 */
export function generateOverrideWarning(validationResult) {
  const { blockingConflicts } = validationResult;

  if (blockingConflicts.length === 0) {
    return "";
  }

  const businessConflicts = blockingConflicts.filter(
    (c) => c.ownership === "business"
  );
  const internalConflicts = blockingConflicts.filter(
    (c) => c.ownership === "internal"
  );

  let warning = "⚠️ ВНИМАНИЕ: Принудительное создание заказа!\n\n";

  if (businessConflicts.length > 0) {
    warning += `Будет конфликт с ${businessConflicts.length} клиентским(и) заказом(ами):\n`;
    businessConflicts.forEach((c) => {
      warning += `  • ${c.order.customerName} (${formatDate(c.order.rentalStartDate, "DD.MM")} - ${formatDate(c.order.rentalEndDate, "DD.MM")})\n`;
    });
    warning += "\n";
  }

  if (internalConflicts.length > 0) {
    warning += `Будет конфликт с ${internalConflicts.length} внутренним(и) бронированием(ями)\n`;
  }

  warning +=
    "\nЭто действие будет залогировано. Вы уверены, что хотите продолжить?";

  return warning;
}

/**
 * Создаёт запись аудита для override
 *
 * @param {Object} params
 * @param {string} params.userId - ID суперадмина
 * @param {Object} params.newOrder - Создаваемый заказ
 * @param {ValidationResult} params.validationResult - Результат валидации
 * @returns {Object} Запись аудита
 */
export function createOverrideAuditEntry({
  userId,
  newOrder,
  validationResult,
}) {
  return {
    action: "FORCE_CREATE_ORDER",
    timestamp: new Date(),
    userId,
    orderData: {
      carNumber: newOrder.carNumber,
      rentalStartDate: newOrder.rentalStartDate,
      rentalEndDate: newOrder.rentalEndDate,
      customerName: newOrder.customerName,
    },
    overriddenConflicts: validationResult.blockingConflicts.map((c) => ({
      orderId: c.order._id,
      customerName: c.order.customerName,
      ownership: c.ownership,
      confirmation: c.confirmation,
      conflictDate: c.date,
    })),
    summary: validationResult.summary,
    severity: "high",
  };
}

