/**
 * Admin Time Adjustment Logic
 *
 * Определяет, разрешено ли изменение времени на основе:
 * - confirmed статуса редактируемого заказа
 * - confirmed статуса другого заказа
 *
 * ПРАВИЛА ПРИОРИТЕТА:
 * 1. confirmed → pending = РАЗРЕШЕНО (с warning)
 * 2. pending → confirmed = ЗАБЛОКИРОВАНО
 * 3. pending → pending = РАЗРЕШЕНО (с сильным warning)
 * 4. confirmed → confirmed = ЗАБЛОКИРОВАНО
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { BUSINESS_TZ, formatTime, formatDate } from "./businessTime";
import { getOrderOwnership } from "./orderOwnership";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Буфер в часах: только из company.bufferTime. Если не передан — 0. */
function effectiveBufferHours(bufferHours) {
  return typeof bufferHours === "number" && !isNaN(bufferHours) && bufferHours >= 0 ? bufferHours : 0;
}

/**
 * Типы результата проверки
 * @typedef {"ALLOWED" | "OVERRIDE_PENDING" | "PENDING_OVERLAP" | "BLOCKED_BY_CONFIRMED" | "CONFIRMED_CONFLICT"} AdjustmentType
 */

/**
 * @typedef {Object} TimeAdjustmentResult
 * @property {boolean} allowed - Разрешено ли изменение
 * @property {boolean} warning - Нужно ли показывать warning
 * @property {boolean} strongWarning - Нужно ли сильное предупреждение
 * @property {AdjustmentType} type - Тип результата
 * @property {string} reason - Причина (для логов)
 * @property {string} message - Сообщение для UI
 * @property {string} messageKey - Ключ для i18n
 * @property {Object|null} conflictOrder - Конфликтующий заказ
 * @property {boolean} requiresAcknowledgement - Требуется подтверждение админа
 */

/**
 * Проверяет, разрешено ли изменение времени
 *
 * @param {Object} params
 * @param {Object} params.editingOrder - Редактируемый заказ
 * @param {Object} params.otherOrder - Другой заказ (с которым конфликт)
 * @param {"pickup" | "return"} params.direction - Направление изменения
 * @param {string} [params.newTime] - Новое время (HH:mm)
 * @returns {TimeAdjustmentResult}
 */
export function canAdjustTime({ editingOrder, otherOrder, direction, newTime }) {
  if (!editingOrder || !otherOrder) {
    return createResult({
      allowed: true,
      type: "ALLOWED",
      message: "",
    });
  }

  const editingConfirmed = editingOrder.confirmed === true;
  const otherConfirmed = otherOrder.confirmed === true;

  const editingOwnership = getOrderOwnership(editingOrder);
  const otherOwnership = getOrderOwnership(otherOrder);

  // СЦЕНАРИЙ 1: confirmed двигает pending
  // ✅ РАЗРЕШЕНО с warning
  if (editingConfirmed && !otherConfirmed) {
    return createResult({
      allowed: true,
      warning: true,
      strongWarning: false,
      type: "OVERRIDE_PENDING",
      reason: "Confirmed order can override pending",
      message: getOverridePendingMessage(otherOrder, direction),
      messageKey: "timeAdjust.overridePending",
      conflictOrder: otherOrder,
      requiresAcknowledgement: true,
    });
  }

  // СЦЕНАРИЙ 2: pending двигает confirmed
  // ❌ ЗАБЛОКИРОВАНО
  if (!editingConfirmed && otherConfirmed) {
    return createResult({
      allowed: false,
      warning: false,
      type: "BLOCKED_BY_CONFIRMED",
      reason: "Pending cannot override confirmed",
      message: getBlockedByConfirmedMessage(otherOrder, direction),
      messageKey: "timeAdjust.blockedByConfirmed",
      conflictOrder: otherOrder,
      requiresAcknowledgement: false,
    });
  }

  // СЦЕНАРИЙ 3: pending vs pending
  // ✅ РАЗРЕШЕНО с сильным warning
  if (!editingConfirmed && !otherConfirmed) {
    return createResult({
      allowed: true,
      warning: true,
      strongWarning: true,
      type: "PENDING_OVERLAP",
      reason: "Both orders are pending",
      message: getPendingOverlapMessage(otherOrder),
      messageKey: "timeAdjust.pendingOverlap",
      conflictOrder: otherOrder,
      requiresAcknowledgement: true,
    });
  }

  // СЦЕНАРИЙ 4: confirmed vs confirmed
  // ❌ ЗАБЛОКИРОВАНО (кроме суперадмина)
  if (editingConfirmed && otherConfirmed) {
    return createResult({
      allowed: false,
      warning: false,
      type: "CONFIRMED_CONFLICT",
      reason: "Both orders are confirmed",
      message: getConfirmedConflictMessage(otherOrder, direction),
      messageKey: "timeAdjust.confirmedConflict",
      conflictOrder: otherOrder,
      requiresAcknowledgement: false,
    });
  }

  // Fallback
  return createResult({
    allowed: true,
    type: "ALLOWED",
    message: "",
  });
}

