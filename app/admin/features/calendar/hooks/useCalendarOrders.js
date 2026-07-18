/**
 * Хук для получения и обработки заказов машины в календаре
 */
import { useState, useEffect } from "react";
import { useMainContext } from "@app/Context";
import { getCarCalendarOrderDerivedState } from "@/domain/calendar";

/**
 * Возвращает обработанные данные заказов для конкретной машины
 * @param {string} carId - ID машины
 * @param {Array} initialOrders - начальные заказы (опционально)
 * @returns {Object} - объект с данными заказов
 */
export function useCalendarOrders(carId, initialOrders = []) {
  const { ordersByCarId, allOrders: contextAllOrders } = useMainContext();

  // Заказы для машины
  const [carOrders, setCarOrders] = useState(initialOrders);

  // Производные данные
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [confirmedDates, setConfirmedDates] = useState([]);
  const [startEndOverlapDates, setStartEndOverlapDates] = useState(null);
  const [overlapDates, setOverlapDates] = useState(null);
  const [startEndDates, setStartEndDates] = useState([]);

  // Обновление заказов при изменении контекста
  useEffect(() => {
    const updatedOrders = ordersByCarId(carId);
    setCarOrders(updatedOrders);
  }, [carId, ordersByCarId, contextAllOrders]);

  // Вычисление производных данных — единый pipeline из domain/calendar
  useEffect(() => {
    const {
      unavailableDates,
      confirmedDates: confirmed,
      startEndDates: startEnd,
      startEndOverlapDates: transformedStartEndOverlap,
      overlapDates: overlap,
    } = getCarCalendarOrderDerivedState(carOrders);

    setOverlapDates(overlap);
    setStartEndOverlapDates(transformedStartEndOverlap);
    setUnavailableDates(unavailableDates);
    setConfirmedDates(confirmed);
    setStartEndDates(startEnd);
  }, [carOrders]);

  return {
    carOrders,
    unavailableDates,
    confirmedDates,
    startEndOverlapDates,
    overlapDates,
    startEndDates,
  };
}

