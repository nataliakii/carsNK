/**
 * useEditOrderConflicts
 *
 * Централизованный хук для анализа конфликтов времени в EditOrderModal.
 *
 * 🎯 Возвращает:
 * - pickupSummary (один message для pickup даты)
 * - returnSummary (один message для return даты)
 * - hasBlockingConflict
 * - minPickupTime / maxReturnTime
 *
 * ❗ Использует СТРОГО Athens timezone через athensTime.js
 * ❗ Единственный источник истины для конфликтов
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import { analyzeOrderTimeConflicts } from "@/domain/booking/analyzeOrderTimeConflicts";
import { formatTimeHHMM, formatDateYYYYMMDD, fromServerUTC } from "@/domain/time/athensTime";

/**
 * @typedef {Object} ConflictSummary
 * @property {"block" | "warning"} level
 * @property {string} message
 */

/**
 * @typedef {Object} ConflictsResult
 * @property {ConflictSummary|null} pickupSummary - Summary для pickup даты
 * @property {ConflictSummary|null} returnSummary - Summary для return даты
 * @property {string|null} minPickupTime - "HH:mm"
 * @property {string|null} maxReturnTime - "HH:mm"
 * @property {boolean} hasBlockingConflict
 */

/**
 * Хук для анализа конфликтов времени
 *
 * @param {Object} params
 * @param {Array} params.allOrders - Все заказы из контекста
 * @param {Object} params.editingOrder - Оригинальный заказ (с confirmed статусом)
 * @param {string} params.carId - ID машины
 * @param {string|Date|dayjs.Dayjs} params.pickupDate - Дата получения
 * @param {dayjs.Dayjs} params.pickupTime - Время получения (dayjs объект)
 * @param {string|Date|dayjs.Dayjs} params.returnDate - Дата возврата
 * @param {dayjs.Dayjs} params.returnTime - Время возврата (dayjs объект)
 * @param {Object} [params.company] - Данные компании (для получения bufferTime)
 * @returns {ConflictsResult}
 */
export function useEditOrderConflicts({
  allOrders,
  editingOrder,
  carId,
  pickupDate,
  pickupTime,
  returnDate,
  returnTime,
  company,
}) {
  return useMemo(() => {
    const emptyResult = {
      pickupSummary: null,
      returnSummary: null,
      minPickupTime: null,
      maxReturnTime: null,
      hasBlockingConflict: false,
    };

    if (!carId || !pickupDate || !returnDate || !editingOrder) {
      return emptyResult;
    }

    // Фильтруем заказы для той же машины
    const sameCarOrders = allOrders.filter((o) => {
      const oCarId = o.car?._id || o.car;
      return oCarId?.toString() === carId?.toString();
    });

    // Форматируем дату и время для анализа
    // ⚠️ КРИТИЧНО: даты из сервера приходят как UTC timestamps
    // Нужно использовать fromServerUTC для корректного парсинга
    const pickupDateStr = dayjs.isDayjs(pickupDate) 
      ? formatDateYYYYMMDD(pickupDate)
      : formatDateYYYYMMDD(fromServerUTC(pickupDate));
    const returnDateStr = dayjs.isDayjs(returnDate)
      ? formatDateYYYYMMDD(returnDate)
      : formatDateYYYYMMDD(fromServerUTC(returnDate));
    
    // Время должно быть dayjs объектом — используем напрямую без dayjs()
    const pickupTimeStr = pickupTime && dayjs.isDayjs(pickupTime) 
      ? formatTimeHHMM(pickupTime) 
      : null;
    const returnTimeStr = returnTime && dayjs.isDayjs(returnTime) 
      ? formatTimeHHMM(returnTime) 
      : null;

    // bufferTime только из company (БД)
    const bufferHours = company?.bufferTime;

    // Анализируем конфликты для даты pickup
    const pickupResult = analyzeOrderTimeConflicts({
      editingOrder,
      orders: sameCarOrders,
      date: pickupDateStr,
      editingPickupDate: pickupDateStr,
      editingReturnDate: returnDateStr,
      editingPickupTime: pickupTimeStr,
      editingReturnTime: returnTimeStr,
      bufferHours,
    });

    // Анализируем конфликты для даты return
    const returnResult = analyzeOrderTimeConflicts({
      editingOrder,
      orders: sameCarOrders,
      date: returnDateStr,
      editingPickupDate: pickupDateStr,
      editingReturnDate: returnDateStr,
      editingPickupTime: pickupTimeStr,
      editingReturnTime: returnTimeStr,
      bufferHours,
    });

    // Определяем hasBlockingConflict
    const hasBlockingConflict =
      pickupResult.hasBlockingConflict || returnResult.hasBlockingConflict;

    return {
      pickupSummary: pickupResult.summary,
      returnSummary: returnResult.summary,
      minPickupTime: pickupResult.minPickupTime,
      maxReturnTime: returnResult.maxReturnTime,
      hasBlockingConflict,
    };
  }, [allOrders, editingOrder, carId, pickupDate, pickupTime, returnDate, returnTime, company]);
}

export default useEditOrderConflicts;
