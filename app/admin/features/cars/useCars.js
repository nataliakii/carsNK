"use client";

import { useState, useCallback, useMemo } from "react";
import { useMainContext } from "@app/Context";

/**
 * useCars - хук для управления машинами в админке
 * 
 * Содержит:
 * - Данные машин из контекста
 * - Логику добавления/удаления машин
 * - Состояние модалов для машин
 */
export function useCars() {
  const {
    cars,
    resubmitCars,
    deleteCarInContext,
    isLoading,
  } = useMainContext();

  // ─────────────────────────────────────────────────────────────
  // LOCAL STATE
  // ─────────────────────────────────────────────────────────────
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState(null);
  const [notification, setNotification] = useState(null);

  // ─────────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────────
  
  const safeCars = useMemo(
    () => (Array.isArray(cars) ? cars : []),
    [cars]
  );

  // Sorted cars list (alphabetically by model)
  const sortedCars = useMemo(
    () =>
      [...safeCars].sort((a, b) =>
        String(a?.model || "").localeCompare(String(b?.model || ""))
      ),
    [safeCars]
  );

  const hasCars = useMemo(() => safeCars.length > 0, [safeCars]);
  const firstCar = useMemo(() => safeCars[0] || null, [safeCars]);

  // ─────────────────────────────────────────────────────────────
  // MODAL HANDLERS
  // ─────────────────────────────────────────────────────────────
  
  const openAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const openEditModal = useCallback((car) => {
    setSelectedCar(car);
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedCar(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATION HANDLERS
  // ─────────────────────────────────────────────────────────────
  
  const showSuccess = useCallback((message) => {
    setNotification({ type: 200, message });
  }, []);

  const showError = useCallback((message) => {
    setNotification({ type: 500, message });
  }, []);

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // ASYNC ACTIONS
  // ─────────────────────────────────────────────────────────────
  
  /**
   * Delete car and show notification
   */
  const deleteCar = useCallback(
    async (carId) => {
      const { success, message, errorMessage } = await deleteCarInContext(carId);

      if (success) {
        setNotification({
          type: 200,
          message: message || "Car deleted successfully",
        });
        await resubmitCars();
      } else {
        setNotification({
          type: 500,
          message: errorMessage || "Failed to delete the car.",
        });
      }
    },
    [deleteCarInContext, resubmitCars]
  );

  /**
   * Refresh cars list from server
   */
  const refreshCars = useCallback(async () => {
    await resubmitCars();
  }, [resubmitCars]);

  // ─────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────
  
  return {
    // Data
    cars: safeCars,
    sortedCars,
    hasCars,
    firstCar,
    selectedCar,
    isLoading,
    
    // UI State
    isAddModalOpen,
    isEditModalOpen,
    notification,
    
    // Modal Actions
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    setSelectedCar,
    
    // Notification Actions
    showSuccess,
    showError,
    closeNotification,
    setNotification, // Backward compatibility
    
    // Data Actions
    deleteCar,
    refreshCars,
    resubmitCars, // Backward compatibility
  };
}

export default useCars;

