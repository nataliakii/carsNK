/**
 * getAutoFixSuggestions
 *
 * Генерирует предложения по автоматическому исправлению времени.
 */

import dayjs from "dayjs";

/**
 * @typedef {Object} AutoFixSuggestion
 * @property {string} id - Уникальный ID
 * @property {string} label - Текст для UI
 * @property {string} reason - Причина/объяснение
 * @property {Function} apply - Функция применения: () => { newPickupTime?, newReturnTime? }
 * @property {"block" | "warning" | "safe"} severity - Уровень
 * @property {boolean} disabled - Отключена ли (нельзя применить)
 */

/**
 * Генерирует предложения по исправлению времени
 *
 * @param {Object} params
 * @param {Object} params.pickupConflicts - Конфликты для pickup даты
 * @param {Object} params.returnConflicts - Конфликты для return даты
 * @param {string} params.selectedPickupTime - Текущее выбранное время pickup (HH:mm)
 * @param {string} params.selectedReturnTime - Текущее выбранное время return (HH:mm)
 * @param {boolean} params.editingOrderConfirmed - Подтверждён ли редактируемый заказ
 * @returns {AutoFixSuggestion[]}
 */
export function getAutoFixSuggestions({
  pickupConflicts,
  returnConflicts,
  selectedPickupTime,
  selectedReturnTime,
  editingOrderConfirmed,
}) {
  const suggestions = [];

  const hasPickupBlocks = pickupConflicts?.blocks?.length > 0;
  const hasReturnBlocks = returnConflicts?.blocks?.length > 0;
  const hasBlocks = hasPickupBlocks || hasReturnBlocks;

  const hasPickupWarnings = pickupConflicts?.warnings?.length > 0;
  const hasReturnWarnings = returnConflicts?.warnings?.length > 0;
  const hasWarnings = hasPickupWarnings || hasReturnWarnings;

  // Если нет конфликтов — нет предложений
  if (!hasBlocks && !hasWarnings) {
    return suggestions;
  }

  // 1. Если есть minPickupTime — предложить сдвинуть pickup
  if (pickupConflicts?.minPickupTime) {
    const minTime = pickupConflicts.minPickupTime;
    const currentTime = selectedPickupTime;

    if (currentTime < minTime) {
      suggestions.push({
        id: "set-min-pickup",
        label: `Установить время получения: ${minTime}`,
        reason: `Минимальное допустимое время получения — ${minTime}`,
        apply: () => ({
          newPickupTime: dayjs(minTime, "HH:mm"),
        }),
        severity: hasPickupBlocks ? "block" : "warning",
        disabled: false,
      });
    }
  }

  // 2. Если есть maxReturnTime — предложить сдвинуть return
  if (returnConflicts?.maxReturnTime) {
    const maxTime = returnConflicts.maxReturnTime;
    const currentTime = selectedReturnTime;

    if (currentTime > maxTime) {
      suggestions.push({
        id: "set-max-return",
        label: `Установить время возврата: ${maxTime}`,
        reason: `Максимальное допустимое время возврата — ${maxTime}`,
        apply: () => ({
          newReturnTime: dayjs(maxTime, "HH:mm"),
        }),
        severity: hasReturnBlocks ? "block" : "warning",
        disabled: false,
      });
    }
  }

  // 3. Если confirmed редактируется и есть warning с pending — можно продолжить
  if (editingOrderConfirmed && hasWarnings && !hasBlocks) {
    suggestions.push({
      id: "proceed-with-warning",
      label: "Продолжить (pending заказы будут затронуты)",
      reason: "Как подтверждённый заказ, вы можете перекрыть ожидающие заявки",
      apply: () => ({}), // Ничего не меняем
      severity: "warning",
      disabled: false,
    });
  }

  // 4. Комбинированное исправление
  if (pickupConflicts?.minPickupTime && returnConflicts?.maxReturnTime) {
    const minPickup = pickupConflicts.minPickupTime;
    const maxReturn = returnConflicts.maxReturnTime;

    // Проверяем, что новый интервал валиден (pickup < return)
    if (minPickup < maxReturn) {
      suggestions.push({
        id: "set-both",
        label: `Установить: ${minPickup} — ${maxReturn}`,
        reason: "Оптимальный интервал без конфликтов",
        apply: () => ({
          newPickupTime: dayjs(minPickup, "HH:mm"),
          newReturnTime: dayjs(maxReturn, "HH:mm"),
        }),
        severity: hasBlocks ? "block" : "safe",
        disabled: minPickup >= maxReturn, // Отключить если интервал невалидный
      });
    }
  }

  // 5. Если blocks и нельзя разрешить — добавить объяснение
  if (hasBlocks && suggestions.filter((s) => !s.disabled).length === 0) {
    suggestions.push({
      id: "cannot-resolve",
      label: "Невозможно разрешить конфликт автоматически",
      reason: "Выберите другие даты или свяжитесь с клиентом",
      apply: () => ({}),
      severity: "block",
      disabled: true,
    });
  }

  return suggestions;
}

export default getAutoFixSuggestions;

