/**
 * conflictMessages.js
 *
 * Единый источник UX-текстов для конфликтов.
 * Отделяем логику от языка.
 *
 * Backend использует code, Frontend — text
 * Легко локализовать и менять тексты без риска.
 */

export const conflictMessages = {
  // 🔴 BLOCKS — сохранение невозможно
  CONFIRMED_BLOCK: {
    level: "error",
    code: "CONFIRMED_BLOCK",
    text: "Это время пересекается с подтверждённым заказом и не может быть сохранено.",
    textEn: "This time overlaps with a confirmed booking and cannot be saved.",
  },

  BLOCKED_BY_CONFIRMED: {
    level: "error",
    code: "BLOCKED_BY_CONFIRMED",
    text: "Время недоступно. Конфликт с подтверждённым заказом.",
    textEn: "Time unavailable. Conflicts with a confirmed rental.",
  },

  CONFIRMED_CONFLICT: {
    level: "error",
    code: "CONFIRMED_CONFLICT",
    text: "Два подтверждённых заказа не могут пересекаться.",
    textEn: "Two confirmed rentals cannot overlap.",
  },

  // 🟡 WARNINGS — можно сохранить, но с предупреждением
  OVERRIDE_PENDING: {
    level: "warning",
    code: "OVERRIDE_PENDING",
    text: "Подтверждённый заказ пересекается с ожидающей заявкой. Ожидающий заказ может быть затронут.",
    textEn: "This confirmed rental overlaps a pending request. The pending booking may be affected.",
  },

  PENDING_OVERLAP: {
    level: "warning",
    code: "PENDING_OVERLAP",
    text: "Два ожидающих заказа пересекаются. Если оба будут подтверждены — возникнет конфликт.",
    textEn: "Two pending bookings overlap. This may cause a conflict if both are confirmed.",
  },

  // 🟢 INFO — информационное сообщение
  INTERNAL_OVERLAP: {
    level: "info",
    code: "INTERNAL_OVERLAP",
    text: "На эту дату существует внутренний черновик заказа.",
    textEn: "An internal draft booking exists on this date.",
  },
};

/**
 * Получить сообщение по коду
 * @param {string} code - Код сообщения
 * @param {string} [lang="ru"] - Язык (ru | en)
 * @returns {Object} - { level, code, text }
 */
export function getConflictMessage(code, lang = "ru") {
  const msg = conflictMessages[code];
  if (!msg) {
    return {
      level: "warning",
      code: code,
      text: code,
    };
  }
  return {
    level: msg.level,
    code: msg.code,
    text: lang === "en" ? msg.textEn : msg.text,
  };
}

/**
 * Создать объект блока/предупреждения
 * @param {string} code - Код сообщения
 * @param {string} orderId - ID заказа
 * @param {string} [customerName] - Имя клиента
 * @param {string} [details] - Дополнительные детали
 * @returns {Object}
 */
export function createConflictEntry(code, orderId, customerName = null, details = null) {
  const msg = conflictMessages[code];
  if (!msg) {
    return {
      code,
      orderId,
      customerName,
      message: details || code,
      level: "warning",
    };
  }

  let text = msg.text;
  if (customerName) {
    text += ` (${customerName})`;
  }
  if (details) {
    text += ` ${details}`;
  }

  return {
    code: msg.code,
    orderId,
    customerName,
    message: text,
    level: msg.level,
  };
}

