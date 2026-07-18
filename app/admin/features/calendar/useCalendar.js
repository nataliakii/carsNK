"use client";

import { useMemo } from "react";
import { useMainContext } from "@app/Context";

/**
 * useCalendar - хук для Big Calendar в админке
 * 
 * Содержит:
 * - Данные машин и заказов для календаря
 * - Производные значения для отображения
 */
export function useCalendar() {
  const {
    cars,
    allOrders,
    isLoading,
  } = useMainContext();

  // ─────────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────────
  
  // Sorted cars for calendar rows
  const sortedCars = useMemo(
    () => [...cars].sort((a, b) => a.model.localeCompare(b.model)),
    [cars]
  );

  const hasCars = useMemo(() => cars.length > 0, [cars]);
  const hasOrders = useMemo(() => allOrders.length > 0, [allOrders]);

  // ─────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────
  
  return {
    // Data
    cars,
    sortedCars,
    orders: allOrders,
    allOrders, // Backward compatibility
    hasCars,
    hasOrders,
    isLoading,
  };
}

export default useCalendar;

