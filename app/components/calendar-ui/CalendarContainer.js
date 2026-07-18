"use client";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Box, TableContainer, useTheme } from "@mui/material";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

import { useMainContext } from "@app/Context";
import { formatDate } from "@utils/businessTime";
import { buildConflictMap, extractArraysOfStartEndConfPending } from "@/domain/calendar";
import { useSnackbar } from "notistack";
import { changeRentalDates } from "@utils/action";
import LegendCalendarAdmin from "./LegendCalendarAdmin";
import CalendarGrid from "./CalendarGrid";
import CalendarOverlays from "./CalendarOverlays";
import { calendarStyles } from "@/theme";
import {
  useCalendarDays,
  useMobileCalendarScroll,
  useCalendarMoveMode,
  MEAN_GREGORIAN_MONTH_DAYS,
} from "@/app/admin/features/calendar/hooks";
import { useFirstColumnWidth } from "@/hooks/useFirstColumnWidth";

// ============================================
// View layout (toolbar): фиксированный normal density
// ============================================
const BASE_ROW_HEIGHT_PX = 27;

function getDensityLayoutSx() {
  return {
    "& .bigcalendar-cell-wrapper": {
      height: "var(--calendar-row-height)",
      minHeight: "var(--calendar-row-height)",
    },
  };
}

function getCompactDensityLayoutSx() {
  return { root: {}, tableContainer: {} };
}

// ============================================
// BigCalendarLayout — визуальный каркас (без state/effects)
// ============================================
function BigCalendarLayout({
  showLegend,
  showBufferInLegend,
  showDeliveryInLegend,
  showConflictBadges,
  borderStyle,
  calendarRef,
  containerRef,
  children,
  firstColumnWidth,
  extraRootSx = {},
  extraTableContainerSx = {},
}) {
  return (
    <Box
      ref={calendarRef}
      className="bigcalendar-root" // Оставляем для media queries в globals.css
      sx={{
        ...calendarStyles.root,
        ...(firstColumnWidth && {
          "--resource-col-width": `${firstColumnWidth}px`,
        }),
        ...(showConflictBadges
          ? {}
          : {
              "& .calendar-conflict-badge": { display: "none !important" },
            }),
        ...extraRootSx,
      }}
    >
      {/* Легенда календаря */}
      {showLegend && (
        <Box data-bigcalendar-legend sx={calendarStyles.legend}>
          <LegendCalendarAdmin
            showBufferControls={showBufferInLegend}
            showDeliveryInfo={showDeliveryInLegend}
          />
        </Box>
      )}

      {/* TableContainer */}
      <TableContainer
        ref={containerRef}
        sx={{
          ...calendarStyles.tableContainer,
          border: borderStyle,
          ...extraTableContainerSx,
        }}
      >
        {children}
      </TableContainer>
    </Box>
  );
}

