"use client";

import { useState, useCallback, useMemo } from "react";

/**
 * useAdminUI - хук для управления UI-состоянием админки
 * 
 * Отвечает ТОЛЬКО за:
 * - Состояние модальных окон
 * - Уведомления (notifications)
 * - Выбранные элементы для UI
 * 
 * НЕ содержит бизнес-логики или API-вызовов
 */
export function useAdminUI() {
  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS STATE
  // ─────────────────────────────────────────────────────────────
  
  const [notification, setNotification] = useState(null);

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
  // MODAL STATE - Generic modal management
  // ─────────────────────────────────────────────────────────────
  
  const [modals, setModals] = useState({
    addCar: false,
    editCar: false,
    addOrder: false,
    editOrder: false,
  });

  const openModal = useCallback((modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      addCar: false,
      editCar: false,
      addOrder: false,
      editOrder: false,
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SELECTION STATE
  // ─────────────────────────────────────────────────────────────
  
  const [selectedItem, setSelectedItem] = useState(null);

  const selectItem = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // DERIVED STATE
  // ─────────────────────────────────────────────────────────────
  
  const hasOpenModal = useMemo(
    () => Object.values(modals).some(Boolean),
    [modals]
  );

  // ─────────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────────
  
  return {
    // Notifications
    notification,
    showSuccess,
    showError,
    closeNotification,
    setNotification, // For backward compatibility
    
    // Modals
    modals,
    openModal,
    closeModal,
    closeAllModals,
    hasOpenModal,
    
    // Selection
    selectedItem,
    selectItem,
    clearSelection,
    setSelectedItem, // For backward compatibility
  };
}

export default useAdminUI;

