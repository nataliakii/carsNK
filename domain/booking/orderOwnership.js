/**
 * Order Ownership Helper
 *
 * Определяет владение и происхождение заказа.
 *
 * Правила:
 * - my_order = true → business order (клиентский или суперадмин)
 * - my_order = false → internal admin order (внутренний заказ компании)
 *
 * Нет UI логики. Нет цветов.
 */

/**
 * Типы владения заказом
 * @typedef {"business" | "internal"} OrderOwnership
 */

/**
 * Типы происхождения заказа
 * @typedef {"client" | "admin" | "superadmin" | "system" | "unknown"} OrderOrigin
 */

/**
 * Статусы подтверждения
 * @typedef {"confirmed" | "pending" | "cancelled"} ConfirmationStatus
 */

/**
 * Результат анализа владения заказом
 * @typedef {Object} OwnershipResult
 * @property {OrderOwnership} ownership - "business" или "internal"
 * @property {OrderOrigin} origin - Кто создал заказ
 * @property {ConfirmationStatus} confirmation - Статус подтверждения
 */

/**
 * Определяет владение заказом
 *
 * @param {Object} order - Объект заказа
 * @param {boolean} [order.my_order] - Флаг "мой заказ" (бизнес-заказ)
 * @param {boolean} [order.confirmed] - Подтверждён ли заказ
 * @param {string} [order.createdBy] - Кто создал ("client" | "admin" | "superadmin")
 * @param {Date} [order.cancelledAt] - Дата отмены (если отменён)
 * @returns {OwnershipResult}
 *
 * @example
 * // Клиентский заказ (через BookingModal)
 * getOrderOwnership({ my_order: true, confirmed: false, createdBy: "client" })
 * // → { ownership: "business", origin: "client", confirmation: "pending" }
 *
 * @example
 * // Внутренний заказ админа (машина на ТО)
 * getOrderOwnership({ my_order: false, confirmed: true, createdBy: "admin" })
 * // → { ownership: "internal", origin: "admin", confirmation: "confirmed" }
 */
export function getOrderOwnership(order) {
  if (!order) {
    return {
      ownership: "internal",
      origin: "unknown",
      confirmation: "pending",
    };
  }

  // Определяем ownership на основе my_order
  // my_order = true → это бизнес-заказ (клиент бронирует машину)
  // my_order = false/undefined → внутренний заказ (админ блокирует машину)
  const ownership = order.my_order === true ? "business" : "internal";

  // Определяем origin
  let origin = "unknown";
  if (order.createdBy) {
    origin = order.createdBy;
  } else if (order.my_order === true) {
    // Если my_order = true и нет createdBy, скорее всего это клиент
    origin = "client";
  } else {
    // Если my_order = false и нет createdBy, скорее всего это админ
    origin = "admin";
  }

  // Определяем confirmation status
  let confirmation = "pending";
  if (order.cancelledAt) {
    confirmation = "cancelled";
  } else if (order.confirmed === true) {
    confirmation = "confirmed";
  }

  return {
    ownership,
    origin,
    confirmation,
  };
}

/**
 * Проверяет, является ли заказ бизнес-заказом
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isBusinessOrder(order) {
  return getOrderOwnership(order).ownership === "business";
}

/**
 * Проверяет, является ли заказ внутренним
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isInternalOrder(order) {
  return getOrderOwnership(order).ownership === "internal";
}

/**
 * Проверяет, подтверждён ли заказ
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isConfirmedOrder(order) {
  return getOrderOwnership(order).confirmation === "confirmed";
}

/**
 * Проверяет, ожидает ли заказ подтверждения
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isPendingOrder(order) {
  return getOrderOwnership(order).confirmation === "pending";
}

/**
 * Проверяет, отменён ли заказ
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isCancelledOrder(order) {
  return getOrderOwnership(order).confirmation === "cancelled";
}

/**
 * Проверяет, создан ли заказ клиентом
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isClientOrder(order) {
  return getOrderOwnership(order).origin === "client";
}

/**
 * Проверяет, создан ли заказ суперадмином
 *
 * @param {Object} order
 * @returns {boolean}
 */
export function isSuperadminOrder(order) {
  return getOrderOwnership(order).origin === "superadmin";
}

/**
 * Получает человекочитаемое описание владения
 * (для логов и отладки, не для UI)
 *
 * @param {Object} order
 * @returns {string}
 */
export function getOwnershipDescription(order) {
  const { ownership, origin, confirmation } = getOrderOwnership(order);

  const ownershipLabel = ownership === "business" ? "Бизнес-заказ" : "Внутренний";

  const originLabels = {
    client: "от клиента",
    admin: "от админа",
    superadmin: "от суперадмина",
    system: "системный",
    unknown: "неизвестно",
  };

  const confirmationLabels = {
    confirmed: "подтверждён",
    pending: "ожидает",
    cancelled: "отменён",
  };

  return `${ownershipLabel} (${originLabels[origin]}), ${confirmationLabels[confirmation]}`;
}

