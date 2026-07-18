import {
  grandTotalFromPriceBreakdown,
  sumRentalSubtotalFromPriceBreakdown,
} from "@/domain/orders/orderPriceHelpers";

/**
 * Снимок заказа для сохранения: при переданном override используем его (иначе — текущий черновик).
 * onClick={handleSave} передаёт SyntheticEvent первым аргументом — у него нет orderOverride, сработает editedOrder.
 */
export function resolveOrderSnapshotForSave(editedOrder, saveOptions = {}) {
  return saveOptions.orderOverride ?? editedOrder;
}

/**
 * Проверки и построение orderOverride для кнопки «итого с доставкой → totalPrice и сохранить».
 *
 * @param {object} params
 * @param {object|null} params.editedOrder
 * @param {string} params.manualDeliveryIn
 * @param {string} params.manualDeliveryOut
 * @param {object|null} params.priceBreakdown
 * @param {boolean} params.viewOnly
 * @param {{ totalPrice?: boolean, deliveryInOverride?: boolean }} params.fieldPermissions
 * @returns
 *   | { kind: "silent" }
 *   | { kind: "error", message: string }
 *   | { kind: "ok", grand: number, orderOverride: object }
 */
export function prepareApplyQuotedDeliveryGrandSave({
  editedOrder,
  manualDeliveryIn,
  manualDeliveryOut,
  priceBreakdown,
  viewOnly,
  fieldPermissions = {},
}) {
  if (viewOnly || !editedOrder) {
    return { kind: "silent" };
  }
  if (fieldPermissions.totalPrice !== true) {
    return { kind: "error", message: "Нет права менять сумму заказа" };
  }
  if (fieldPermissions.deliveryInOverride !== true) {
    return { kind: "error", message: "Нет права на доставку" };
  }
  const tIn = String(manualDeliveryIn ?? "").trim();
  const tOut = String(manualDeliveryOut ?? "").trim();
  if (tIn === "" || tOut === "") {
    return {
      kind: "error",
      message:
        "Сначала рассчитайте доставку по зонам или введите суммы в оба поля",
    };
  }
  if (!priceBreakdown) {
    return {
      kind: "error",
      message:
        "Нет разбивки цены — откройте заказ заново или пересчитайте",
    };
  }
  const rental = sumRentalSubtotalFromPriceBreakdown(priceBreakdown);
  if (rental <= 0) {
    return {
      kind: "error",
      message:
        "Сначала пересчитайте цену заказа, чтобы в разбивке была аренда",
    };
  }
  const grand = grandTotalFromPriceBreakdown(priceBreakdown);
  if (grand == null || Number.isNaN(grand)) {
    return { kind: "error", message: "Не удалось посчитать итого" };
  }
  return {
    kind: "ok",
    grand,
    orderOverride: {
      ...editedOrder,
      totalPrice: grand,
      OverridePrice: null,
    },
  };
}
