"use client";

import { useState, useCallback, useMemo } from "react";
import { useMainContext } from "@app/Context";

/**
 * useOrders - хук для управления заказами в админке
 * 
 * Содержит:
 * - Данные заказов из контекста
 * - Логику добавления/редактирования заказов
 * - Состояние модалов для заказов
 */
export function useOrders() {
  const {
    cars,
    allOrders,
    setAllOrders,
    fetchAndUpdateOrders,
    isLoading,
  } = useMainContext();

  // ─────────────────────────────────────────────────────────────
  // LOCAL STATE
  // ─────────────────────────────────────────────────────────────
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCar, setSelectedCar] = useState(null);
  const [notification, setNotification] = useState(null);

  // ─────────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────────────────────
  
  // Sorted cars for order selection
  const sortedCars = useMemo(
    () => [...cars].sort((a, b) => a.model.localeCompare(b.model)),
    [cars]
  );

  const hasOrders = useMemo(() => allOrders.length > 0, [allOrders]);
  const hasCars = useMemo(() => cars.length > 0, [cars]);

  // ─────────────────────────────────────────────────────────────
  // MODAL HANDLERS
  // ─────────────────────────────────────────────────────────────
  
  const openAddModal = useCallback((car = null) => {
    setSelectedCar(car);
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setSelectedCar(null);
  }, []);

  const openEditModal = useCallback((order) => {
    setSelectedOrder(order);
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedOrder(null);
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
   * Update order in local state and refetch from server
   */
  const updateOrder = useCallback(
    async (updatedOrder) => {
      // Optimistic update
      setAllOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );
      // Sync with server
      await fetchAndUpdateOrders();
    },
    [setAllOrders, fetchAndUpdateOrders]
  );

  /**
   * Refresh orders list from server
   */
  const refreshOrders = useCallback(async () => {
    await fetchAndUpdateOrders();
  }, [fetchAndUpdateOrders]);

  // ─────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────
  
  return {
    // Data
    cars,
    sortedCars,
    orders: allOrders,
    allOrders, // Backward compatibility
    hasOrders,
    hasCars,
    selectedOrder,
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
    setSelectedOrder,
    
    // Notification Actions
    showSuccess,
    showError,
    closeNotification,
    setNotification, // Backward compatibility
    
    // Data Actions
    updateOrder,
    refreshOrders,
    fetchAndUpdateOrders, // Backward compatibility
  };
}

export default useOrders;

