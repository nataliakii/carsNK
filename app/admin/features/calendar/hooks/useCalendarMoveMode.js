"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { getCarAvailability, isOrderCompatible, isOrderOnCar } from "@/domain/calendar";
import { buildOrderDateRange } from "./calendarDays";
import { moveOrderToCar } from "@utils/action";

const ORDER_DRAG_MIME = "application/x-car-calendar-order-id";

/**
 * Hook for managing calendar move mode state and logic
 *
 * @param {Object} params
 * @param {Array} params.cars - Array of car objects
 * @param {Function} params.ordersByCarId - Function to get orders by car ID
 * @param {Function} params.fetchAndUpdateOrders - Function to refresh orders
 * @param {Function} params.showSingleSnackbar - Function to show snackbar messages
 * @param {{ current: HTMLElement | null }} [params.scrollContainerRef] - horizontal scroll container for auto-scroll while dragging
 * @returns {Object} Move mode state and handlers
 */
export function useCalendarMoveMode({
  cars,
  ordersByCarId,
  fetchAndUpdateOrders,
  showSingleSnackbar,
  scrollContainerRef,
}) {
  // =======================
  // 🚚 Move order mode state
  // =======================
  const [moveMode, setMoveMode] = useState(false);
  const [selectedMoveOrder, setSelectedMoveOrder] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    newCar: null,
    oldCar: null,
  });

  const [isDraggingOrder, setIsDraggingOrder] = useState(false);
  const [dragOverCarId, setDragOverCarId] = useState(null);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const dropHandledRef = useRef(false);
  const lastPointerXRef = useRef(null);
  const moveModeRef = useRef(false);

  useEffect(() => {
    moveModeRef.current = moveMode;
  }, [moveMode]);

  // =======================
  // 📊 Derived state
  // =======================
  // Генерируем массив дат для выбранного заказа в режиме перемещения
  const selectedOrderDates = useMemo(() => {
    if ((!moveMode && !isDraggingOrder) || !selectedMoveOrder) return [];
    return buildOrderDateRange(selectedMoveOrder);
  }, [moveMode, isDraggingOrder, selectedMoveOrder]);

  const moveTargetHighlightActive = moveMode || isDraggingOrder;

  // Функция проверки совместимости автомобиля для перемещения
  const isCarCompatibleForMove = useCallback(
    (carId) => {
      if (!moveTargetHighlightActive || !selectedMoveOrder) return true;

      if (isOrderOnCar(selectedMoveOrder, carId)) return false;

      const carOrders = ordersByCarId(carId);
      return isOrderCompatible(selectedMoveOrder, carOrders);
    },
    [moveTargetHighlightActive, selectedMoveOrder, ordersByCarId]
  );

  // =======================
  // 🎮 Handlers
  // =======================
  const handleLongPress = useCallback(
    (order) => {
      if (!order?._id) return;
      setSelectedMoveOrder(order);
      setMoveMode(true);
      showSingleSnackbar(
        "Выберите другой автомобиль для перемещения заказа. Доступные автомобили выделены желтым цветом",
        { variant: "info", autoHideDuration: 8000 }
      );
    },
    [showSingleSnackbar]
  );

  const handleOrderDragStart = useCallback(
    (e, order) => {
      if (!order?._id) return;
      dropHandledRef.current = false;
      setSelectedMoveOrder(order);
      setIsDraggingOrder(true);
      setDraggingOrderId(order._id);
      try {
        e.dataTransfer.setData(ORDER_DRAG_MIME, String(order._id));
        e.dataTransfer.effectAllowed = "move";
      } catch {
        // ignore
      }
    },
    []
  );

  const handleOrderDragEnd = useCallback(() => {
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDraggingOrderId(null);
    lastPointerXRef.current = null;
    if (!dropHandledRef.current) {
      setSelectedMoveOrder(null);
    }
  }, []);

  const handleRowDragOver = useCallback(
    (e, car) => {
      if (!isDraggingOrder || !selectedMoveOrder) return;
      e.preventDefault();
      e.stopPropagation();
      lastPointerXRef.current = e.clientX;
      const carId = car?._id;
      const sameCar = isOrderOnCar(selectedMoveOrder, carId);
      const carOrders = ordersByCarId(carId);
      const canDrop =
        !sameCar && getCarAvailability(selectedMoveOrder, carOrders).available;
      try {
        e.dataTransfer.dropEffect = canDrop ? "move" : "none";
      } catch {
        // ignore
      }
      setDragOverCarId(carId);
    },
    [isDraggingOrder, selectedMoveOrder, ordersByCarId]
  );

  const handleRowDragLeave = useCallback((e) => {
    const tr = e.currentTarget?.closest?.("tr");
    if (tr && e.relatedTarget && tr.contains(e.relatedTarget)) return;
    setDragOverCarId(null);
  }, []);

  const handleCarSelectForMove = useCallback(
    (selectedCar) => {
      if (!selectedMoveOrder) return;

      const oldCar = cars.find((car) => car._id === selectedMoveOrder.car);

      setConfirmModal({
        open: true,
        newCar: selectedCar,
        oldCar: oldCar,
      });
    },
    [selectedMoveOrder, cars]
  );

  const handleRowDrop = useCallback(
    (e, car) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDraggingOrder || !selectedMoveOrder) return;
      const carId = car?._id;
      if (isOrderOnCar(selectedMoveOrder, carId)) return;
      const carOrders = ordersByCarId(carId);
      if (!isOrderCompatible(selectedMoveOrder, carOrders)) return;

      dropHandledRef.current = true;
      setIsDraggingOrder(false);
      setDragOverCarId(null);
      setDraggingOrderId(null);
      lastPointerXRef.current = null;

      handleCarSelectForMove({
        _id: car._id,
        carNumber: car.carNumber,
        model: car.model,
        regNumber: car.regNumber,
      });
    },
    [isDraggingOrder, selectedMoveOrder, ordersByCarId, handleCarSelectForMove]
  );

  const exitMoveMode = useCallback(() => {
    const wasLongPressMode = moveModeRef.current;
    setMoveMode(false);
    setSelectedMoveOrder(null);
    if (wasLongPressMode) {
      showSingleSnackbar("Режим перемещения отключён", { variant: "info" });
    }
  }, [showSingleSnackbar]);

  const cancelDragOnly = useCallback(() => {
    dropHandledRef.current = false;
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDraggingOrderId(null);
    lastPointerXRef.current = null;
    setSelectedMoveOrder(null);
  }, []);

  // =======================
  // 🎹 ESC key listener для выхода из режима перемещения
  // =======================
  useEffect(() => {
    if (!moveMode) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitMoveMode();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveMode, exitMoveMode]);

  // ESC отменяет только drag (без long-press режима)
  useEffect(() => {
    if (!isDraggingOrder || moveMode) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDragOnly();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDraggingOrder, moveMode, cancelDragOnly]);

  useEffect(() => {
    if (!isDraggingOrder) return;
    const onMove = (e) => {
      lastPointerXRef.current = e.clientX;
    };
    document.addEventListener("dragover", onMove);
    return () => document.removeEventListener("dragover", onMove);
  }, [isDraggingOrder]);

  // Горизонтальный auto-scroll у краёв TableContainer во время drag
  useEffect(() => {
    if (!isDraggingOrder) return;
    const EDGE = 56;
    const SPEED = 14;
    let raf = 0;

    const tick = () => {
      const el = scrollContainerRef?.current;
      const x = lastPointerXRef.current;
      if (el != null && x != null && typeof el.getBoundingClientRect === "function") {
        const rect = el.getBoundingClientRect();
        if (x < rect.left + EDGE) {
          el.scrollLeft -= SPEED;
        } else if (x > rect.right - EDGE) {
          el.scrollLeft += SPEED;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [isDraggingOrder, scrollContainerRef]);

  // =======================
  // 🔄 Confirm modal handlers
  // =======================
  const handleConfirmMove = useCallback(async () => {
    // 🔧 FIX: Capture values BEFORE clearing state
    const newCar = confirmModal.newCar;
    const order = selectedMoveOrder;

    // Defensive guards
    if (!newCar?._id || !order?._id) {
      showSingleSnackbar("❌ Нет данных для перемещения", { variant: "error" });
      exitMoveMode();
      setConfirmModal({ open: false, newCar: null, oldCar: null });
      return;
    }

    // Close modal after capturing values
    setConfirmModal({ open: false, newCar: null, oldCar: null });

    // Debug logs (dev-friendly)
    if (process.env.NODE_ENV === "development") {
      console.log("[MOVE] newCar:", newCar);
      console.log("[MOVE] order:", order);
    }

    try {
      // Use dedicated moveCar endpoint (allows ADMIN and SUPERADMIN)
      const result = await moveOrderToCar(order._id, newCar._id, newCar.carNumber);

      if (result?.status === 201 || result?.status === 202) {
        await fetchAndUpdateOrders();
        const conflictMsg =
          result.conflicts?.length > 0
            ? " (есть конфликты с неподтвержденными заказами)"
            : "";
        showSingleSnackbar(`Заказ сдвинут на ${newCar.model}${conflictMsg}`, {
          variant: "success",
        });
      } else if (result?.status === 409) {
        // Blocking conflict
        showSingleSnackbar(
          result.message ||
            "Конфликт с подтвержденными заказами. Перемещение невозможно.",
          { variant: "error", autoHideDuration: 5000 }
        );
      } else {
        showSingleSnackbar(
          result.message || "Ошибка перемещения заказа",
          { variant: "error" }
        );
      }
    } catch (error) {
      showSingleSnackbar(`Ошибка перемещения: ${error.message}`, {
        variant: "error",
      });
    } finally {
      // Всегда выходим из режима перемещения после операции
      exitMoveMode();
    }
  }, [confirmModal, selectedMoveOrder, fetchAndUpdateOrders, showSingleSnackbar, exitMoveMode]);

  const handleCloseConfirmModal = useCallback(() => {
    setConfirmModal({ open: false, newCar: null, oldCar: null });
    exitMoveMode();
  }, [exitMoveMode]);

  // orderToMove is an alias of selectedMoveOrder
  // kept to preserve existing component contracts (CarTableRow)
  const orderToMove = selectedMoveOrder;

  return {
    // State
    moveMode,
    selectedMoveOrder,
    orderToMove, // alias
    confirmModal,
    isDraggingOrder,
    dragOverCarId,
    draggingOrderId,
    // Computed
    selectedOrderDates,
    isCarCompatibleForMove,
    // Handlers
    handleLongPress,
    handleCarSelectForMove,
    exitMoveMode,
    handleConfirmMove,
    handleCloseConfirmModal,
    handleOrderDragStart,
    handleOrderDragEnd,
    handleRowDragOver,
    handleRowDragLeave,
    handleRowDrop,
  };
}