// ============================================
// CalendarContainer — состояние и оркестрация BigCalendar
// ============================================
export default function CalendarContainer({
  cars,
  showLegend = true,
  legendPlacement = "inline",
  showBufferInLegend = true,
  showDeliveryInLegend = true,
  showConflictBadges = true,
  highlightToday = true,
  autoScrollToToday = true,
  viewMode: viewModeProp,
  onViewModeChange,
  dayRange = "1m",
}) {
  // ─────────────────────────────────────────
  // 🔍 DEV INSTRUMENTATION (removed in production build)
  // ─────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    // Track render count to detect render storms
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    // Log every 10th render to avoid spam
    if (renderCountRef.current % 10 === 0) {
      console.log(`[BigCalendar] Render count: ${renderCountRef.current}`);
    }
  }

  // ─────────────────────────────────────────
  // Refs
  // ─────────────────────────────────────────
  const calendarRef = useRef(null);
  const containerRef = useRef(null);
  // 🔧 PERF FIX: Track timeout to prevent memory leak if component unmounts
  const addOrderTimeoutRef = useRef(null);
  const clearAddOrderTimeout = useCallback(() => {
    const timeoutId = addOrderTimeoutRef.current;
    if (timeoutId) {
      clearTimeout(timeoutId);
      addOrderTimeoutRef.current = null;
    }
  }, []);

  // ─────────────────────────────────────────
  // Тема и цвета
  // ─────────────────────────────────────────
  const theme = useTheme();

  // Централизованные стили для header
  const calendarHeaderStyles = useMemo(() => {
    const calendarColors = theme.palette.calendar || {};
    return {
      baseBg: "background.default" || "#121212",
      todayBg: calendarColors.today || "calendar.today",
      sundayText: calendarColors.sunday || theme.palette.primary.main,
      weekdayText: "text.primary",
      border: calendarColors.border || theme.palette.divider,
    };
  }, [
    theme.palette.primary.main,
    theme.palette.divider,
    theme.palette.calendar,
  ]);

  // i18n для динамического перевода месяцев и дней недели
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language || "en";

  // Названия месяцев (полные) по языкам проекта
  const monthNames = useMemo(
    () => ({
      en: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      ru: [
        "Январь",
        "Февраль",
        "Март",
        "Апрель",
        "Май",
        "Июнь",
        "Июль",
        "Август",
        "Сентябрь",
        "Октябрь",
        "Ноябрь",
        "Декабрь",
      ],
      el: [
        "Ιανουάριος",
        "Φεβρουάριος",
        "Μάρτιος",
        "Απρίλιος",
        "Μάιος",
        "Ιούνιος",
        "Ιούλιος",
        "Αύγουστος",
        "Σεπτέμβριος",
        "Οκτώβριος",
        "Νοέμβριος",
        "Δεκέμβριος",
      ],
    }),
    []
  );

  // Двухсимвольные сокращения дней недели (индекс 0 = Sunday) по языкам
  const weekday2 = useMemo(
    () => ({
      en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
      el: ["Κυ", "Δε", "Τρ", "Τε", "Πέ", "Πα", "Σά"],
    }),
    []
  );
  // ─────────────────────────────────────────
  // Notifications (snackbar)
  // ─────────────────────────────────────────
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const snackKeyRef = useRef(0);
  const showSingleSnackbar = useCallback(
    (message, options = {}) => {
      snackKeyRef.current += 1;
      enqueueSnackbar(message, { key: snackKeyRef.current, ...options });
      if (snackKeyRef.current > 1) closeSnackbar(snackKeyRef.current - 1);
    },
    [enqueueSnackbar, closeSnackbar]
  );

  // ─────────────────────────────────────────
  // Context
  // ─────────────────────────────────────────
  const { ordersByCarId, fetchAndUpdateOrders, allOrders, updateCarInContext } =
    useMainContext();

  const sortedCars = useMemo(() => {
    return [...cars].sort((a, b) => a.model.localeCompare(b.model));
  }, [cars]);

  // =======================
  // 📅 Calendar navigation
  // =======================
  const [month, setMonth] = useState(() => {
    const savedMonth = localStorage.getItem("bigCalendar_month");
    return savedMonth !== null ? parseInt(savedMonth, 10) : dayjs().month();
  });
  const [year, setYear] = useState(() => {
    const savedYear = localStorage.getItem("bigCalendar_year");
    return savedYear !== null ? parseInt(savedYear, 10) : dayjs().year();
  });
  const isViewControlled =
    viewModeProp !== undefined && typeof onViewModeChange === "function";

  const [viewModeUncontrolled, setViewModeUncontrolled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bigCalendar_viewMode");
      if (saved === "range15" || saved === "full") return saved;
    }
    return "full";
  });

  const viewMode = isViewControlled ? viewModeProp : viewModeUncontrolled;

  const setViewMode = useCallback(
    (next) => {
      if (isViewControlled) onViewModeChange(next);
      else setViewModeUncontrolled(next);
    },
    [isViewControlled, onViewModeChange]
  );
  const [rangeDirection, setRangeDirection] = useState("forward"); // 'forward' | 'backward'
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);

  // =======================
  // 📦 Orders & selection
  // =======================
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [startEndDates, setStartEndDates] = useState([]);
  const [isConflictOrder, setIsConflictOrder] = useState(false);
  const [headerOrdersModal, setHeaderOrdersModal] = useState({
    open: false,
    date: null,
    orders: [],
  });
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

  // =======================
  // 🚚 Move order mode (via hook)
  // =======================
  const moveModeConfig = useMemo(
    () => ({
      cars,
      ordersByCarId,
      fetchAndUpdateOrders,
      showSingleSnackbar,
      scrollContainerRef: containerRef,
    }),
    [cars, ordersByCarId, fetchAndUpdateOrders, showSingleSnackbar]
  );
  const moveModeHook = useCalendarMoveMode(moveModeConfig);

  // =======================
  // 🧩 UI modals
  // =======================
  const [open, setOpen] = useState(false);
  const editCloseGuardsRef = useRef(new Map());
  const [unsavedEditDialogOpen, setUnsavedEditDialogOpen] = useState(false);
  const [unsavedEditSaving, setUnsavedEditSaving] = useState(false);

  const registerEditOrderCloseGuard = useCallback((orderId, guard) => {
    const id = String(orderId);
    editCloseGuardsRef.current.set(id, guard);
    return () => {
      editCloseGuardsRef.current.delete(id);
    };
  }, []);

  const performEditModalClose = useCallback(() => {
    setOpen(false);
  }, []);

  const tryCloseEditModal = useCallback(() => {
    const guards = [...editCloseGuardsRef.current.values()];
    const dirty = guards.some((g) => g.isDirty());
    if (!dirty) {
      performEditModalClose();
      return;
    }
    setUnsavedEditDialogOpen(true);
  }, [performEditModalClose]);

  const handleEditModalBackdropClose = useCallback(
    (_event, reason) => {
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        tryCloseEditModal();
      }
    },
    [tryCloseEditModal]
  );

  const handleUnsavedEditDiscard = useCallback(() => {
    setUnsavedEditDialogOpen(false);
    performEditModalClose();
  }, [performEditModalClose]);

  const handleUnsavedEditCancel = useCallback(() => {
    setUnsavedEditDialogOpen(false);
  }, []);

  const handleUnsavedEditSave = useCallback(async () => {
    const guards = [...editCloseGuardsRef.current.values()];
    const dirtyGuards = guards.filter((g) => g.isDirty());
    setUnsavedEditSaving(true);
    try {
      let allSaved = true;
      for (const g of dirtyGuards) {
        const guardSaved = await g.save();
        if (!guardSaved) {
          allSaved = false;
          break;
        }
      }
      if (!allSaved) {
        // Keep edit modal open so user can fix validation/field errors.
        setUnsavedEditDialogOpen(false);
        return;
      }
      setUnsavedEditDialogOpen(false);
      performEditModalClose();
    } catch (err) {
      setUnsavedEditDialogOpen(false);
      showSingleSnackbar(
        err?.message || t("order.unsavedSaveBlocked"),
        { variant: "error" }
      );
    } finally {
      setUnsavedEditSaving(false);
    }
  }, [performEditModalClose, showSingleSnackbar, t]);

  useEffect(() => {
    if (!open) {
      setUnsavedEditDialogOpen(false);
      setUnsavedEditSaving(false);
    }
  }, [open]);

  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [selectedCarForAdd, setSelectedCarForAdd] = useState(null);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState(null);
  const [selectedCarForEdit, setSelectedCarForEdit] = useState(null);
  const [isEditCarOpen, setIsEditCarOpen] = useState(false);
  const [activeCell, setActiveCell] = useState({ carIndex: 0, dayIndex: 0 });

  // =======================
  // 💾 Persistence (localStorage)
  // =======================
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(
      "(max-width: 600px) and (orientation: portrait)"
    );
    const handler = () => setIsPortraitPhone(mq.matches);
    handler();
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("bigCalendar_month", month.toString());
  }, [month]);

  useEffect(() => {
    localStorage.setItem("bigCalendar_year", year.toString());
  }, [year]);

  useEffect(() => {
    if (isViewControlled || typeof window === "undefined") return;
    try {
      localStorage.setItem("bigCalendar_viewMode", viewMode);
    } catch (e) {}
  }, [viewMode, isViewControlled]);

  // 🔧 PERF FIX: Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return clearAddOrderTimeout;
  }, [clearAddOrderTimeout]);

  // Дни календаря и индекс текущего дня
  const calendarDaysParams = useMemo(
    () => ({
      month,
      year,
      viewMode,
      rangeDirection,
      calendarDayRange: dayRange,
    }),
    [month, year, viewMode, rangeDirection, dayRange]
  );
  const { days, todayIndex } = useCalendarDays(calendarDaysParams);
  const maxCarIndex = Math.max(sortedCars.length - 1, 0);
  const maxDayIndex = Math.max(days.length - 1, 0);

  useEffect(() => {
    setActiveCell((prev) => {
      const hasCars = sortedCars.length > 0;
      const hasDays = days.length > 0;
      if (!hasCars || !hasDays) return { carIndex: 0, dayIndex: 0 };
      const nextCar = Math.min(Math.max(prev.carIndex ?? 0, 0), maxCarIndex);
      const todayOrFirst =
        typeof todayIndex === "number" && todayIndex >= 0 ? todayIndex : 0;
      const nextDay = Math.min(
        Math.max(prev.dayIndex ?? todayOrFirst, 0),
        maxDayIndex
      );
      if (prev.carIndex === nextCar && prev.dayIndex === nextDay) return prev;
      return { carIndex: nextCar, dayIndex: nextDay };
    });
  }, [sortedCars.length, days.length, todayIndex, maxCarIndex, maxDayIndex]);

  const setActiveCellClamped = useCallback(
    (carIndex, dayIndex) => {
      setActiveCell((prev) => {
        const nextCar = Math.min(Math.max(carIndex, 0), maxCarIndex);
        const nextDay = Math.min(Math.max(dayIndex, 0), maxDayIndex);
        if (prev.carIndex === nextCar && prev.dayIndex === nextDay) return prev;
        return {
          carIndex: nextCar,
          dayIndex: nextDay,
        };
      });
    },
    [maxCarIndex, maxDayIndex]
  );

  const showInlineLegend =
    Boolean(showLegend) && legendPlacement === "inline";

  // Автоматический скролл к текущему дню на мобильных устройствах
  useMobileCalendarScroll({
    days,
    todayIndex,
    containerRef,
    enabled: autoScrollToToday,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || sortedCars.length === 0 || days.length === 0) return;
    const row = container.querySelector(
      `tbody tr:nth-of-type(${activeCell.carIndex + 1})`
    );
    const cell = row?.querySelector?.(
      `td[data-col-index="${activeCell.dayIndex}"]`
    );
    if (!cell) return;
    if (typeof cell.focus === "function" && document.activeElement !== cell) {
      try {
        cell.focus({ preventScroll: true });
      } catch {
        cell.focus();
      }
    }
    if (typeof cell.scrollIntoView === "function") {
      cell.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeCell, sortedCars.length, days.length]);

  // =======================
  // 🎮 Navigation handlers
  // =======================
  const handleSelectMonth = useCallback(
    (e) => {
      const newMonth = e.target.value;
      setMonth(newMonth);
      setViewMode("full");
    },
    [setViewMode]
  );

  const handleSelectYear = useCallback(
    (e) => {
      const newYear = e.target.value;
      setYear(newYear);
      setViewMode("full");
    },
    [setViewMode]
  );

  const handlePrevMonth = useCallback(() => {
    if (viewMode === "full") {
      setRangeDirection("backward");
      setViewMode("range15");
    } else {
      setViewMode("full");
      const base = dayjs().year(year).month(month).subtract(1, "month");
      setMonth(base.month());
      setYear(base.year());
    }
  }, [viewMode, year, month, setViewMode]);

  const handleNextMonth = useCallback(() => {
    if (viewMode === "full") {
      setRangeDirection("forward");
      setViewMode("range15");
    } else {
      setViewMode("full");
      const base = dayjs().year(year).month(month).add(1, "month");
      setMonth(base.month());
      setYear(base.year());
    }
  }, [viewMode, year, month, setViewMode]);

  // =======================
  // 🚚 Move mode handlers (from hook)
  // =======================
  const {
    moveMode,
    selectedMoveOrder,
    orderToMove,
    confirmModal,
    selectedOrderDates,
    isCarCompatibleForMove,
    isDraggingOrder,
    dragOverCarId,
    draggingOrderId,
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
  } = moveModeHook;

  const enableOrderDrag = !isPortraitPhone;

  // =======================
  // 📦 Orders handlers
  // =======================
  const ordersByCarIdWithAllorders = useCallback((carId, orders) => {
    return orders?.filter((order) => order.car === carId);
  }, []);

  const getOrdersForCell = useCallback(
    (carId, dateStr) => {
      const scoped = ordersByCarIdWithAllorders(carId, allOrders) || [];
      return scoped.filter((order) => {
        const startStr = formatDate(order.rentalStartDate, "YYYY-MM-DD");
        const endStr = formatDate(order.rentalEndDate, "YYYY-MM-DD");
        return startStr <= dateStr && dateStr <= endStr;
      });
    },
    [ordersByCarIdWithAllorders, allOrders]
  );

  const handleSaveOrder = useCallback(
    async (updatedOrder) => {
      setSelectedOrders((prevSelectedOrders) =>
        prevSelectedOrders.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      );
      await fetchAndUpdateOrders();
    },
    [fetchAndUpdateOrders]
  );

  // =======================
  // 🚗 Car handlers
  // =======================
  const handleEditCar = useCallback((car) => {
    setSelectedCarForEdit(car);
    setIsEditCarOpen(true);
  }, []);

  // =======================
  // 📊 Derived state (orders)
  // =======================
  useEffect(() => {
    const { startEnd } = extractArraysOfStartEndConfPending(allOrders);
    setStartEndDates(startEnd);
  }, [allOrders]);

  // 🔧 PERF FIX: Memoize derived array to prevent recalculation on every render
  // Previously computed on every render, causing O(n) operations each time
  const filteredStartEndDates = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.map((order) => ({
      startStr: order.startDateISO || order.start,
      endStr: order.endDateISO || order.end,
      orderId: order._id,
    }));
  }, [allOrders]);
  const conflictMap = useMemo(
    () => buildConflictMap(sortedCars, allOrders),
    [sortedCars, allOrders]
  );

  // Calculate first column width based on longest vehicle name
  // Uses computed styles from actual DOM for accurate measurement
  const { width: firstColumnWidth, setMeasurementRef } = useFirstColumnWidth(
    cars,
    {
      minWidth: 140,
      maxWidth: 220,
      debounceMs: 150,
    }
  );

  const compactDensitySx = useMemo(() => getCompactDensityLayoutSx(), []);
  const densitySx = useMemo(() => getDensityLayoutSx(), []);

  const calendarMetricsSx = useMemo(() => {
    const dayCount = Math.max(days.length, 1);
    const widthFactor = Math.min(
      2,
      Math.max(0.55, MEAN_GREGORIAN_MONTH_DAYS / dayCount)
    );
    const rowPx = BASE_ROW_HEIGHT_PX;
    const dayWidth = isPortraitPhone
      ? "var(--calendar-row-height)"
      : `calc((100% - var(--resource-col-width, 160px)) / var(--calendar-day-count) * var(--calendar-day-width-factor, 1))`;

    return {
      "--calendar-day-count": String(dayCount),
      "--calendar-day-width-factor": String(widthFactor),
      "--calendar-day-width": dayWidth,
      "--calendar-row-height": `${rowPx}px`,
    };
  }, [days.length, isPortraitPhone]);

  const handleAddOrderClick = useCallback(
    (car, dateStr) => {
      // Если в режиме перемещения - не открываем AddOrderModal
      if (moveMode) return;

      setSelectedCarForAdd(car);
      setSelectedDateForAdd(dateStr);
      setIsAddOrderOpen(true);
    },
    [moveMode]
  );

  const hasBlockingModal = useMemo(
    () =>
      Boolean(
        open ||
          isAddOrderOpen ||
          isEditCarOpen ||
          unsavedEditDialogOpen ||
          headerOrdersModal?.open ||
          confirmModal?.open
      ),
    [
      open,
      isAddOrderOpen,
      isEditCarOpen,
      unsavedEditDialogOpen,
      headerOrdersModal?.open,
      confirmModal?.open,
    ]
  );

  const handleGlobalKeyDown = useCallback(
    (e) => {
      const target = e.target;
      const tag = String(target?.tagName || "").toLowerCase();
      const editable =
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";
      if (editable) return;

      const hasCars = sortedCars.length > 0;
      const hasDays = days.length > 0;
      if (!hasCars || !hasDays) return;

      const { carIndex, dayIndex } = activeCell;
      let nextCar = carIndex;
      let nextDay = dayIndex;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextDay = Math.min(dayIndex + 1, maxDayIndex);
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextDay = Math.max(dayIndex - 1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          nextCar = Math.min(carIndex + 1, maxCarIndex);
          break;
        case "ArrowUp":
          e.preventDefault();
          nextCar = Math.max(carIndex - 1, 0);
          break;
        case "Enter": {
          if (hasBlockingModal) return;
          e.preventDefault();
          const car = sortedCars[carIndex];
          const day = days[dayIndex];
          if (!car || !day) return;
          const dateStr = day.dayjs.format("YYYY-MM-DD");
          const ordersForCell = getOrdersForCell(car._id, dateStr);
          if (ordersForCell.length > 0) {
            setSelectedOrders(ordersForCell);
            setOpen(true);
          }
          return;
        }
        case "n":
        case "N": {
          if (hasBlockingModal) return;
          e.preventDefault();
          const car = sortedCars[carIndex];
          const day = days[dayIndex];
          if (!car || !day) return;
          handleAddOrderClick(car, day.dayjs.format("YYYY-MM-DD"));
          return;
        }
        case "Escape": {
          e.preventDefault();
          if (open) tryCloseEditModal();
          setHeaderOrdersModal((prev) => ({ ...prev, open: false }));
          setIsAddOrderOpen(false);
          setIsEditCarOpen(false);
          setUnsavedEditDialogOpen(false);
          setSelectedOrders([]);
          if (confirmModal?.open) handleCloseConfirmModal();
          else if (moveMode) exitMoveMode();
          return;
        }
        default:
          return;
      }

      setActiveCellClamped(nextCar, nextDay);
    },
    [
      sortedCars,
      days,
      activeCell,
      maxDayIndex,
      maxCarIndex,
      hasBlockingModal,
      getOrdersForCell,
      handleAddOrderClick,
      open,
      tryCloseEditModal,
      confirmModal?.open,
      handleCloseConfirmModal,
      moveMode,
      exitMoveMode,
      setActiveCellClamped,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // 🔧 PERF FIX: Memoize handler to prevent re-creating function on every render
  // Inline functions in props cause unnecessary re-renders of child components
  const handleDayClick = useCallback(
    (day) => {
      setHeaderOrdersModal({
        open: true,
        date: day.dayjs,
        orders: allOrders,
      });
    },
    [allOrders]
  );

  // 🔧 PERF FIX: Memoize selectedDate to prevent dayjs re-parsing every render
  const selectedDate = useMemo(() => {
    return headerOrdersModal.date
      ? dayjs(headerOrdersModal.date).format("YYYY-MM-DD")
      : null;
  }, [headerOrdersModal.date]);

  // 🔧 PERF FIX: Memoize filtered orders - previously running formatDate (dayjs)
  // on every order for every render, even when modal was closed
  const startedOrders = useMemo(() => {
    if (!selectedDate || !headerOrdersModal.orders) return [];
    return headerOrdersModal.orders.filter((order) => {
      // Используем бизнес-таймзону для корректного сравнения
      const start = formatDate(order.rentalStartDate, "YYYY-MM-DD");
      return start === selectedDate;
    });
  }, [headerOrdersModal.orders, selectedDate]);

  const endedOrders = useMemo(() => {
    if (!selectedDate || !headerOrdersModal.orders) return [];
    return headerOrdersModal.orders.filter((order) => {
      const end = formatDate(order.rentalEndDate, "YYYY-MM-DD");
      return end === selectedDate;
    });
  }, [headerOrdersModal.orders, selectedDate]);

  const getRegNumberByCarNumber = useCallback(
    (carNumber) => {
      const car = cars.find((c) => c.carNumber === carNumber);
      return car ? car.regNumber : carNumber;
    },
    [cars]
  );

  const updateOrder = useCallback(async (orderData) => {
    try {
      const result = await changeRentalDates(
        orderData._id,
        new Date(orderData.rentalStartDate),
        new Date(orderData.rentalEndDate),
        new Date(orderData.timeIn || orderData.rentalStartDate),
        new Date(orderData.timeOut || orderData.rentalEndDate),
        orderData.placeIn || "",
        orderData.placeOut || "",
        orderData.car,
        orderData.carNumber
      );

      if (result?.status === 201 || result?.status === 202) {
        console.log("✅ Заказ успешно обновлён:", result.updatedOrder);
      } else if (result?.status === 408) {
        console.warn("⚠️ Конфликт по времени:", result.conflicts);
        alert(
          "Конфликт по времени аренды:\n" +
            JSON.stringify(result.conflicts, null, 2)
        );
      } else {
        console.error("❌ Ошибка при обновлении заказа", result);
        alert("Не удалось обновить заказ");
      }
    } catch (error) {
      console.error("🔥 Ошибка в updateOrder:", error);
      alert("Произошла ошибка при обновлении заказа");
    }
  }, []);

  const borderStyle = useMemo(
    () => `1px solid ${calendarHeaderStyles.border}`,
    [calendarHeaderStyles.border]
  );
  const rootSx = useMemo(
    () => ({
      ...calendarMetricsSx,
      ...densitySx,
      ...compactDensitySx.root,
    }),
    [calendarMetricsSx, densitySx, compactDensitySx.root]
  );
  const tableContainerSx = useMemo(
    () => compactDensitySx.tableContainer,
    [compactDensitySx.tableContainer]
  );

  const headerData = useMemo(
    () => ({
      days,
      month,
      year,
      todayIndex,
      highlightToday,
      viewMode,
      rangeDirection,
      calendarDayRange: dayRange,
      monthNames,
      weekday2,
      currentLang,
      isPortraitPhone,
      headerStyles: calendarHeaderStyles,
      calendarRef,
    }),
    [
      days,
      month,
      year,
      todayIndex,
      highlightToday,
      viewMode,
      rangeDirection,
      dayRange,
      monthNames,
      weekday2,
      currentLang,
      isPortraitPhone,
      calendarHeaderStyles,
    ]
  );

  const headerActions = useMemo(
    () => ({
      onPrevMonth: handlePrevMonth,
      onNextMonth: handleNextMonth,
      onMonthChange: handleSelectMonth,
      onYearChange: handleSelectYear,
      onDayClick: handleDayClick,
    }),
    [
      handlePrevMonth,
      handleNextMonth,
      handleSelectMonth,
      handleSelectYear,
      handleDayClick,
    ]
  );

  const gridData = useMemo(
    () => ({
      headerData,
      sortedCars,
      setMeasurementRef,
      enableOrderDrag,
      isDraggingOrder,
      dragOverCarId,
      draggingOrderId,
      allOrders,
      ordersByCarId,
      todayIndex,
      filteredStartEndDates,
      conflictMap,
      activeCell,
      moveMode,
      orderToMove,
      selectedMoveOrder,
      selectedOrderDates,
      calendarRef,
    }),
    [
      headerData,
      sortedCars,
      setMeasurementRef,
      enableOrderDrag,
      isDraggingOrder,
      dragOverCarId,
      draggingOrderId,
      allOrders,
      ordersByCarId,
      todayIndex,
      filteredStartEndDates,
      conflictMap,
      activeCell,
      moveMode,
      orderToMove,
      selectedMoveOrder,
      selectedOrderDates,
    ]
  );

  const gridActions = useMemo(
    () => ({
      onPrevMonth: handlePrevMonth,
      onNextMonth: handleNextMonth,
      onMonthChange: handleSelectMonth,
      onYearChange: handleSelectYear,
      onDayClick: handleDayClick,
      handleEditCar,
      handleRowDragOver,
      handleRowDragLeave,
      handleRowDrop,
      isCarCompatibleForMove,
      ordersByCarIdWithAllorders,
      setSelectedOrders,
      setOpen,
      handleAddOrderClick,
      handleLongPress,
      handleCarSelectForMove,
      exitMoveMode,
      handleOrderDragStart,
      handleOrderDragEnd,
      onActiveCellChange: setActiveCellClamped,
    }),
    [
      handlePrevMonth,
      handleNextMonth,
      handleSelectMonth,
      handleSelectYear,
      handleDayClick,
      handleEditCar,
      handleRowDragOver,
      handleRowDragLeave,
      handleRowDrop,
      isCarCompatibleForMove,
      ordersByCarIdWithAllorders,
      handleAddOrderClick,
      handleLongPress,
      handleCarSelectForMove,
      exitMoveMode,
      handleOrderDragStart,
      handleOrderDragEnd,
      setActiveCellClamped,
    ]
  );

  const overlaysData = useMemo(
    () => ({
      open,
      selectedOrders,
      startEndDates,
      cars,
      unsavedEditDialogOpen,
      unsavedEditSaving,
      isAddOrderOpen,
      selectedCarForAdd,
      selectedDateForAdd,
      headerOrdersModal,
      startedOrders,
      endedOrders,
      confirmModal,
      isEditCarOpen,
      selectedCarForEdit,
      addOrderTimeoutRef,
      updateCarInContext,
      enqueueSnackbar,
    }),
    [
      open,
      selectedOrders,
      startEndDates,
      cars,
      unsavedEditDialogOpen,
      unsavedEditSaving,
      isAddOrderOpen,
      selectedCarForAdd,
      selectedDateForAdd,
      headerOrdersModal,
      startedOrders,
      endedOrders,
      confirmModal,
      isEditCarOpen,
      selectedCarForEdit,
      updateCarInContext,
      enqueueSnackbar,
    ]
  );

  const overlaysActions = useMemo(
    () => ({
      handleEditModalBackdropClose,
      tryCloseEditModal,
      performEditModalClose,
      registerEditOrderCloseGuard,
      handleSaveOrder,
      setIsConflictOrder,
      handleUnsavedEditCancel,
      handleUnsavedEditDiscard,
      handleUnsavedEditSave,
      setIsAddOrderOpen,
      fetchAndUpdateOrders,
      setForceUpdateKey,
      setHeaderOrdersModal,
      getRegNumberByCarNumber,
      handleCloseConfirmModal,
      handleConfirmMove,
      setIsEditCarOpen,
      setSelectedCarForEdit,
    }),
    [
      handleEditModalBackdropClose,
      tryCloseEditModal,
      performEditModalClose,
      registerEditOrderCloseGuard,
      handleSaveOrder,
      handleUnsavedEditCancel,
      handleUnsavedEditDiscard,
      handleUnsavedEditSave,
      fetchAndUpdateOrders,
      getRegNumberByCarNumber,
      handleCloseConfirmModal,
      handleConfirmMove,
    ]
  );

  return (
    <>
      <BigCalendarLayout
        showLegend={showInlineLegend}
        showBufferInLegend={showBufferInLegend}
        showDeliveryInLegend={showDeliveryInLegend}
        showConflictBadges={showConflictBadges}
        borderStyle={borderStyle}
        calendarRef={calendarRef}
        containerRef={containerRef}
        firstColumnWidth={firstColumnWidth}
        extraRootSx={rootSx}
        extraTableContainerSx={tableContainerSx}
      >
        <CalendarGrid data={gridData} actions={gridActions} />
      </BigCalendarLayout>

      <CalendarOverlays data={overlaysData} actions={overlaysActions} />
    </>
  );
}
