"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  isOrderCompatible,
  isOrderOnCar,
} from "@/domain/calendar";
import {
  buildOrderDateRange,
  calendarDayDelta,
  shiftOrderByDays,
} from "./calendarDays";
import { moveOrderToCar, changeRentalDates } from "@utils/action";

dayjs.extend(utc);
dayjs.extend(timezone);

const ORDER_DRAG_MIME = "application/x-car-calendar-order-id";
const BUSINESS_TZ = "Europe/Athens";

function formatRangeRu(startStr, endStr) {
  const fmt = (s) =>
    dayjs.tz(s, "YYYY-MM-DD", BUSINESS_TZ).format("DD.MM.YYYY");
  return `${fmt(startStr)} – ${fmt(endStr)}`;
}

function orderRangeStrings(order) {
  return {
    start: dayjs
      .utc(order.rentalStartDate)
      .tz(BUSINESS_TZ)
      .format("YYYY-MM-DD"),
    end: dayjs.utc(order.rentalEndDate).tz(BUSINESS_TZ).format("YYYY-MM-DD"),
  };
}

function emptyConfirm() {
  return {
    open: false,
    kind: null, // 'car' | 'dates' | 'car+dates'
    newCar: null,
    oldCar: null,
    dayDelta: 0,
    fromRange: null,
    toRange: null,
    shifted: null,
  };
}

function buildDragGhost(order, dayCount) {
  const el = document.createElement("div");
  const name =
    order.customerName ||
    order.customer?.name ||
    order.regNumber ||
    "Заказ";
  el.textContent = `${name} · ${dayCount} дн.`;
  el.setAttribute(
    "style",
    [
      "position:fixed",
      "top:-1000px",
      "left:-1000px",
      "z-index:10000",
      "padding:8px 14px",
      "border-radius:999px",
      "background:#0B1F3A",
      "color:#fff",
      "font:600 13px/1.2 system-ui,sans-serif",
      "box-shadow:0 8px 24px rgba(11,31,58,0.35)",
      "letter-spacing:0.2px",
      "white-space:nowrap",
      "pointer-events:none",
    ].join(";")
  );
  document.body.appendChild(el);
  return el;
}

