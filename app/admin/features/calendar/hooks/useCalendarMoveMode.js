"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dayjs from "dayjs";
import {
  getCarAvailability,
  isOrderCompatible,
  isOrderOnCar,
} from "@/domain/calendar";
import {
  buildOrderDateRange,
  calendarDayDelta,
  shiftOrderByDays,
} from "./calendarDays";
import { moveOrderToCar, changeRentalDates } from "@utils/action";

const ORDER_DRAG_MIME = "application/x-car-calendar-order-id";
const BUSINESS_TZ = "Europe/Athens";

function formatRangeRu(startStr, endStr) {
  const fmt = (s) => dayjs.tz(s, "YYYY-MM-DD", BUSINESS_TZ).format("DD.MM.YYYY");
  return `${fmt(startStr)} – ${fmt(endStr)}`;
}

/**
 * Hook for calendar move mode: car-to-car drag + same-car date shift.
 */
export function useCalendarMoveMode({
  cars,
  ordersByCarId,
  fetchAndUpdateOrders,
  showSingleSnackbar,
  scrollContainerRef,
}) {
  const [moveMode, setMoveMode] = useState(false);
  const [selectedMoveOrder, setSelectedMoveOrder] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    kind: null, // 'car' | 'dates'
    newCar: null,
    oldCar: null,
    dayDelta: 0,
    fromRange: null,
    toRange: null,
  });

  const [isDraggingOrder, setIsDraggingOrder] = useState(false);
  const [dragOverCarId, setDragOverCarId] = useState(null);
  const [dragSourceDate, setDragSourceDate] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const dropHandledRef = useRef(false);
  const lastPointerXRef = useRef(null);
  const moveModeRef = useRef(false);

  useEffect(() => {
    moveModeRef.current = moveMode;
  }, [moveMode]);

  const activeDayDelta = useMemo(() => {
    if (!isDraggingOrder || !dragSourceDate || !dragOverDate) return 0;
    if (!selectedMoveOrder || !dragOverCarId) return 0;
    if (!isOrderOnCar(selectedMoveOrder, dragOverCarId)) return 0;
    return calendarDayDelta(dragSourceDate, dragOverDate);
  }, [
    isDraggingOrder,
    dragSourceDate,
    dragOverDate,
    selectedMoveOrder,
    dragOverCarId,
  ]);

  const dateShiftPreview = useMemo(() => {
    if (!selectedMoveOrder || activeDayDelta === 0) return null;
    return shiftOrderByDays(selectedMoveOrder, activeDayDelta);
  }, [selectedMoveOrder, activeDayDelta]);

  const selectedOrderDates = useMemo(() => {
    if ((!moveMode && !isDraggingOrder) || !selectedMoveOrder) return [];
    if (dateShiftPreview) {
      return buildOrderDateRange({
        rentalStartDate: dateShiftPreview.rentalStartDate,
        rentalEndDate: dateShiftPreview.rentalEndDate,
      });
    }
    return buildOrderDateRange(selectedMoveOrder);
  }, [moveMode, isDraggingOrder, selectedMoveOrder, dateShiftPreview]);

  const moveTargetHighlightActive = moveMode || isDraggingOrder;

  const isDateShiftCompatible = useCallback(
    (order, dayDelta, carId) => {
      const shifted = shiftOrderByDays(order, dayDelta);
      if (!shifted) return false;
      const today = dayjs().tz(BUSINESS_TZ).startOf("day");
      const newStart = dayjs.tz(
        shifted.rentalStartDate,
        "YYYY-MM-DD",
        BUSINESS_TZ
      );
      if (newStart.isBefore(today, "day")) return false;

      const hypothetical = {
        ...order,
        rentalStartDate: shifted.rentalStartDate,
        rentalEndDate: shifted.rentalEndDate,
        timeIn: shifted.timeIn,
        timeOut: shifted.timeOut,
      };
      const carOrders = ordersByCarId(carId);
      return isOrderCompatible(hypothetical, carOrders);
    },
    [ordersByCarId]
  );

  const isCarCompatibleForMove = useCallback(
    (carId) => {
      if (!moveTargetHighlightActive || !selectedMoveOrder) return true;

      if (isOrderOnCar(selectedMoveOrder, carId)) {
        // Same car: yellow/green only while previewing a valid date shift
        if (!isDraggingOrder) return false;
        if (activeDayDelta === 0) return false;
        return isDateShiftCompatible(
          selectedMoveOrder,
          activeDayDelta,
          carId
        );
      }

      const carOrders = ordersByCarId(carId);
      return isOrderCompatible(selectedMoveOrder, carOrders);
    },
    [
      moveTargetHighlightActive,
      selectedMoveOrder,
      isDraggingOrder,
      activeDayDelta,
      isDateShiftCompatible,
      ordersByCarId,
    ]
  );

  const handleLongPress = useCallback(
    (order) => {
      if (!order?._id) return;
      setSelectedMoveOrder(order);
      setMoveMode(true);
      showSingleSnackbar(
        "Выберите другой автомобиль для перемещения заказа. Доступные автомобили выделены желтым. Либо перетащите заказ на другой день той же машины.",
        { variant: "info", autoHideDuration: 8000 }
      );
    },
    [showSingleSnackbar]
  );

  const handleOrderDragStart = useCallback((e, order, dateStr) => {
    if (!order?._id) return;
    dropHandledRef.current = false;
    setSelectedMoveOrder(order);
    setIsDraggingOrder(true);
    setDraggingOrderId(order._id);
    setDragSourceDate(dateStr || null);
    setDragOverDate(dateStr || null);
    try {
      e.dataTransfer.setData(ORDER_DRAG_MIME, String(order._id));
      e.dataTransfer.effectAllowed = "move";
    } catch {
      // ignore
    }
  }, []);

  const handleOrderDragEnd = useCallback(() => {
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    setDraggingOrderId(null);
    lastPointerXRef.current = null;
    if (!dropHandledRef.current) {
      setSelectedMoveOrder(null);
    }
  }, []);

  const handleRowDragOver = useCallback(
    (e, car, dateStr) => {
      if (!isDraggingOrder || !selectedMoveOrder) return;
      e.preventDefault();
      e.stopPropagation();
      lastPointerXRef.current = e.clientX;
      const carId = car?._id;
      const sameCar = isOrderOnCar(selectedMoveOrder, carId);

      if (dateStr) {
        setDragOverDate(dateStr);
      }

      let canDrop = false;
      if (sameCar) {
        const delta =
          dragSourceDate && dateStr
            ? calendarDayDelta(dragSourceDate, dateStr)
            : 0;
        canDrop =
          delta !== 0 &&
          isDateShiftCompatible(selectedMoveOrder, delta, carId);
      } else {
        const carOrders = ordersByCarId(carId);
        canDrop = getCarAvailability(selectedMoveOrder, carOrders).available;
      }

      try {
        e.dataTransfer.dropEffect = canDrop ? "move" : "none";
      } catch {
        // ignore
      }
      setDragOverCarId(carId);
    },
    [
      isDraggingOrder,
      selectedMoveOrder,
      ordersByCarId,
      dragSourceDate,
      isDateShiftCompatible,
    ]
  );

  const handleRowDragLeave = useCallback((e) => {
    const tr = e.currentTarget?.closest?.("tr");
    if (tr && e.relatedTarget && tr.contains(e.relatedTarget)) return;
    setDragOverCarId(null);
    setDragOverDate(null);
  }, []);

  const handleCarSelectForMove = useCallback(
    (selectedCar) => {
      if (!selectedMoveOrder) return;

      const oldCar = cars.find((car) =>
        isOrderOnCar(selectedMoveOrder, car._id)
      );

      setConfirmModal({
        open: true,
        kind: "car",
        newCar: selectedCar,
        oldCar: oldCar,
        dayDelta: 0,
        fromRange: null,
        toRange: null,
      });
    },
    [selectedMoveOrder, cars]
  );

  const openDateShiftConfirm = useCallback(
    (dayDelta) => {
      if (!selectedMoveOrder) return;
      const shifted = shiftOrderByDays(selectedMoveOrder, dayDelta);
      if (!shifted) return;

      const fromStart = dayjs
        .utc(selectedMoveOrder.rentalStartDate)
        .tz(BUSINESS_TZ)
        .format("YYYY-MM-DD");
      const fromEnd = dayjs
        .utc(selectedMoveOrder.rentalEndDate)
        .tz(BUSINESS_TZ)
        .format("YYYY-MM-DD");

      setConfirmModal({
        open: true,
        kind: "dates",
        newCar: null,
        oldCar: null,
        dayDelta: shifted.dayDelta,
        fromRange: formatRangeRu(fromStart, fromEnd),
        toRange: formatRangeRu(
          shifted.rentalStartDate,
          shifted.rentalEndDate
        ),
        shifted,
      });
    },
    [selectedMoveOrder]
  );

  const handleRowDrop = useCallback(
    (e, car, dateStr) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDraggingOrder || !selectedMoveOrder) return;

      const carId = car?._id;
      const sameCar = isOrderOnCar(selectedMoveOrder, carId);

      if (sameCar) {
        if (!dateStr || !dragSourceDate) return;
        const delta = calendarDayDelta(dragSourceDate, dateStr);
        if (delta === 0) return;
        if (!isDateShiftCompatible(selectedMoveOrder, delta, carId)) {
          showSingleSnackbar(
            "Нельзя перенести на эти даты (прошлое или конфликт)",
            { variant: "warning", autoHideDuration: 4000 }
          );
          return;
        }

        dropHandledRef.current = true;
        setIsDraggingOrder(false);
        setDragOverCarId(null);
        setDragOverDate(null);
        setDraggingOrderId(null);
        lastPointerXRef.current = null;
        openDateShiftConfirm(delta);
        return;
      }

      const carOrders = ordersByCarId(carId);
      if (!isOrderCompatible(selectedMoveOrder, carOrders)) return;

      dropHandledRef.current = true;
      setIsDraggingOrder(false);
      setDragOverCarId(null);
      setDragOverDate(null);
      setDraggingOrderId(null);
      lastPointerXRef.current = null;

      handleCarSelectForMove({
        _id: car._id,
        carNumber: car.carNumber,
        model: car.model,
        regNumber: car.regNumber,
      });
    },
    [
      isDraggingOrder,
      selectedMoveOrder,
      ordersByCarId,
      handleCarSelectForMove,
      dragSourceDate,
      isDateShiftCompatible,
      openDateShiftConfirm,
      showSingleSnackbar,
    ]
  );

  const exitMoveMode = useCallback(() => {
    const wasLongPressMode = moveModeRef.current;
    setMoveMode(false);
    setSelectedMoveOrder(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    if (wasLongPressMode) {
      showSingleSnackbar("Режим перемещения отключён", { variant: "info" });
    }
  }, [showSingleSnackbar]);

  const cancelDragOnly = useCallback(() => {
    dropHandledRef.current = false;
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    setDraggingOrderId(null);
    lastPointerXRef.current = null;
    setSelectedMoveOrder(null);
  }, []);

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

  useEffect(() => {
    if (!isDraggingOrder) return;
    const EDGE = 56;
    const SPEED = 14;
    let raf = 0;

    const tick = () => {
      const el = scrollContainerRef?.current;
      const x = lastPointerXRef.current;
      if (
        el != null &&
        x != null &&
        typeof el.getBoundingClientRect === "function"
      ) {
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

  const handleConfirmMove = useCallback(async () => {
    const kind = confirmModal.kind;
    const newCar = confirmModal.newCar;
    const order = selectedMoveOrder;
    const shifted = confirmModal.shifted;

    if (!order?._id) {
      showSingleSnackbar("❌ Нет данных для перемещения", { variant: "error" });
      exitMoveMode();
      setConfirmModal({
        open: false,
        kind: null,
        newCar: null,
        oldCar: null,
        dayDelta: 0,
        fromRange: null,
        toRange: null,
      });
      return;
    }

    setConfirmModal({
      open: false,
      kind: null,
      newCar: null,
      oldCar: null,
      dayDelta: 0,
      fromRange: null,
      toRange: null,
    });

    try {
      if (kind === "dates") {
        if (!shifted) {
          showSingleSnackbar("Некорректный сдвиг дат", { variant: "error" });
          return;
        }

        const result = await changeRentalDates(
          order._id,
          shifted.rentalStartDate,
          shifted.rentalEndDate,
          shifted.timeIn,
          shifted.timeOut,
          order.placeIn || "",
          order.placeOut || "",
          order.car?._id || order.car,
          order.carNumber
        );

        if (result?.status === 201 || result?.status === 202) {
          await fetchAndUpdateOrders();
          const conflictMsg =
            result.conflicts?.length > 0
              ? " (есть конфликты с неподтвержденными заказами)"
              : "";
          showSingleSnackbar(
            `Заказ перенесён на ${formatRangeRu(
              shifted.rentalStartDate,
              shifted.rentalEndDate
            )}${conflictMsg}`,
            { variant: "success" }
          );
        } else if (result?.status === 409) {
          showSingleSnackbar(
            result.message ||
              "Конфликт с подтвержденными заказами. Перенос невозможен.",
            { variant: "error", autoHideDuration: 5000 }
          );
        } else if (result?.status === 403) {
          showSingleSnackbar(
            result.message || "Нет прав на изменение дат этого заказа",
            { variant: "error", autoHideDuration: 5000 }
          );
        } else {
          showSingleSnackbar(result.message || "Ошибка переноса дат", {
            variant: "error",
          });
        }
        return;
      }

      // kind === 'car'
      if (!newCar?._id) {
        showSingleSnackbar("❌ Нет данных для перемещения", {
          variant: "error",
        });
        return;
      }

      const result = await moveOrderToCar(
        order._id,
        newCar._id,
        newCar.carNumber
      );

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
        showSingleSnackbar(
          result.message ||
            "Конфликт с подтвержденными заказами. Перемещение невозможно.",
          { variant: "error", autoHideDuration: 5000 }
        );
      } else {
        showSingleSnackbar(result.message || "Ошибка перемещения заказа", {
          variant: "error",
        });
      }
    } catch (error) {
      showSingleSnackbar(`Ошибка перемещения: ${error.message}`, {
        variant: "error",
      });
    } finally {
      exitMoveMode();
    }
  }, [
    confirmModal,
    selectedMoveOrder,
    fetchAndUpdateOrders,
    showSingleSnackbar,
    exitMoveMode,
  ]);

  const handleCloseConfirmModal = useCallback(() => {
    setConfirmModal({
      open: false,
      kind: null,
      newCar: null,
      oldCar: null,
      dayDelta: 0,
      fromRange: null,
      toRange: null,
    });
    exitMoveMode();
  }, [exitMoveMode]);

  const orderToMove = selectedMoveOrder;

  return {
    moveMode,
    selectedMoveOrder,
    orderToMove,
    confirmModal,
    isDraggingOrder,
    dragOverCarId,
    draggingOrderId,
    selectedOrderDates,
    isCarCompatibleForMove,
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
