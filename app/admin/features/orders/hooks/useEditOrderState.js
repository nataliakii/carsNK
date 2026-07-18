/**
 * useEditOrderState
 * 
 * 🎯 STATE & DATA ORCHESTRATION LAYER — The brain
 * 
 * This layer is the ONLY OWNER OF STATE:
 * - editedOrder
 * - startTime / endTime (Athens timezone)
 * - isManualTotalPrice
 * - isFirstOpen
 * - daysAndPriceState
 * - loading / updating flags
 * 
 * 🔥 SINGLE SOURCE OF TRUTH FOR PRICE 🔥
 * - totalPrice and numberOfDays live ONLY here
 * - UI never recalculates price
 * - UI never mutates numberOfDays directly
 * 
 * Price calculation rules:
 * - Server (`/calcTotalPrice`) is the ONLY calculator
 * - Manual price override sets `isManualTotalPrice = true`
 * - Any change in: car, rentalStartDate, rentalEndDate, insurance, childSeats, secondDriver
 * 
 *   resets `isManualTotalPrice = false`
 * 
 * Race-condition protection:
 * - Use requestId / abort logic so outdated calc responses are ignored
 * 
 * 🕐 ATHENS TIMEZONE CONTRACT 🕐
 * - editedOrder.rentalStartDate / rentalEndDate: dayjs in Athens (date-only, startOf("day"))
 * - startTime / endTime: dayjs in Athens (datetime)
 * - All time operations use athensTime.js utilities
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
  fromServerUTC,
  createAthensDateTime,
  toServerUTC,
  formatTimeHHMM,
  formatDateYYYYMMDD,
  reinterpretAsAthens,
  athensStartOfDay,
  athensNow,
} from "@/domain/time/athensTime";
import { updateOrder, calculateTotalPrice, deleteOrder } from "@utils/action";
import { canUpdateStartDate } from "./startDateAccess";
import i18n from "@locales/i18n";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import { isThessalonikiCityBookingLocation } from "@/domain/orders/halkidikiBookingLocations";
import { normalizeDeliveryPricingLocation } from "@/domain/orders/bookingPricingOptions";
import {
  sumRentalSubtotalFromPriceBreakdown,
  grandTotalFromPriceBreakdown,
} from "@/domain/orders/orderPriceHelpers";
import { buildBookingPriceSummary } from "@/domain/orders/bookingPriceSummary";
import {
  resolveOrderSnapshotForSave,
  prepareApplyQuotedDeliveryGrandSave,
} from "@/domain/orders/applyQuotedDeliveryGrandSave";

export function isExplicitTotalPriceSource(source) {
  return (
    source === "manual" ||
    source === "confirmed_recalculation" ||
    source === "admin_recalculate_confirmed"
  );
}

export function getOriginalTotalPrice(storedBreakdown, editedOrder) {
  return Number(storedBreakdown?.totalPrice ?? editedOrder?.totalPrice ?? 0);
}

export function buildTotalPricePayload({
  orderSnapshot,
  storedBreakdown,
  priceBreakdown,
  priceRecalculated,
}) {
  if (
    orderSnapshot?.OverridePrice !== null &&
    orderSnapshot?.OverridePrice !== undefined
  ) {
    return {
      totalPrice: Number(orderSnapshot.OverridePrice),
      isOverridePrice: true,
    };
  }

  if (priceRecalculated) {
    const recalculatedGrand = grandTotalFromPriceBreakdown(priceBreakdown);
    return {
      totalPrice:
        recalculatedGrand != null && !Number.isNaN(recalculatedGrand)
          ? Number(recalculatedGrand)
          : Number(orderSnapshot?.totalPrice) || 0,
      isOverridePrice: false,
    };
  }

  return {
    totalPrice: getOriginalTotalPrice(storedBreakdown, orderSnapshot),
    isOverridePrice: false,
  };
}

export function buildReactivePriceSyncResult({
  editedOrder,
  currentBookingPriceSummary,
  currentRatesData,
}) {
  if (!editedOrder || !currentBookingPriceSummary || !currentRatesData) {
    return null;
  }

  return {
    orderSnapshot: {
      ...editedOrder,
      totalPrice: Number(currentBookingPriceSummary.totalPrice ?? 0),
      numberOfDays: currentRatesData.days ?? editedOrder.numberOfDays,
    },
    priceBreakdown: currentRatesData.breakdown ?? null,
  };
}

export function hasRentalRateChanged({
  currentRatesData,
  storedBreakdown,
  storedBreakdownLoaded,
}) {
  if (!currentRatesData || !storedBreakdownLoaded || !storedBreakdown) {
    return false;
  }
  const currentRental = Number(currentRatesData.totalPrice) || 0;
  const savedRental = sumRentalSubtotalFromPriceBreakdown(storedBreakdown);
  return Math.abs(currentRental - savedRental) > 0.01;
}

/**
 * Hook for managing order edit state and price calculation
 * 
 * @param {Object} order - Original order object from props
 * @param {Array} cars - List of cars
 * @param {Object} company - Company data (for bufferTime)
 * @param {Object} permissions - Permission flags from useEditOrderPermissions
 * @param {Function} onSave - Callback when order is saved
 * @param {Function} onClose - Callback when modal closes
 * @param {Function} fetchAndUpdateOrders - Function to refetch orders
 * @param {Function} setCarOrders - Optional function to update car orders
 * @returns {Object} State and handlers
 */
