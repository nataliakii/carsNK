/**
 * 📝 UX-копирайт для заказов
 *
 * Используется в:
 * - EditOrderModal
 * - AddOrderModal
 * - Backend API responses
 * - Snackbar notifications
 */

export const orderMessages = {
  // ✅ Успешные операции
  ORDER_CREATED: {
    title: "Заказ создан",
    text: "Новый заказ успешно добавлен.",
  },
  ORDER_UPDATED: {
    title: "Заказ обновлён",
    text: "Изменения сохранены.",
  },
  ORDER_CONFIRMED: {
    title: "Заказ подтверждён",
    text: "Статус заказа изменён на «подтверждён».",
  },
  ORDER_CANCELLED: {
    title: "Заказ отменён",
    text: "Статус заказа изменён на «ожидающий».",
  },
  ORDER_DELETED: {
    title: "Заказ удалён",
    text: "Заказ успешно удалён из системы.",
  },

  // ⚠️ Предупреждения
  DATES_CHANGED: {
    title: "Даты изменены",
    text: "Даты аренды успешно обновлены.",
  },
  PRICE_RECALCULATED: {
    title: "Цена пересчитана",
    text: "Стоимость заказа обновлена.",
  },

  // ❌ Ошибки
  SAVE_ERROR: {
    title: "Ошибка сохранения",
    text: "Не удалось сохранить изменения. Попробуйте ещё раз.",
  },
  LOAD_ERROR: {
    title: "Ошибка загрузки",
    text: "Не удалось загрузить данные заказа.",
  },
  VALIDATION_ERROR: {
    title: "Ошибка валидации",
    text: "Проверьте правильность заполнения полей.",
  },

  // API: switchConfirm (confirm/unconfirm order)
  CONFIRM_PERMISSION_DENIED: "Only superadmin can confirm or unconfirm client orders",
  CONFIRM_SUCCESS: "Заказ успешно подтверждён",
  UNCONFIRM_SUCCESS: "Подтверждение заказа снято",
  CONFIRM_TOGGLE_ERROR: "Failed to toggle order confirmation",
  SUPPLIER_RESPONSE_REQUIRED:
    "Supplier has not confirmed vehicle availability yet.",
  SUPPLIER_ACCEPTED:
    "Vehicle availability confirmed. Rovaro will complete the booking process.",
  SUPPLIER_DECLINED: "Your response has been sent to Rovaro.",
};