/**
 * Создаёт результат проверки
 */
function createResult(params) {
  return {
    allowed: params.allowed ?? false,
    warning: params.warning ?? false,
    strongWarning: params.strongWarning ?? false,
    type: params.type ?? "ALLOWED",
    reason: params.reason ?? "",
    message: params.message ?? "",
    messageKey: params.messageKey ?? "",
    conflictOrder: params.conflictOrder ?? null,
    requiresAcknowledgement: params.requiresAcknowledgement ?? false,
  };
}

// === СООБЩЕНИЯ ===

function getOverridePendingMessage(otherOrder, direction) {
  const ownership = getOrderOwnership(otherOrder);
  const isBusiness = ownership.ownership === "business";

  if (isBusiness) {
    return `⚠️ Вы перемещаете подтверждённый заказ на время ожидающей заявки клиента (${otherOrder.customerName || "без имени"})`;
  }
  return `⚠️ Вы перемещаете подтверждённый заказ на время внутреннего бронирования`;
}

function getBlockedByConfirmedMessage(otherOrder, direction) {
  const ownership = getOrderOwnership(otherOrder);
  const time =
    direction === "pickup"
      ? formatTime(otherOrder.timeOut)
      : formatTime(otherOrder.timeIn);

  if (ownership.ownership === "business") {
    return `❌ Невозможно: конфликт с подтверждённым заказом клиента (${direction === "pickup" ? "возврат" : "получение"} в ${time})`;
  }
  return `❌ Невозможно: конфликт с подтверждённым внутренним бронированием (${time})`;
}

function getPendingOverlapMessage(otherOrder) {
  const ownership = getOrderOwnership(otherOrder);
  const isBusiness = ownership.ownership === "business";

  if (isBusiness) {
    return `⚠️ Пересечение с ожидающей заявкой клиента (${otherOrder.customerName || "без имени"}). При подтверждении обоих возникнет конфликт!`;
  }
  return `⚠️ Пересечение с ожидающим внутренним бронированием. При подтверждении обоих возникнет конфликт!`;
}

function getConfirmedConflictMessage(otherOrder, direction) {
  const ownership = getOrderOwnership(otherOrder);
  const time =
    direction === "pickup"
      ? formatTime(otherOrder.timeOut)
      : formatTime(otherOrder.timeIn);

  if (ownership.ownership === "business") {
    return `❌ Конфликт с подтверждённым заказом клиента ${otherOrder.customerName || ""} (${time})`;
  }
  return `❌ Конфликт с подтверждённым внутренним бронированием (${time})`;
}

/**
 * @typedef {Object} TimeConstraints
 * @property {string|null} minPickupTime - Минимальное время получения (HH:mm)
 * @property {string|null} maxReturnTime - Максимальное время возврата (HH:mm)
 * @property {Array<string>} blockedPickupTimes - Заблокированные времена получения
 * @property {Array<string>} blockedReturnTimes - Заблокированные времена возврата
 * @property {Array<Object>} warnings - Предупреждения
 */

