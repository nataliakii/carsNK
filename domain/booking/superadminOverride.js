/**
 * Superadmin Override Utilities
 *
 * Позволяет суперадмину переопределять конфликты с confirmed заказами.
 *
 * Правила:
 * - Должен явно включить forceCreate
 * - Должна быть создана запись аудита
 * - UI должен отобразить строгое предупреждение
 */

import {
  validateConflictsExtended,
  canSuperadminOverride,
  generateOverrideWarning,
  createOverrideAuditEntry,
} from "./conflictValidation";

/**
 * @typedef {Object} OverrideRequest
 * @property {boolean} forceCreate - Явное подтверждение принудительного создания
 * @property {string} reason - Причина override (опционально)
 * @property {string} superadminId - ID суперадмина
 */

/**
 * @typedef {Object} OverrideResult
 * @property {boolean} allowed - Разрешено ли override
 * @property {boolean} requiresConfirmation - Нужно ли подтверждение
 * @property {string} warningMessage - Сообщение предупреждения
 * @property {Object|null} auditEntry - Запись аудита (если override разрешён)
 */

/**
 * Проверяет, может ли суперадмин выполнить override
 *
 * @param {Object} params
 * @param {Object} params.newOrderData - Данные нового заказа
 * @param {Array} params.existingOrders - Существующие заказы
 * @param {OverrideRequest} params.overrideRequest - Запрос на override
 * @returns {OverrideResult}
 */
export function checkSuperadminOverride({
  newOrderData,
  existingOrders,
  overrideRequest,
}) {
  // Валидируем конфликты
  const validationResult = validateConflictsExtended({
    existingOrders,
    newStartDate: newOrderData.rentalStartDate,
    newEndDate: newOrderData.rentalEndDate,
    newTimeIn: newOrderData.timeIn,
    newTimeOut: newOrderData.timeOut,
  });

  // Если нет конфликтов — override не нужен
  if (!validationResult.hasBlockingConflict) {
    return {
      allowed: true,
      requiresConfirmation: false,
      warningMessage: "",
      auditEntry: null,
      validationResult,
    };
  }

  // Проверяем, можно ли вообще сделать override
  const canOverride = canSuperadminOverride(validationResult);

  if (!canOverride) {
    return {
      allowed: false,
      requiresConfirmation: false,
      warningMessage: "Эти конфликты не могут быть переопределены.",
      auditEntry: null,
      validationResult,
    };
  }

  // Если forceCreate не указан — требуем подтверждение
  if (!overrideRequest?.forceCreate) {
    return {
      allowed: false,
      requiresConfirmation: true,
      warningMessage: generateOverrideWarning(validationResult),
      auditEntry: null,
      validationResult,
    };
  }

  // forceCreate указан — разрешаем и создаём аудит
  const auditEntry = createOverrideAuditEntry({
    userId: overrideRequest.superadminId,
    newOrder: newOrderData,
    validationResult,
  });

  // Добавляем причину если указана
  if (overrideRequest.reason) {
    auditEntry.reason = overrideRequest.reason;
  }

  return {
    allowed: true,
    requiresConfirmation: false,
    warningMessage: "",
    auditEntry,
    validationResult,
  };
}

/**
 * Проверяет, является ли пользователь суперадмином
 *
 * @param {Object} user
 * @returns {boolean}
 */
export function isSuperadmin(user) {
  if (!user) return false;
  return user.role === "superadmin" || user.isSuperadmin === true;
}

/**
 * Валидирует запрос на override
 *
 * @param {OverrideRequest} request
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateOverrideRequest(request) {
  if (!request) {
    return { valid: false, error: "Override request is required" };
  }

  if (!request.superadminId) {
    return { valid: false, error: "Superadmin ID is required" };
  }

  if (request.forceCreate !== true) {
    return { valid: false, error: "forceCreate must be explicitly set to true" };
  }

  return { valid: true, error: null };
}

/**
 * Генерирует данные для UI модального окна подтверждения
 *
 * @param {Object} validationResult - Результат validateConflictsExtended
 * @returns {Object}
 */
export function generateOverrideConfirmationData(validationResult) {
  const { blockingConflicts, summary } = validationResult;

  // Группируем конфликты по типу
  const businessConflicts = blockingConflicts.filter(
    (c) => c.ownership === "business"
  );
  const internalConflicts = blockingConflicts.filter(
    (c) => c.ownership === "internal"
  );

  return {
    title: "⚠️ Принудительное создание заказа",
    subtitle: "Это действие переопределит существующие подтверждённые заказы",

    sections: [
      {
        type: "business",
        title: "Клиентские заказы",
        count: businessConflicts.length,
        items: businessConflicts.map((c) => ({
          customerName: c.order.customerName,
          phone: c.order.phone,
          dates: `${c.order.rentalStartDate} - ${c.order.rentalEndDate}`,
          conflictDate: c.date,
        })),
        severity: "critical",
      },
      {
        type: "internal",
        title: "Внутренние бронирования",
        count: internalConflicts.length,
        items: internalConflicts.map((c) => ({
          dates: `${c.order.rentalStartDate} - ${c.order.rentalEndDate}`,
          conflictDate: c.date,
        })),
        severity: "high",
      },
    ],

    warnings: [
      "Клиенты с конфликтующими заказами НЕ будут автоматически уведомлены",
      "Это действие будет залогировано в аудит системы",
      "Рекомендуется связаться с клиентами вручную",
    ],

    confirmButton: {
      text: "ПОДТВЕРДИТЬ ПРИНУДИТЕЛЬНОЕ СОЗДАНИЕ",
      color: "error",
    },

    cancelButton: {
      text: "Отмена",
    },

    requiresReason: false, // Можно сделать true для обязательного ввода причины
  };
}

/**
 * Форматирует запись аудита для логов
 *
 * @param {Object} auditEntry
 * @returns {string}
 */
export function formatAuditEntryForLog(auditEntry) {
  const lines = [
    "=== SUPERADMIN OVERRIDE AUDIT ===",
    `Timestamp: ${auditEntry.timestamp.toISOString()}`,
    `Superadmin ID: ${auditEntry.userId}`,
    `Action: ${auditEntry.action}`,
    `Severity: ${auditEntry.severity}`,
    "",
    "New Order:",
    `  Car: ${auditEntry.orderData.carNumber}`,
    `  Dates: ${auditEntry.orderData.rentalStartDate} - ${auditEntry.orderData.rentalEndDate}`,
    `  Customer: ${auditEntry.orderData.customerName}`,
    "",
    "Overridden Conflicts:",
  ];

  auditEntry.overriddenConflicts.forEach((conflict, idx) => {
    lines.push(
      `  ${idx + 1}. Order ${conflict.orderId} (${conflict.customerName || "internal"})`
    );
    lines.push(
      `     Type: ${conflict.ownership} / ${conflict.confirmation}`
    );
    lines.push(`     Conflict date: ${conflict.conflictDate}`);
  });

  if (auditEntry.reason) {
    lines.push("");
    lines.push(`Reason: ${auditEntry.reason}`);
  }

  lines.push("=================================");

  return lines.join("\n");
}