export function useEditOrderState({
  order,
  cars,
  company,
  permissions,
  onSave,
  onClose,
  fetchAndUpdateOrders,
  setCarOrders,
}) {
  // ============================================================
  // STATE
  // ============================================================

  // Main edited order state
  const [editedOrder, setEditedOrder] = useState(null);
  
  // Time picker state (Athens timezone)
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  
  // Price calculation state
  const [isManualTotalPrice, setIsManualTotalPrice] = useState(false);
  const isFirstOpen = useRef(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [storedBreakdown, setStoredBreakdown] = useState(null);
  const [storedBreakdownLoaded, setStoredBreakdownLoaded] = useState(false);
  const [currentRatesData, setCurrentRatesData] = useState(null);
  const [priceRecalculated, setPriceRecalculated] = useState(false);
  /** Empty string = авто по зонам; иначе ручные € за туда / обратно */
  const [manualDeliveryIn, setManualDeliveryIn] = useState("");
  const [manualDeliveryOut, setManualDeliveryOut] = useState("");
  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState(null);
  const [attemptedSave, setAttemptedSave] = useState(false);
  
  // Race condition protection
  const priceCalcRequestId = useRef(0);
  const priceCalcAbortController = useRef(null);
  const pendingReactivePriceSyncRef = useRef(null);

  // ============================================================
  // INITIALIZATION (Fix: Athens timezone for dates)
  // ============================================================

  useEffect(() => {
    if (!order) {
      setEditedOrder(null);
      setStartTime(null);
      setEndTime(null);
      setPriceBreakdown(null);
      setStoredBreakdown(null);
      setStoredBreakdownLoaded(true);
      setCurrentRatesData(null);
      setPriceRecalculated(false);
      pendingReactivePriceSyncRef.current = null;
      setManualDeliveryIn("");
      setManualDeliveryOut("");
      setLoading(false);
      return;
    }

    // 🔧 FIX ДЫРКА A: rentalStartDate/rentalEndDate инициализируются в Athens
    // Используем fromServerUTC для правильной конвертации UTC → Athens
    const rentalStartDateAthens = fromServerUTC(order.rentalStartDate);
    const rentalEndDateAthens = fromServerUTC(order.rentalEndDate);
    
    // Создаём date-only в Athens (startOf("day"))
    const startDateAthens = athensStartOfDay(formatDateYYYYMMDD(rentalStartDateAthens));
    const endDateAthens = athensStartOfDay(formatDateYYYYMMDD(rentalEndDateAthens));

    const adjustedOrder = {
      ...order,
      secondDriver: Boolean(order.secondDriver),
      // ✅ Dates are now Athens dayjs objects (date-only)
      rentalStartDate: startDateAthens,
      rentalEndDate: endDateAthens,
      // Time fields are kept as-is (will be used for display)
      timeIn: fromServerUTC(order.timeIn),
      timeOut: fromServerUTC(order.timeOut),
      // 🔧 PRICE ARCHITECTURE: Preserve OverridePrice if it exists
      // OverridePrice is copied from order via spread operator above
      // Explicitly ensure it's preserved (null or number)
      OverridePrice: order.OverridePrice !== undefined ? order.OverridePrice : null,
      deliveryInOverride:
        order.deliveryInOverride !== undefined ? order.deliveryInOverride : null,
      deliveryOutOverride:
        order.deliveryOutOverride !== undefined ? order.deliveryOutOverride : null,
    };

    setEditedOrder(adjustedOrder);
    setIsManualTotalPrice(false);
    const di = order.deliveryInOverride;
    const dout = order.deliveryOutOverride;
    setManualDeliveryIn(di != null && di !== undefined ? String(di) : "");
    setManualDeliveryOut(dout != null && dout !== undefined ? String(dout) : "");
    
    // ✅ Times are Athens dayjs objects
    setStartTime(fromServerUTC(order.timeIn));
    setEndTime(fromServerUTC(order.timeOut));
    setPriceBreakdown(null);
    setStoredBreakdownLoaded(false);
    setCurrentRatesData(null);
    setPriceRecalculated(false);
    pendingReactivePriceSyncRef.current = null;
    
    isFirstOpen.current = true;
    setLoading(false);
  }, [order]);

  useEffect(() => {
    if (!editedOrder) return;
    setEditedOrder((prev) => {
      if (!prev) return prev;
      const clearIn =
        !isThessalonikiCityBookingLocation(prev.placeIn) &&
        String(prev.placeInDetail || "").trim();
      const clearOut =
        !isThessalonikiCityBookingLocation(prev.placeOut) &&
        String(prev.placeOutDetail || "").trim();
      if (!clearIn && !clearOut) return prev;
      return {
        ...prev,
        ...(clearIn ? { placeInDetail: "" } : {}),
        ...(clearOut ? { placeOutDetail: "" } : {}),
      };
    });
    // Intentionally only placeIn/placeOut — avoids loops; clears detail when label changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are placeIn/placeOut only
  }, [editedOrder?.placeIn, editedOrder?.placeOut]);

  // ============================================================
  // STORED PRICE BREAKDOWN (with history)
  // ============================================================

  useEffect(() => {
    if (!order?._id) {
      setStoredBreakdown(null);
      setStoredBreakdownLoaded(true);
      return;
    }

    let cancelled = false;
    const fetchBreakdown = async () => {
      try {
        const res = await fetch(`/api/admin/orders/${order._id}/price-breakdown`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.success && data.data) {
            // Stored breakdown is immutable snapshot of saved booking price.
            // Do not mirror it into mutable editedOrder.totalPrice automatically.
            setStoredBreakdown(data.data);
          } else {
            setStoredBreakdown(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useEditOrderState] Error fetching stored breakdown:", err);
        }
      } finally {
        if (!cancelled) setStoredBreakdownLoaded(true);
      }
    };

    fetchBreakdown();
    return () => { cancelled = true; };
  }, [order]);

  // ============================================================
  // SELECTED CAR
  // ============================================================

  const selectedCar = useMemo(() => {
    if (!editedOrder?.car || !cars) return null;
    // Normalize car ID: handle both object and string formats
    const carId = editedOrder.car?._id ?? editedOrder.car;
    if (!carId) return null;
    return cars.find((c) => {
      const cId = c._id?._id ?? c._id;
      return cId?.toString() === carId.toString();
    }) || null;
  }, [cars, editedOrder?.car]);

  // ============================================================
  // PRICE CALCULATION (with race condition protection)
  // ============================================================

  // 🔧 FIX: Normalize pricing inputs (memoized for dependency tracking)
  const normalizedInsurance = useMemo(() => {
    return editedOrder?.insurance || "TPL";
  }, [editedOrder?.insurance]);

  const normalizedChildSeats = useMemo(() => {
    return Number(editedOrder?.ChildSeats ?? 0);
  }, [editedOrder?.ChildSeats]);

  const normalizedSecondDriver = useMemo(() => {
    return Boolean(editedOrder?.secondDriver);
  }, [editedOrder?.secondDriver]);

  useEffect(() => {
    // Wait for stored breakdown to be fetched before deciding
    if (!storedBreakdownLoaded) return;

    const hasStoredBreakdown = !!storedBreakdown;

    const shouldCalculateOnFirstOpen = isFirstOpen.current && (
      !editedOrder?.totalPrice || 
      editedOrder.totalPrice === 0 || 
      editedOrder.totalPrice === null ||
      (!priceBreakdown && !hasStoredBreakdown)
    );

    // 🔥 ALWAYS allow background recalculation
    const skipInitialApply =
      isFirstOpen.current &&
      !shouldCalculateOnFirstOpen &&
      storedBreakdownLoaded;

    const isBackgroundOnly =
      skipInitialApply &&
      Boolean(editedOrder?.totalPrice);
    
    // Skip if viewOnly mode
    if (permissions.viewOnly) return;
    
    // Skip if required fields are missing
    if (!selectedCar?.carNumber || !editedOrder?.rentalStartDate || !editedOrder?.rentalEndDate) {
      return;
    }
    
    // 🔧 FIX: Ensure we have valid insurance and ChildSeats values
    if (!normalizedInsurance || normalizedChildSeats === undefined) {
      return;
    }

    // Abort previous request
    if (priceCalcAbortController.current) {
      priceCalcAbortController.current.abort();
    }

    // Create new request
    const requestId = ++priceCalcRequestId.current;
    const abortController = new AbortController();
    priceCalcAbortController.current = abortController;

    if (!isBackgroundOnly) {
      setCalcLoading(true);
    }

    const fetchTotalPrice = async () => {
      try {
        // Format dates as YYYY-MM-DD strings (Athens dates)
        const startDateStr = formatDateYYYYMMDD(editedOrder.rentalStartDate);
        const endDateStr = formatDateYYYYMMDD(editedOrder.rentalEndDate);
        const timeInAthens = startTime
          ? createAthensDateTime(startDateStr, formatTimeHHMM(startTime))
          : null;
        const timeOutAthens = endTime
          ? createAthensDateTime(endDateStr, formatTimeHHMM(endTime))
          : null;
        const timeInServer = timeInAthens ? toServerUTC(timeInAthens) : undefined;
        const timeOutServer = timeOutAthens ? toServerUTC(timeOutAthens) : undefined;

        // DEV log request
        if (process.env.NODE_ENV === "development") {
          console.log(`[useEditOrderState] Price calc request (requestId: ${requestId}):`, {
            carNumber: selectedCar.carNumber,
            rentalStartDate: startDateStr,
            rentalEndDate: endDateStr,
            timeIn: timeInServer,
            timeOut: timeOutServer,
            insurance: normalizedInsurance,
            childSeats: normalizedChildSeats,
            secondDriver: normalizedSecondDriver,
          });
        }

        const data = await calculateTotalPrice(
          selectedCar.carNumber,
          startDateStr,
          endDateStr,
          normalizedInsurance,
          normalizedChildSeats,
          {
            signal: abortController.signal,
            secondDriver: normalizedSecondDriver,
            timeIn: timeInServer,
            timeOut: timeOutServer,
            placeIn: normalizeDeliveryPricingLocation(editedOrder?.placeIn),
            placeOut: normalizeDeliveryPricingLocation(editedOrder?.placeOut),
          }
        );

        if (data.ok) {
          if (requestId === priceCalcRequestId.current && !abortController.signal.aborted) {
            const safeTotalPrice = typeof data.totalPrice === "number" ? data.totalPrice : 0;
            const safeDays = typeof data.days === "number" ? data.days : 0;

            setCurrentRatesData({
              totalPrice: safeTotalPrice,
              days: safeDays,
              breakdown: data.breakdown,
              requestId,
            });

            // Keep live rates fresh and auto-sync them only after an explicit user edit.
            // Initial modal open must not overwrite the stored booking price.
            if (!isBackgroundOnly && isFirstOpen.current) {
              isFirstOpen.current = false;
            }

            if (process.env.NODE_ENV === "development") {
              console.log(`[useEditOrderState] Price calc response (requestId: ${requestId}):`, {
                days: safeDays,
                totalPrice: safeTotalPrice,
                isBackgroundOnly,
              });
            }
          }
        }
      } catch (error) {
        if (error.name !== "AbortError" && requestId === priceCalcRequestId.current) {
          console.error("Error calculating price:", error);
        }
      } finally {
        if (requestId === priceCalcRequestId.current) {
          setCalcLoading(false);
        }
      }
    };

    fetchTotalPrice();

    return () => {
      abortController.abort();
    };
    // Dependencies: pricing inputs + storedBreakdownLoaded gate.
    // priceBreakdown is NOT a dependency — we use storedBreakdownLoaded to trigger the initial check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    storedBreakdownLoaded,
    selectedCar?.carNumber,
    editedOrder?.rentalStartDate,
    editedOrder?.rentalEndDate,
    startTime,
    endTime,
    normalizedInsurance,
    normalizedChildSeats,
    normalizedSecondDriver,
    editedOrder?.placeIn,
    editedOrder?.placeOut,
    permissions.viewOnly,
  ]);

  // ============================================================
  // RESET MANUAL MODE ON KEY FIELD CHANGES
  // ============================================================

  useEffect(() => {
    if (!order || !editedOrder) return;

    // Check if key fields changed compared to original order
    const isCarChanged = editedOrder.car !== order.car;
    const isStartChanged =
      formatDateYYYYMMDD(editedOrder.rentalStartDate) !==
      formatDateYYYYMMDD(fromServerUTC(order.rentalStartDate));
    const isEndChanged =
      formatDateYYYYMMDD(editedOrder.rentalEndDate) !==
      formatDateYYYYMMDD(fromServerUTC(order.rentalEndDate));
    const isInsuranceChanged = editedOrder.insurance !== order.insurance;
    const isChildSeatsChanged = editedOrder.ChildSeats !== order.ChildSeats;
    const isSecondDriverChanged =
      Boolean(editedOrder.secondDriver) !== Boolean(order.secondDriver);

    if (
      isCarChanged ||
      isStartChanged ||
      isEndChanged ||
      isInsuranceChanged ||
      isChildSeatsChanged ||
      isSecondDriverChanged
    ) {
      setIsManualTotalPrice(false);
      isFirstOpen.current = false;
    }
    // Note: We only need specific fields from editedOrder, not the whole object
    // order is used for comparison, not as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editedOrder?.car,
    editedOrder?.rentalStartDate,
    editedOrder?.rentalEndDate,
    editedOrder?.insurance,
    editedOrder?.ChildSeats,
    editedOrder?.secondDriver,
    order,
  ]);

  // ============================================================
  // FIELD UPDATERS
  // ============================================================

  /**
   * Update a field in editedOrder
   */
  /**
   * Update a field in editedOrder
   * 
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {Object} options - Options object
   * @param {string} options.source - Source of update: "manual" | "confirmed_recalculation"
   */
  const updateField = useCallback((field, value, options = {}) => {
    if (permissions.viewOnly) return;

    const shouldUpdateTotalPrice = isExplicitTotalPriceSource(options?.source);
    const isAllowedAutoPriceReset =
      field === "totalPrice" &&
      shouldUpdateTotalPrice &&
      options?.source !== "manual" &&
      permissions.canResetToAutoPrice === true;

    // ⛔ HARD PERMISSION GUARD: state layer must reject forbidden fields even if UI fires (e.g. MUI Autocomplete onInputChange when disabled)
    if (
      permissions.fieldPermissions &&
      permissions.fieldPermissions[field] === false &&
      !isAllowedAutoPriceReset
    ) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[PERMISSION BLOCKED] Attempt to edit forbidden field "${field}"`,
          { value }
        );
      }
      return;
    }

    // Price writes are allowed only for explicit sources.
    if (field === "totalPrice") {
      if (!shouldUpdateTotalPrice) {
        return;
      }
      if (options.source === "manual") {
        setEditedOrder((prev) => {
          if (!prev) return prev;
          return { ...prev, OverridePrice: value };
        });
        setIsManualTotalPrice(true);
        return;
      }
      if (
        options.source === "confirmed_recalculation" ||
        options.source === "admin_recalculate_confirmed"
      ) {
        setEditedOrder((prev) => {
          if (!prev) return prev;
          return { ...prev, totalPrice: value, OverridePrice: null };
        });
        setIsManualTotalPrice(false);
        return;
      }
      return;
    }

    // For all other fields, update normally
    setEditedOrder((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
    
    // 🔧 PRICE ARCHITECTURE: Handle price-affecting fields
      // - In AUTO mode: trigger recalculation by resetting isFirstOpen
      // - In MANUAL mode: preserve OverridePrice, but still allow background recalculation
    if (
      field === "insurance" ||
      field === "ChildSeats" ||
      field === "car" ||
      field === "secondDriver" ||
      field === "placeIn" ||
      field === "placeOut"
    ) {
        // Always reset isFirstOpen to allow recalculation
        // The effect will check priceMode and decide whether to recalculate
        isFirstOpen.current = false;
        pendingReactivePriceSyncRef.current = priceCalcRequestId.current + 1;
        setIsManualTotalPrice(false);
        setPriceRecalculated(false);
        
        // DEV log
        if (process.env.NODE_ENV === "development") {
          const priceMode = prev?.OverridePrice !== null && prev?.OverridePrice !== undefined ? "MANUAL" : "AUTO";
          console.log(`[useEditOrderState] updateField(${field}): ${priceMode} mode - reset isFirstOpen, will recalculate if AUTO`);
        }
      }
      
      return updated;
    });
  }, [
    permissions.viewOnly,
    permissions.fieldPermissions,
    permissions.canResetToAutoPrice,
  ]);

  /**
   * Update start date (Athens timezone)
   * 🔧 FIX ДЫРКА B: DatePicker парсит как Athens дату
   * Access is enforced by fieldPermissions.rentalStartDate (SSOT from orderAccessPolicy)
   */
  const updateStartDate = useCallback((dateStr) => {
    if (!canUpdateStartDate(permissions)) return;
    
    // Create Athens date from YYYY-MM-DD string
    const newStartDate = athensStartOfDay(dateStr);
    
    // Validate: cannot set past date
    const todayAthens = athensStartOfDay(formatDateYYYYMMDD(athensNow()));
    if (newStartDate.isBefore(todayAthens, "day")) {
      return; // Ignore invalid selection
    }

    setEditedOrder((prev) => {
      if (!prev) return prev;
      const currentEnd = prev.rentalEndDate;
      
      // Validate: end date must be after start date
      if (currentEnd && !currentEnd.isAfter(newStartDate, "day")) {
        return prev; // Keep previous value
      }
      
      return { ...prev, rentalStartDate: newStartDate };
    });
    
    setIsManualTotalPrice(false);
    setPriceRecalculated(false);
    pendingReactivePriceSyncRef.current = priceCalcRequestId.current + 1;
    isFirstOpen.current = false;
  }, [permissions]);

  /**
   * Update end date (Athens timezone)
   */
  const updateEndDate = useCallback((dateStr) => {
    if (permissions.viewOnly) return;
    
    // Create Athens date from YYYY-MM-DD string
    const newEndDate = athensStartOfDay(dateStr);
    
    // Validate: for current order, cannot set past date
    if (permissions.isCurrentOrder) {
      const todayAthens = athensStartOfDay(formatDateYYYYMMDD(athensNow()));
      if (newEndDate.isBefore(todayAthens, "day")) {
        return; // Ignore invalid selection
      }
    }

    setEditedOrder((prev) => {
      if (!prev) return prev;
      const currentStart = prev.rentalStartDate;
      
      // Validate: end date must be after start date
      if (currentStart && !newEndDate.isAfter(currentStart, "day")) {
        return prev; // Keep previous value
      }
      
      return { ...prev, rentalEndDate: newEndDate };
    });
    
    setIsManualTotalPrice(false);
    setPriceRecalculated(false);
    pendingReactivePriceSyncRef.current = priceCalcRequestId.current + 1;
    isFirstOpen.current = false;
  }, [permissions.viewOnly, permissions.isCurrentOrder]);

  /**
   * Update start time (Athens timezone)
   * 🔧 FIX ДЫРКА C: TimePicker даёт dayjs в локальной TZ, переинтерпретируем как Athens
   */
  const updateStartTime = useCallback((localDayjs) => {
    if (permissions.viewOnly) return;
    
    if (!localDayjs || !dayjs.isDayjs(localDayjs)) return;
    
    // Get date string from editedOrder
    const dateStr = formatDateYYYYMMDD(editedOrder?.rentalStartDate);
    if (!dateStr) return;
    
    // Reinterpret as Athens (extract HH:mm, create new Athens datetime)
    const athensTime = reinterpretAsAthens(localDayjs, dateStr);
    if (athensTime) {
      setStartTime(athensTime);
      setIsManualTotalPrice(false);
      setPriceRecalculated(false);
      pendingReactivePriceSyncRef.current = priceCalcRequestId.current + 1;
      isFirstOpen.current = false;
    }
  }, [permissions.viewOnly, editedOrder?.rentalStartDate]);

  /**
   * Update end time (Athens timezone)
   */
  const updateEndTime = useCallback((localDayjs) => {
    if (permissions.viewOnly) return;
    
    if (!localDayjs || !dayjs.isDayjs(localDayjs)) return;
    
    // Get date string from editedOrder
    const dateStr = formatDateYYYYMMDD(editedOrder?.rentalEndDate);
    if (!dateStr) return;
    
    // Reinterpret as Athens (extract HH:mm, create new Athens datetime)
    const athensTime = reinterpretAsAthens(localDayjs, dateStr);
    if (athensTime) {
      setEndTime(athensTime);
      setIsManualTotalPrice(false);
      setPriceRecalculated(false);
      pendingReactivePriceSyncRef.current = priceCalcRequestId.current + 1;
      isFirstOpen.current = false;
    }
  }, [permissions.viewOnly, editedOrder?.rentalEndDate]);

  const refetchPriceBreakdown = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/price-breakdown`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        setStoredBreakdown(data.data);
        setPriceBreakdown(null);
        setPriceRecalculated(false);
      }
    } catch (e) {
      console.error("[useEditOrderState] refetchPriceBreakdown", e);
    }
  }, []);

  const handleQuoteDelivery = useCallback(async () => {
    if (!editedOrder || permissions.viewOnly) return;
    setDeliveryQuoteLoading(true);
    setUpdateMessage(null);
    try {
      const res = await fetch("/api/admin/delivery-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          placeIn: editedOrder.placeIn || "",
          placeOut: editedOrder.placeOut || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        setUpdateMessage(json.message || "Не удалось рассчитать доставку");
        return;
      }
      const { deliveryIn, deliveryOut, deliveryTotal } = json.data;
      setManualDeliveryIn(String(deliveryIn ?? 0));
      setManualDeliveryOut(String(deliveryOut ?? 0));
      setEditedOrder((prev) =>
        prev
          ? {
              ...prev,
              deliveryInOverride: Number(deliveryIn ?? 0),
              deliveryOutOverride: Number(deliveryOut ?? 0),
            }
          : prev
      );
      setPriceBreakdown((prev) =>
        prev
          ? {
              ...prev,
              deliveryIn: deliveryIn ?? 0,
              deliveryOut: deliveryOut ?? 0,
              deliveryTotal: deliveryTotal ?? 0,
            }
          : {
              dailyRates: [],
              baseRentalTotal: 0,
              kaskoTotal: 0,
              childSeatsTotal: 0,
              secondDriverTotal: 0,
              deliveryIn: deliveryIn ?? 0,
              deliveryOut: deliveryOut ?? 0,
              deliveryTotal: deliveryTotal ?? 0,
            }
      );
    } finally {
      setDeliveryQuoteLoading(false);
    }
  }, [editedOrder, permissions.viewOnly]);

  const handleClearDeliveryManual = useCallback(() => {
    if (permissions.viewOnly) return;
    setManualDeliveryIn("");
    setManualDeliveryOut("");
    setEditedOrder((prev) =>
      prev
        ? {
            ...prev,
            deliveryInOverride: null,
            deliveryOutOverride: null,
          }
        : prev
    );
  }, [permissions.viewOnly]);

  // ============================================================
  // HANDLERS
  // ============================================================

  /**
   * Handle save (unified update)
   */
  const handleSave = useCallback(async (saveOptions = {}) => {
    if (permissions.viewOnly) return false;

    const o = resolveOrderSnapshotForSave(editedOrder, saveOptions);

    setAttemptedSave(true);
    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      if (!o) {
        throw new Error("No order to save");
      }

      // Use memoized selectedCar from hook (already normalized)
      if (!selectedCar) {
        throw new Error("Car not found");
      }

      // Build payload with only allowed fields
      const payload = {};
      const { fieldPermissions } = permissions;

      // Date/time fields
      if (fieldPermissions.rentalStartDate) {
        // Convert Athens date to Date (for server)
        payload.rentalStartDate = o.rentalStartDate.toDate();
      }
      if (fieldPermissions.rentalEndDate) {
        payload.rentalEndDate = o.rentalEndDate.toDate();
      }
      if (fieldPermissions.timeIn && startTime) {
        const startDateStr = formatDateYYYYMMDD(o.rentalStartDate);
        const timeInAthens = createAthensDateTime(
          startDateStr,
          formatTimeHHMM(startTime)
        );
        payload.timeIn = toServerUTC(timeInAthens);
      }
      if (fieldPermissions.timeOut && endTime) {
        const endDateStr = formatDateYYYYMMDD(o.rentalEndDate);
        const timeOutAthens = createAthensDateTime(
          endDateStr,
          formatTimeHHMM(endTime)
        );
        payload.timeOut = toServerUTC(timeOutAthens);
      }

      // Other fields
      if (fieldPermissions.car) payload.car = o.car;
      if (fieldPermissions.placeIn) {
        payload.placeIn = o.placeIn;
        payload.placeInDetail = String(o.placeInDetail ?? "").trim();
      }
      if (fieldPermissions.placeOut) {
        payload.placeOut = o.placeOut;
        payload.placeOutDetail = String(o.placeOutDetail ?? "").trim();
      }
      // 🔧 FIX: Check for true (allowed) instead of !== undefined
      // fieldPermissions returns boolean (true/false), not undefined
      if (fieldPermissions.ChildSeats === true) {
        payload.ChildSeats = o.ChildSeats;
      }
      if (fieldPermissions.insurance === true) {
        payload.insurance = o.insurance;
      }
      if (fieldPermissions.franchiseOrder === true) {
        payload.franchiseOrder = o.franchiseOrder;
      }
      // Price payload: immutable original snapshot unless admin explicitly confirmed recalculation.
      if (fieldPermissions.totalPrice === true) {
        const totalPricePayload = buildTotalPricePayload({
          orderSnapshot: o,
          storedBreakdown,
          priceBreakdown,
          priceRecalculated,
        });
        payload.totalPrice = totalPricePayload.totalPrice;
        payload.isOverridePrice = totalPricePayload.isOverridePrice;
      }
      if (fieldPermissions.deliveryInOverride === true) {
        const tIn = manualDeliveryIn.trim();
        const tOut = manualDeliveryOut.trim();
        if (tIn === "" && tOut === "") {
          payload.deliveryInOverride = null;
          payload.deliveryOutOverride = null;
        } else if (tIn !== "" && tOut !== "") {
          const nIn = Number(tIn);
          const nOut = Number(tOut);
          if (
            Number.isNaN(nIn) ||
            Number.isNaN(nOut) ||
            nIn < 0 ||
            nOut < 0
          ) {
            setUpdateMessage(
              "Некорректные суммы доставки (нужны неотрицательные числа)"
            );
            setIsUpdating(false);
            return false;
          }
          payload.deliveryInOverride = nIn;
          payload.deliveryOutOverride = nOut;
        } else {
          setUpdateMessage(
            "Доставка: заполните оба поля (туда и обратно) или очистите оба для расчёта по зонам"
          );
          setIsUpdating(false);
          return false;
        }
      }
      if (
        priceRecalculated &&
        Number.isFinite(Number(currentRatesData?.days))
      ) {
        payload.numberOfDays = Number(currentRatesData.days);
      } else if (o.numberOfDays !== undefined) {
        payload.numberOfDays = Number(o.numberOfDays);
      }

      // 🔧 FIX: Customer fields - always include if permission allows AND field exists in editedOrder
      // Include even if empty string (for email) or if value changed
      if (fieldPermissions.customerName !== false) {
        // Always include customerName if permission allows (required field)
        if (o.customerName !== undefined) {
          payload.customerName = o.customerName || "";
        }
      }
      if (fieldPermissions.phone !== false) {
        // Always include phone if permission allows (required field)
        if (o.phone !== undefined) {
          payload.phone = o.phone || "";
        }
      }
      if (fieldPermissions.email !== false) {
        // Always include email if permission allows (optional field, can be empty)
        // Use ?? to handle null/undefined as empty string
        payload.email = o.email ?? "";
      }
      if (fieldPermissions.secondDriver !== false) {
        payload.secondDriver = Boolean(o.secondDriver);
      }
      if (fieldPermissions.Viber !== false) {
        payload.Viber = Boolean(o.Viber);
      }
      if (fieldPermissions.Whatsapp !== false) {
        payload.Whatsapp = Boolean(o.Whatsapp);
      }
      if (fieldPermissions.Telegram !== false) {
        payload.Telegram = Boolean(o.Telegram);
      }
      if (fieldPermissions.flightNumber !== false) {
        // Always include flightNumber if permission allows (optional field)
        payload.flightNumber = o.flightNumber ?? "";
      }
      if (fieldPermissions.drivingLicenceUrls !== false) {
        payload.drivingLicenceUrls = Array.isArray(o.drivingLicenceUrls)
          ? o.drivingLicenceUrls
          : [];
      }

      // Offline (off-site) flag — always send current value for admin edits
      payload.offline = Boolean(o.offline);
      if (payload.offline) {
        payload.confirmed = true;
        payload.my_order = false;
      }

      if (payload.phone !== undefined) {
        const p = String(payload.phone ?? "").trim();
        if (p && !isValidInternationalPhone(p)) {
          setUpdateMessage(i18n.t("order.phoneInvalid"));
          setIsUpdating(false);
          return false;
        }
      }

      // Check if we have any changes
      if (Object.keys(payload).length === 0) {
        setUpdateMessage("⛔ Нет прав на изменение полей этого заказа");
        return false;
      }

      // Validation
      if (fieldPermissions.rentalStartDate) {
        const originalStart = fromServerUTC(order.rentalStartDate);
        const todayAthens = athensNow();
        if (
          o.rentalStartDate.isBefore(todayAthens, "day") &&
          !originalStart.isSame(o.rentalStartDate, "day")
        ) {
          setUpdateMessage(
            "Нельзя устанавливать новую дату начала раньше сегодняшнего дня"
          );
          return false;
        }
      }

      if (fieldPermissions.rentalEndDate && permissions.isCurrentOrder) {
        const todayAthens = athensNow();
        if (o.rentalEndDate.isBefore(todayAthens, "day")) {
          setUpdateMessage(
            "Для текущего заказа дата окончания не может быть раньше сегодняшнего дня"
          );
          return false;
        }
      }

      if (
        fieldPermissions.timeOut &&
        permissions.isCurrentOrder &&
        o.rentalEndDate.isSame(athensNow(), "day")
      ) {
        const endDateStr = formatDateYYYYMMDD(o.rentalEndDate);
        const attemptedEndTime = createAthensDateTime(
          endDateStr,
          formatTimeHHMM(endTime)
        );
        const nowAthens = athensNow();
        if (attemptedEndTime.isBefore(nowAthens, "minute")) {
          setUpdateMessage(
            "Для текущего заказа время окончания не может быть в прошлом"
          );
          return false;
        }
      }

      // DEV log payload - verify customer fields are included
      if (process.env.NODE_ENV === "development") {
        console.log("[useEditOrderState] Save payload:", {
          customerName: payload.customerName,
            phone: payload.phone,
            email: payload.email,
            secondDriver: payload.secondDriver,
            Viber: payload.Viber,
            Whatsapp: payload.Whatsapp,
            Telegram: payload.Telegram,
          flightNumber: payload.flightNumber,
          totalPrice: payload.totalPrice,
          numberOfDays: payload.numberOfDays,
          allFields: Object.keys(payload),
          customerFieldsIncluded: {
            customerName: "customerName" in payload,
            phone: "phone" in payload,
            email: "email" in payload,
            secondDriver: "secondDriver" in payload,
            Viber: "Viber" in payload,
            Whatsapp: "Whatsapp" in payload,
            Telegram: "Telegram" in payload,
            flightNumber: "flightNumber" in payload,
          },
          fieldPermissions: {
            customerName: fieldPermissions.customerName,
            phone: fieldPermissions.phone,
            email: fieldPermissions.email,
            secondDriver: fieldPermissions.secondDriver,
            Viber: fieldPermissions.Viber,
            Whatsapp: fieldPermissions.Whatsapp,
            Telegram: fieldPermissions.Telegram,
            flightNumber: fieldPermissions.flightNumber,
          },
          editedOrderValues: {
            customerName: o.customerName,
            phone: o.phone,
            email: o.email,
            secondDriver: o.secondDriver,
            Viber: o.Viber,
            Whatsapp: o.Whatsapp,
            Telegram: o.Telegram,
            flightNumber: o.flightNumber,
          },
        });
      }

      // Call unified API
      const response = await updateOrder(o._id, payload);

      // Handle response
      if (response.status === 201 || response.status === 202) {
        // 🔧 FIX: Sync editedOrder with server response to prevent stale data
        if (response.updatedOrder) {
          // Convert server dates to Athens timezone
          // 🔧 PRICE ARCHITECTURE: Preserve OverridePrice from server response
          const updatedOrder = {
            ...response.updatedOrder,
            rentalStartDate: athensStartOfDay(formatDateYYYYMMDD(fromServerUTC(response.updatedOrder.rentalStartDate))),
            rentalEndDate: athensStartOfDay(formatDateYYYYMMDD(fromServerUTC(response.updatedOrder.rentalEndDate))),
            timeIn: fromServerUTC(response.updatedOrder.timeIn),
            timeOut: fromServerUTC(response.updatedOrder.timeOut),
            // Preserve OverridePrice if server returned it (or null if cleared)
            OverridePrice: response.updatedOrder.OverridePrice !== undefined 
              ? response.updatedOrder.OverridePrice 
              : o?.OverridePrice, // Fallback to current value if server didn't return it
            deliveryInOverride:
              response.updatedOrder.deliveryInOverride !== undefined
                ? response.updatedOrder.deliveryInOverride
                : o?.deliveryInOverride,
            deliveryOutOverride:
              response.updatedOrder.deliveryOutOverride !== undefined
                ? response.updatedOrder.deliveryOutOverride
                : o?.deliveryOutOverride,
          };
          
          setEditedOrder(updatedOrder);
          const sr = response.updatedOrder;
          setManualDeliveryIn(
            sr.deliveryInOverride != null && sr.deliveryInOverride !== undefined
              ? String(sr.deliveryInOverride)
              : ""
          );
          setManualDeliveryOut(
            sr.deliveryOutOverride != null && sr.deliveryOutOverride !== undefined
              ? String(sr.deliveryOutOverride)
              : ""
          );
          await refetchPriceBreakdown(sr._id);
          
          // DEV log response - verify customer fields were saved
          if (process.env.NODE_ENV === "development") {
            console.log("[useEditOrderState] Save response:", {
              customerName: updatedOrder.customerName,
              phone: updatedOrder.phone,
              email: updatedOrder.email,
              secondDriver: updatedOrder.secondDriver,
              Viber: updatedOrder.Viber,
              Whatsapp: updatedOrder.Whatsapp,
              Telegram: updatedOrder.Telegram,
              flightNumber: updatedOrder.flightNumber,
              totalPrice: updatedOrder.totalPrice,
              numberOfDays: updatedOrder.numberOfDays,
              customerFieldsMatch: {
                customerName: updatedOrder.customerName === (payload.customerName ?? order.customerName),
                phone: updatedOrder.phone === (payload.phone ?? order.phone),
                email: updatedOrder.email === (payload.email ?? order.email),
                secondDriver:
                  updatedOrder.secondDriver ===
                  (payload.secondDriver ?? order.secondDriver),
                Viber: updatedOrder.Viber === (payload.Viber ?? order.Viber),
                Whatsapp: updatedOrder.Whatsapp === (payload.Whatsapp ?? order.Whatsapp),
                Telegram: updatedOrder.Telegram === (payload.Telegram ?? order.Telegram),
                flightNumber: updatedOrder.flightNumber === (payload.flightNumber ?? order.flightNumber),
              },
            });
          }
        }
        
        onSave(response.updatedOrder);
        setUpdateMessage("Order updated successfully");
        setAttemptedSave(false);
        return true;
      } else if (response.status === 408 || response.status === 409) {
        setUpdateMessage(response.message || "Conflict detected");
        return false;
      } else {
        setUpdateMessage(response.message || "Failed to update order");
        return false;
      }
    } catch (error) {
      console.error("Error updating order:", error);
      setUpdateMessage(error?.message || "Failed to update order");
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [
    permissions,
    editedOrder,
    startTime,
    endTime,
    selectedCar, // Use memoized selectedCar instead of cars
    order,
    onSave,
    // Note: isManualTotalPrice is checked inside callback, not needed in deps
    // Note: cars removed from deps - we use memoized selectedCar instead
    manualDeliveryIn,
    manualDeliveryOut,
    storedBreakdown,
    priceBreakdown,
    priceRecalculated,
    currentRatesData,
    refetchPriceBreakdown,
  ]);

  /** Итого из разбивки (аренда + опции + доставка) → totalPrice и сохранение одним шагом */
  const handleApplyQuotedDeliveryAndSave = useCallback(async () => {
    const prep = prepareApplyQuotedDeliveryGrandSave({
      editedOrder,
      manualDeliveryIn,
      manualDeliveryOut,
      priceBreakdown,
      viewOnly: permissions.viewOnly,
      fieldPermissions: permissions.fieldPermissions,
    });
    if (prep.kind === "silent") return;
    if (prep.kind === "error") {
      setUpdateMessage(prep.message);
      return;
    }
    setIsManualTotalPrice(false);
    await handleSave({ orderOverride: prep.orderOverride });
  }, [
    permissions.viewOnly,
    permissions.fieldPermissions,
    editedOrder,
    manualDeliveryIn,
    manualDeliveryOut,
    priceBreakdown,
    handleSave,
  ]);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(async () => {
    if (permissions.viewOnly || !permissions.canDelete) return;

    // Check if current order (admin cannot delete)
    if (
      permissions.isCurrentOrder &&
      !permissions.canDelete // This already checks superadmin
    ) {
      setUpdateMessage("Текущий заказ нельзя удалить");
      return;
    }

    const isConfirmed = window.confirm("Are you sure you want to delete this order?");
    if (!isConfirmed) return;

    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      const result = await deleteOrder(editedOrder._id);

      if (!result.success) {
        throw new Error(result.message || "Failed to delete order");
      }

      if (setCarOrders) {
        setCarOrders((prevOrders) =>
          prevOrders.filter((o) => o._id !== editedOrder._id)
        );
      }

      await fetchAndUpdateOrders();
      setUpdateMessage("Order deleted successfully");
      onClose();
    } catch (error) {
      console.error("Error deleting order:", error);
      setUpdateMessage("Failed to delete order. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }, [
    permissions,
    editedOrder,
    setCarOrders,
    fetchAndUpdateOrders,
    onClose,
  ]);

  // Reset attemptedSave when time/date changes
  useEffect(() => {
    setAttemptedSave(false);
  }, [startTime, endTime, editedOrder?.rentalStartDate, editedOrder?.rentalEndDate]);

  // ============================================================
  // RATE CHANGE HANDLERS
  // ============================================================

  const lockedSavedBreakdown = useMemo(() => storedBreakdown, [storedBreakdown]);

  const originalTotalPrice = useMemo(
    () => getOriginalTotalPrice(lockedSavedBreakdown, editedOrder),
    [lockedSavedBreakdown, editedOrder]
  );

  const currentBookingPriceSummary = useMemo(() => {
    if (!currentRatesData) return null;
    return buildBookingPriceSummary(currentRatesData);
  }, [currentRatesData]);

  /** API totalPrice = только аренда+опции; + delivery из breakdown = итого как в заказе */
  const currentRatesGrandTotal = useMemo(() => {
    return currentBookingPriceSummary?.totalPrice ?? null;
  }, [currentBookingPriceSummary]);

  const savedBreakdownGrandTotal = useMemo(() => {
    if (!lockedSavedBreakdown) return null;
    return grandTotalFromPriceBreakdown(lockedSavedBreakdown);
  }, [lockedSavedBreakdown]);

  const savedRentalSubtotal = useMemo(() => {
    return lockedSavedBreakdown
      ? sumRentalSubtotalFromPriceBreakdown(lockedSavedBreakdown)
      : null;
  }, [lockedSavedBreakdown]);

  const currentRentalSubtotal = useMemo(() => {
    return currentRatesData ? Number(currentRatesData.totalPrice) || 0 : null;
  }, [currentRatesData]);

  const rateChanged = useMemo(() => {
    return (
      savedRentalSubtotal != null &&
      currentRentalSubtotal != null &&
      Math.abs(currentRentalSubtotal - savedRentalSubtotal) > 0.01
    );
  }, [savedRentalSubtotal, currentRentalSubtotal]);

  const livePreviewPrice = useMemo(() => {
    return currentBookingPriceSummary?.totalPrice ?? null;
  }, [currentBookingPriceSummary]);

  useEffect(() => {
    if (pendingReactivePriceSyncRef.current == null) return;
    if (currentRatesData?.requestId !== pendingReactivePriceSyncRef.current) {
      return;
    }

    const syncResult = buildReactivePriceSyncResult({
      editedOrder,
      currentBookingPriceSummary,
      currentRatesData,
    });

    if (!syncResult) return;

    pendingReactivePriceSyncRef.current = null;
    setEditedOrder(syncResult.orderSnapshot);
    setPriceBreakdown(syncResult.priceBreakdown);
    setPriceRecalculated(true);
  }, [editedOrder, currentBookingPriceSummary, currentRatesData]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    console.log("PRICING_COMPARE_DEBUG", {
      savedRentalSubtotal,
      currentRentalSubtotal,
      savedGrandTotal: lockedSavedBreakdown
        ? grandTotalFromPriceBreakdown(lockedSavedBreakdown)
        : null,
      currentRatesData,
      lockedSavedBreakdown,
      totalPrice: editedOrder?.totalPrice,
      override: editedOrder?.OverridePrice,
    });
  }, [
    savedRentalSubtotal,
    currentRentalSubtotal,
    currentRatesData,
    lockedSavedBreakdown,
    editedOrder?.totalPrice,
    editedOrder?.OverridePrice,
  ]);

  // ============================================================
  // RETURN
  // ============================================================

  return {
    // State
    editedOrder,
    setEditedOrder,
    startTime,
    endTime,
    loading,
    isUpdating,
    setIsUpdating,
    updateMessage,
    attemptedSave,
    setAttemptedSave,
    calcLoading,
    
    // Derived
    selectedCar,
    priceBreakdown,
    storedBreakdown,
    
    // Rate change
    rateChanged,
    currentRatesData,
    currentRentalSubtotal,
    currentBookingPriceSummary,
    savedRentalSubtotal,
    currentRatesGrandTotal,
    livePreviewPrice,
    savedBreakdownGrandTotal,
    originalTotalPrice,
    priceRecalculated,
    
    // Updaters
    updateField,
    updateStartDate,
    updateEndDate,
    updateStartTime,
    updateEndTime,
    
    // Handlers
    handleSave,
    handleDelete,
    setUpdateMessage,

    manualDeliveryIn,
    setManualDeliveryIn,
    manualDeliveryOut,
    setManualDeliveryOut,
    deliveryQuoteLoading,
    handleQuoteDelivery,
    handleClearDeliveryManual,
    handleApplyQuotedDeliveryAndSave,
  };
}

export default useEditOrderState;