/**
 * Получает ограничения времени для редактируемого заказа
 *
 * @param {Object} params
 * @param {Object} params.editingOrder - Редактируемый заказ
 * @param {Array} params.overlapOrders - Заказы с пересечением дат
 * @param {string} params.pickupDate - Дата получения (YYYY-MM-DD)
 * @param {string} params.returnDate - Дата возврата (YYYY-MM-DD)
 * @param {number} [params.bufferHours] - Буфер в часах (только из company.bufferTime)
 * @returns {TimeConstraints}
 */
export function getTimeConstraints({
  editingOrder,
  overlapOrders,
  pickupDate,
  returnDate,
  bufferHours,
}) {
  const bufHours = effectiveBufferHours(bufferHours);
  const constraints = {
    minPickupTime: null,
    maxReturnTime: null,
    blockedPickupTimes: [],
    blockedReturnTimes: [],
    warnings: [],
    adjustmentResults: [],
  };

  if (!overlapOrders?.length) {
    return constraints;
  }

  const pickupDateStr = dayjs(pickupDate).format("YYYY-MM-DD");
  const returnDateStr = dayjs(returnDate).format("YYYY-MM-DD");

  overlapOrders.forEach((otherOrder) => {
    if (otherOrder._id === editingOrder?._id) return;

    const otherStartDate = dayjs(otherOrder.rentalStartDate)
      .tz(BUSINESS_TZ)
      .format("YYYY-MM-DD");
    const otherEndDate = dayjs(otherOrder.rentalEndDate)
      .tz(BUSINESS_TZ)
      .format("YYYY-MM-DD");

    // Проверка для PICKUP: другой заказ заканчивается в день нашего pickup
    if (otherEndDate === pickupDateStr) {
      const result = canAdjustTime({
        editingOrder,
        otherOrder,
        direction: "pickup",
      });

      constraints.adjustmentResults.push(result);

      if (!result.allowed) {
        // Блокируем время до окончания другого заказа + buffer
        const otherEndTime = dayjs(otherOrder.timeOut).tz(BUSINESS_TZ);
        const minTime = otherEndTime.add(bufHours, "hour");
        
        if (!constraints.minPickupTime || minTime.isAfter(dayjs(constraints.minPickupTime, "HH:mm"))) {
          constraints.minPickupTime = minTime.format("HH:mm");
        }
      } else if (result.warning) {
        constraints.warnings.push({
          type: "pickup",
          result,
        });
      }
    }

    // Проверка для RETURN: другой заказ начинается в день нашего return
    if (otherStartDate === returnDateStr) {
      const result = canAdjustTime({
        editingOrder,
        otherOrder,
        direction: "return",
      });

      constraints.adjustmentResults.push(result);

      if (!result.allowed) {
        // Блокируем время после начала другого заказа - buffer
        const otherStartTime = dayjs(otherOrder.timeIn).tz(BUSINESS_TZ);
        const maxTime = otherStartTime.subtract(bufHours, "hour");
        
        if (!constraints.maxReturnTime || maxTime.isBefore(dayjs(constraints.maxReturnTime, "HH:mm"))) {
          constraints.maxReturnTime = maxTime.format("HH:mm");
        }
      } else if (result.warning) {
        constraints.warnings.push({
          type: "return",
          result,
        });
      }
    }
  });

  return constraints;
}

/**
 * Проверяет, валидно ли выбранное время
 *
 * @param {Object} params
 * @param {string} params.selectedTime - Выбранное время (HH:mm)
 * @param {TimeConstraints} params.constraints - Ограничения
 * @param {"pickup" | "return"} params.direction
 * @returns {{ valid: boolean, message: string }}
 */
export function validateSelectedTime({ selectedTime, constraints, direction }) {
  const time = dayjs(selectedTime, "HH:mm");

  if (direction === "pickup" && constraints.minPickupTime) {
    const minTime = dayjs(constraints.minPickupTime, "HH:mm");
    if (time.isBefore(minTime)) {
      return {
        valid: false,
        message: `Время получения должно быть не раньше ${constraints.minPickupTime}`,
      };
    }
  }

  if (direction === "return" && constraints.maxReturnTime) {
    const maxTime = dayjs(constraints.maxReturnTime, "HH:mm");
    if (time.isAfter(maxTime)) {
      return {
        valid: false,
        message: `Время возврата должно быть не позже ${constraints.maxReturnTime}`,
      };
    }
  }

  return { valid: true, message: "" };
}