/**
 * Calendar move mode: drag to any day and/or another car, with live preview.
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
  const [confirmModal, setConfirmModal] = useState(emptyConfirm);

  const [isDraggingOrder, setIsDraggingOrder] = useState(false);
  const [dragOverCarId, setDragOverCarId] = useState(null);
  const [dragSourceDate, setDragSourceDate] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [dragHud, setDragHud] = useState(null);

  const dropHandledRef = useRef(false);
  const lastPointerRef = useRef({ x: null, y: null });
  const moveModeRef = useRef(false);
  const ghostRef = useRef(null);
  // Sync drag session for dragover/drop — React state lags one frame and
  // browsers cancel HTML5 DnD if preventDefault is missing on early dragover.
  const dragSessionRef = useRef(null);

  useEffect(() => {
    moveModeRef.current = moveMode;
  }, [moveMode]);

  /** Day delta from grab cell → hover cell (any car). */
  const previewDayDelta = useMemo(() => {
    if (!isDraggingOrder || !dragSourceDate || !dragOverDate) return 0;
    return calendarDayDelta(dragSourceDate, dragOverDate);
  }, [isDraggingOrder, dragSourceDate, dragOverDate]);

  const dateShiftPreview = useMemo(() => {
    if (!selectedMoveOrder || previewDayDelta === 0) return null;
    return shiftOrderByDays(selectedMoveOrder, previewDayDelta);
  }, [selectedMoveOrder, previewDayDelta]);

  const landingOrder = useMemo(() => {
    if (!selectedMoveOrder) return null;
    if (!dateShiftPreview) return selectedMoveOrder;
    return {
      ...selectedMoveOrder,
      rentalStartDate: dateShiftPreview.rentalStartDate,
      rentalEndDate: dateShiftPreview.rentalEndDate,
      timeIn: dateShiftPreview.timeIn,
      timeOut: dateShiftPreview.timeOut,
    };
  }, [selectedMoveOrder, dateShiftPreview]);

  const selectedOrderDates = useMemo(() => {
    if ((!moveMode && !isDraggingOrder) || !landingOrder) return [];
    return buildOrderDateRange(landingOrder);
  }, [moveMode, isDraggingOrder, landingOrder]);

  const moveTargetHighlightActive = moveMode || isDraggingOrder;

  const isLandingCompatibleOnCar = useCallback(
    (order, carId, dayDelta) => {
      if (!order || carId == null) return false;
      let candidate = order;
      if (dayDelta !== 0) {
        const shifted = shiftOrderByDays(order, dayDelta);
        if (!shifted) return false;
        const today = dayjs().tz(BUSINESS_TZ).startOf("day");
        const newStart = dayjs.tz(
          shifted.rentalStartDate,
          "YYYY-MM-DD",
          BUSINESS_TZ
        );
        if (newStart.isBefore(today, "day")) return false;
        candidate = {
          ...order,
          rentalStartDate: shifted.rentalStartDate,
          rentalEndDate: shifted.rentalEndDate,
          timeIn: shifted.timeIn,
          timeOut: shifted.timeOut,
        };
      } else if (isOrderOnCar(order, carId)) {
        return false; // same car, same dates = no-op
      }

      const carOrders = ordersByCarId(carId);
      return isOrderCompatible(candidate, carOrders);
    },
    [ordersByCarId]
  );

  const isCarCompatibleForMove = useCallback(
    (carId) => {
      if (!moveTargetHighlightActive || !selectedMoveOrder) return true;

      if (isDraggingOrder) {
        return isLandingCompatibleOnCar(
          selectedMoveOrder,
          carId,
          previewDayDelta
        );
      }

      // Long-press: only other cars, original dates
      if (isOrderOnCar(selectedMoveOrder, carId)) return false;
      const carOrders = ordersByCarId(carId);
      return isOrderCompatible(selectedMoveOrder, carOrders);
    },
    [
      moveTargetHighlightActive,
      selectedMoveOrder,
      isDraggingOrder,
      previewDayDelta,
      isLandingCompatibleOnCar,
      ordersByCarId,
    ]
  );

  const updateHud = useCallback((car, dateStr, canDrop, dayDelta) => {
    const x = lastPointerRef.current.x;
    const y = lastPointerRef.current.y;
    const order =
      dragSessionRef.current?.order || null;
    if (x == null || y == null || !order) {
      setDragHud(null);
      return;
    }

    const range = orderRangeStrings(order);
    let toRange = formatRangeRu(range.start, range.end);
    if (dayDelta !== 0) {
      const shifted = shiftOrderByDays(order, dayDelta);
      if (shifted) {
        toRange = formatRangeRu(
          shifted.rentalStartDate,
          shifted.rentalEndDate
        );
      }
    }

    const sameCar = isOrderOnCar(order, car?._id);
    const carLabel = car
      ? `${car.model || ""} ${car.regNumber || ""}`.trim()
      : "—";

    let action = "";
    if (sameCar && dayDelta !== 0) {
      action = `Даты → ${toRange}`;
    } else if (!sameCar && dayDelta !== 0) {
      action = `${carLabel} · ${toRange}`;
    } else if (!sameCar) {
      action = `На ${carLabel}`;
    } else {
      action = "Отпустите на другой день или машину";
    }

    setDragHud({
      x,
      y,
      canDrop,
      action,
      deltaLabel:
        dayDelta !== 0 ? `${dayDelta > 0 ? "+" : ""}${dayDelta} дн.` : null,
      dateStr: dateStr || null,
    });
  }, []);

  const handleLongPress = useCallback(
    (order) => {
      if (!order?._id) return;
      setSelectedMoveOrder(order);
      setMoveMode(true);
      showSingleSnackbar(
        "Перетащите заказ на другой день/машину, или на телефоне: удерживайте ~0.3с и тапните цель",
        { variant: "info", autoHideDuration: 7000 }
      );
    },
    [showSingleSnackbar]
  );

  const handleOrderDragStart = useCallback((e, order, dateStr) => {
    if (!order?._id) return;
    dropHandledRef.current = false;
    dragSessionRef.current = {
      order,
      sourceDate: dateStr || null,
    };
    setSelectedMoveOrder(order);
    setIsDraggingOrder(true);
    setDraggingOrderId(order._id);
    setDragSourceDate(dateStr || null);
    setDragOverDate(dateStr || null);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    const days = buildOrderDateRange(order).length || 1;
    try {
      e.dataTransfer.setData(ORDER_DRAG_MIME, String(order._id));
      e.dataTransfer.effectAllowed = "move";
      // Keep ghost in DOM for the whole drag — removing it early aborts DnD in Chrome/Safari.
      if (ghostRef.current) {
        ghostRef.current.remove();
        ghostRef.current = null;
      }
      const ghost = buildDragGhost(order, days);
      ghostRef.current = ghost;
      e.dataTransfer.setDragImage(ghost, 24, 16);
    } catch {
      // ignore
    }
  }, []);

  const handleOrderDragEnd = useCallback(() => {
    dragSessionRef.current = null;
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    setDraggingOrderId(null);
    setDragHud(null);
    lastPointerRef.current = { x: null, y: null };
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    if (!dropHandledRef.current) {
      setSelectedMoveOrder(null);
    }
  }, []);

  const handleRowDragOver = useCallback(
    (e, car, dateStr) => {
      const session = dragSessionRef.current;
      const order = session?.order || selectedMoveOrder;
      if (!order) return;
      e.preventDefault();
      e.stopPropagation();
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const carId = car?._id;
      if (dateStr) setDragOverDate(dateStr);

      const sourceDate = session?.sourceDate ?? dragSourceDate;
      const delta =
        sourceDate && dateStr ? calendarDayDelta(sourceDate, dateStr) : 0;
      const canDrop = isLandingCompatibleOnCar(order, carId, delta);

      try {
        e.dataTransfer.dropEffect = canDrop ? "move" : "none";
      } catch {
        // ignore
      }
      setDragOverCarId(carId);
      updateHud(car, dateStr, canDrop, delta);
    },
    [selectedMoveOrder, dragSourceDate, isLandingCompatibleOnCar, updateHud]
  );

  const handleRowDragLeave = useCallback((e) => {
    const tr = e.currentTarget?.closest?.("tr");
    if (tr && e.relatedTarget && tr.contains(e.relatedTarget)) return;
    setDragOverCarId(null);
    setDragOverDate(null);
    setDragHud((prev) =>
      prev ? { ...prev, canDrop: false, action: "…" } : null
    );
  }, []);

  const openMoveConfirm = useCallback(
    ({ kind, newCar, dayDelta, shifted, order: orderOverride }) => {
      const order = orderOverride || selectedMoveOrder;
      if (!order) return;
      const oldCar = cars.find((car) => isOrderOnCar(order, car._id));
      const range = orderRangeStrings(order);

      setConfirmModal({
        open: true,
        kind,
        newCar: newCar || null,
        oldCar: oldCar || null,
        dayDelta: dayDelta || 0,
        fromRange: formatRangeRu(range.start, range.end),
        toRange: shifted
          ? formatRangeRu(shifted.rentalStartDate, shifted.rentalEndDate)
          : formatRangeRu(range.start, range.end),
        shifted: shifted || null,
      });
    },
    [selectedMoveOrder, cars]
  );

  const handleCarSelectForMove = useCallback(
    (selectedCar) => {
      if (!selectedMoveOrder) return;
      openMoveConfirm({
        kind: "car",
        newCar: selectedCar,
        dayDelta: 0,
        shifted: null,
      });
    },
    [selectedMoveOrder, openMoveConfirm]
  );

  const handleRowDrop = useCallback(
    (e, car, dateStr) => {
      e.preventDefault();
      e.stopPropagation();
      const session = dragSessionRef.current;
      const order = session?.order || selectedMoveOrder;
      if (!order) return;

      const carId = car?._id;
      const sameCar = isOrderOnCar(order, carId);
      const sourceDate = session?.sourceDate ?? dragSourceDate;
      const delta =
        dateStr && sourceDate ? calendarDayDelta(sourceDate, dateStr) : 0;

      if (!isLandingCompatibleOnCar(order, carId, delta)) {
        showSingleSnackbar(
          "Сюда нельзя: прошлое, конфликт или то же место",
          { variant: "warning", autoHideDuration: 3500 }
        );
        return;
      }

      dropHandledRef.current = true;
      dragSessionRef.current = null;
      setIsDraggingOrder(false);
      setDragOverCarId(null);
      setDragOverDate(null);
      setDraggingOrderId(null);
      setDragHud(null);
      lastPointerRef.current = { x: null, y: null };
      // Keep selectedMoveOrder for confirm modal
      setSelectedMoveOrder(order);

      const carPayload = {
        _id: car._id,
        carNumber: car.carNumber,
        model: car.model,
        regNumber: car.regNumber,
      };

      if (sameCar) {
        const shifted = shiftOrderByDays(order, delta);
        openMoveConfirm({
          kind: "dates",
          newCar: null,
          dayDelta: delta,
          shifted,
          order,
        });
        return;
      }

      if (delta !== 0) {
        const shifted = shiftOrderByDays(order, delta);
        openMoveConfirm({
          kind: "car+dates",
          newCar: carPayload,
          dayDelta: delta,
          shifted,
          order,
        });
        return;
      }

      openMoveConfirm({
        kind: "car",
        newCar: carPayload,
        dayDelta: 0,
        shifted: null,
        order,
      });
    },
    [
      selectedMoveOrder,
      dragSourceDate,
      isLandingCompatibleOnCar,
      openMoveConfirm,
      showSingleSnackbar,
    ]
  );

  const exitMoveMode = useCallback(() => {
    const wasLongPressMode = moveModeRef.current;
    dragSessionRef.current = null;
    setMoveMode(false);
    setSelectedMoveOrder(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    setDragHud(null);
    if (wasLongPressMode) {
      showSingleSnackbar("Режим перемещения отключён", { variant: "info" });
    }
  }, [showSingleSnackbar]);

  const cancelDragOnly = useCallback(() => {
    dropHandledRef.current = false;
    dragSessionRef.current = null;
    setIsDraggingOrder(false);
    setDragOverCarId(null);
    setDragSourceDate(null);
    setDragOverDate(null);
    setDraggingOrderId(null);
    setDragHud(null);
    lastPointerRef.current = { x: null, y: null };
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
    return () => document.removeEventListener("keydown", handleKeyDown);
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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDraggingOrder, moveMode, cancelDragOnly]);

  useEffect(() => {
    if (!isDraggingOrder) return;
    const onMove = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      setDragHud((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : prev
      );
    };
    document.addEventListener("dragover", onMove);
    return () => document.removeEventListener("dragover", onMove);
  }, [isDraggingOrder]);

  // Horizontal + vertical auto-scroll near edges
  useEffect(() => {
    if (!isDraggingOrder) return;
    const EDGE = 56;
    const SPEED = 16;
    let raf = 0;

    const tick = () => {
      const el = scrollContainerRef?.current;
      const { x, y } = lastPointerRef.current;
      if (
        el != null &&
        x != null &&
        y != null &&
        typeof el.getBoundingClientRect === "function"
      ) {
        const rect = el.getBoundingClientRect();
        if (x < rect.left + EDGE) el.scrollLeft -= SPEED;
        else if (x > rect.right - EDGE) el.scrollLeft += SPEED;
        if (y < rect.top + EDGE) el.scrollTop -= SPEED;
        else if (y > rect.bottom - EDGE) el.scrollTop += SPEED;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isDraggingOrder, scrollContainerRef]);

  const applyChangeDates = useCallback(
    async (order, shifted, carOverride) => {
      const carId =
        carOverride?._id || order.car?._id || order.car || null;
      const carNumber = carOverride?.carNumber || order.carNumber;
      return changeRentalDates(
        order._id,
        shifted.rentalStartDate,
        shifted.rentalEndDate,
        shifted.timeIn,
        shifted.timeOut,
        order.placeIn || "",
        order.placeOut || "",
        carId,
        carNumber
      );
    },
    []
  );

  const handleConfirmMove = useCallback(async () => {
    const kind = confirmModal.kind;
    const newCar = confirmModal.newCar;
    const order = selectedMoveOrder;
    const shifted = confirmModal.shifted;

    if (!order?._id) {
      showSingleSnackbar("❌ Нет данных для перемещения", { variant: "error" });
      exitMoveMode();
      setConfirmModal(emptyConfirm());
      return;
    }

    setConfirmModal(emptyConfirm());

    try {
      if (kind === "dates" || kind === "car+dates") {
        if (!shifted) {
          showSingleSnackbar("Некорректный сдвиг дат", { variant: "error" });
          return;
        }

        const result = await applyChangeDates(
          order,
          shifted,
          kind === "car+dates" ? newCar : null
        );

        if (result?.status === 201 || result?.status === 202) {
          await fetchAndUpdateOrders();
          const conflictMsg =
            result.conflicts?.length > 0
              ? " (есть конфликты с неподтвержденными заказами)"
              : "";
          const carPart =
            kind === "car+dates" && newCar?.model
              ? ` → ${newCar.model}`
              : "";
          showSingleSnackbar(
            `Готово: ${formatRangeRu(
              shifted.rentalStartDate,
              shifted.rentalEndDate
            )}${carPart}${conflictMsg}`,
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
            result.message || "Нет прав на изменение этого заказа",
            { variant: "error", autoHideDuration: 5000 }
          );
        } else {
          showSingleSnackbar(result.message || "Ошибка переноса", {
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
        showSingleSnackbar(`Заказ на ${newCar.model}${conflictMsg}`, {
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
    applyChangeDates,
  ]);

  const handleCloseConfirmModal = useCallback(() => {
    setConfirmModal(emptyConfirm());
    exitMoveMode();
  }, [exitMoveMode]);

  return {
    moveMode,
    selectedMoveOrder,
    orderToMove: selectedMoveOrder,
    confirmModal,
    isDraggingOrder,
    dragOverCarId,
    dragOverDate,
    draggingOrderId,
    dragHud,
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
