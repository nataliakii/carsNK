/**
 * buildPendingConfirmBlockMap
 *
 * Создаёт map pending заказов, которые НЕ МОГУТ быть подтверждены
 * из-за конфликта с уже подтверждёнными заказами.
 *
 * Кешируем только ДАННЫЕ (conflictData), не строки — текст формирует UI.
 */

import { canPendingOrderBeConfirmed } from "@/domain/booking/analyzeConfirmationConflicts";

/**
 * @param {Array} allOrders - все заказы
 * @param {Object} [company] - данные компании (для получения bufferTime)
 * @returns {{ pendingConfirmBlockById: Record<string, object> }}
 *   - ключ: orderId
 *   - значение: conflictData (blockingOrder, conflictTime, conflictReturnTime, conflictPickupTime, actualGapMinutes, requiredBufferHours)
 */
export function buildPendingConfirmBlockMap(allOrders, company) {
  const pendingConfirmBlockById = {};

  if (!Array.isArray(allOrders) || allOrders.length === 0) {
    return { pendingConfirmBlockById };
  }

  const byCar = new Map();
  for (const order of allOrders) {
    const carId = (order.car?._id || order.car)?.toString();
    if (!carId) continue;
    if (!byCar.has(carId)) byCar.set(carId, []);
    byCar.get(carId).push(order);
  }

  for (const [, orders] of byCar.entries()) {
    const confirmed = orders.filter((x) => x.confirmed === true);
    if (confirmed.length === 0) continue;

    const pending = orders.filter((x) => !x.confirmed);

    for (const pendingOrder of pending) {
      const result = canPendingOrderBeConfirmed({
        pendingOrder,
        allOrders: confirmed,
        bufferHours: company?.bufferTime,
      });

      if (!result.canConfirm && result.conflictData && pendingOrder._id) {
        const orderId = pendingOrder._id.toString();
        pendingConfirmBlockById[orderId] = result.conflictData;
      }
    }
  }

  return { pendingConfirmBlockById };
}

export default buildPendingConfirmBlockMap;