/**
 * Собирает все предупреждения для отображения
 *
 * @param {TimeConstraints} constraints
 * @returns {Array<{ type: string, severity: string, message: string }>}
 */
export function collectWarningsForDisplay(constraints) {
  const warnings = [];

  constraints.warnings.forEach(({ type, result }) => {
    warnings.push({
      type: result.type,
      severity: result.strongWarning ? "high" : "medium",
      message: result.message,
      direction: type,
      requiresAcknowledgement: result.requiresAcknowledgement,
    });
  });

  return warnings;
}

/**
 * Проверяет, требуется ли подтверждение админа перед сохранением
 *
 * @param {TimeConstraints} constraints
 * @returns {boolean}
 */
export function requiresAdminAcknowledgement(constraints) {
  return constraints.warnings.some((w) => w.result.requiresAcknowledgement);
}

/**
 * Генерирует данные для модального окна подтверждения
 *
 * @param {TimeConstraints} constraints
 * @returns {Object|null}
 */
export function generateAcknowledgementData(constraints) {
  const warningsRequiringAck = constraints.warnings.filter(
    (w) => w.result.requiresAcknowledgement
  );

  if (warningsRequiringAck.length === 0) {
    return null;
  }

  const hasOverridePending = warningsRequiringAck.some(
    (w) => w.result.type === "OVERRIDE_PENDING"
  );
  const hasPendingOverlap = warningsRequiringAck.some(
    (w) => w.result.type === "PENDING_OVERLAP"
  );

  let title = "⚠️ Подтвердите изменения";
  let description = "";

  if (hasOverridePending) {
    title = "⚠️ Изменение затронет ожидающую заявку";
    description =
      "Вы перемещаете подтверждённый заказ на время, где есть ожидающая заявка. Эта заявка может быть затронута.";
  } else if (hasPendingOverlap) {
    title = "⚠️ Пересечение ожидающих заказов";
    description =
      "Два ожидающих заказа будут пересекаться по времени. Если оба будут подтверждены, возникнет конфликт.";
  }

  return {
    title,
    description,
    warnings: warningsRequiringAck.map((w) => ({
      message: w.result.message,
      severity: w.result.strongWarning ? "high" : "medium",
      conflictOrder: w.result.conflictOrder
        ? {
            customerName: w.result.conflictOrder.customerName,
            phone: w.result.conflictOrder.phone,
          }
        : null,
    })),
    confirmButton: {
      text: "Подтвердить и сохранить",
      color: hasOverridePending ? "warning" : "primary",
    },
    cancelButton: {
      text: "Отмена",
    },
  };
}

// === i18n MESSAGES ===

export const TIME_ADJUSTMENT_MESSAGES = {
  ru: {
    "timeAdjust.overridePending":
      "Подтверждённый заказ переопределит ожидающую заявку",
    "timeAdjust.blockedByConfirmed":
      "Невозможно: конфликт с подтверждённым заказом",
    "timeAdjust.pendingOverlap":
      "Предупреждение: пересечение двух ожидающих заказов",
    "timeAdjust.confirmedConflict":
      "Невозможно: конфликт двух подтверждённых заказов",
  },
  en: {
    "timeAdjust.overridePending":
      "Confirmed order will override pending request",
    "timeAdjust.blockedByConfirmed":
      "Cannot adjust: conflicts with confirmed order",
    "timeAdjust.pendingOverlap":
      "Warning: two pending orders will overlap",
    "timeAdjust.confirmedConflict":
      "Cannot adjust: two confirmed orders conflict",
  },
  el: {
    "timeAdjust.overridePending":
      "Η επιβεβαιωμένη κράτηση θα αντικαταστήσει την εκκρεμή",
    "timeAdjust.blockedByConfirmed":
      "Αδύνατο: σύγκρουση με επιβεβαιωμένη κράτηση",
    "timeAdjust.pendingOverlap":
      "Προειδοποίηση: δύο εκκρεμείς κρατήσεις αλληλεπικαλύπτονται",
    "timeAdjust.confirmedConflict":
      "Αδύνατο: σύγκρουση δύο επιβεβαιωμένων κρατήσεων",
  },
};

