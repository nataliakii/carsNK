import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Modal,
  Typography,
  Box,
  TextField,
  CircularProgress,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  ConfirmButton,
  CancelButton,
  BookingEditableDateField,
  BookingTimeField,
  BookingTextField,
  BookingLocationAutocomplete,
  BookingFlightField,
} from "@/app/components/ui";
import BookingContactSection from "@/app/components/orders/BookingContactSection";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useMainContext } from "@app/Context";
import { returnHoursToParseToDayjs } from "@/domain/calendar";
import {
  addOrderNew,
  calculateTotalPrice,
} from "@utils/action";
import { getSecondDriverPriceLabelValue } from "@utils/secondDriverPricing";
import { useTranslation } from "react-i18next";
import {
  buildBookingPriceSummary,
  createEmptyBookingPriceSummary,
} from "@/domain/orders/bookingPriceSummary";
import { buildDeliveryHelperText } from "@/domain/orders/bookingDeliveryPresentation";
// 🎯 Athens timezone utilities — ЕДИНСТВЕННЫЙ источник правды для времени
import {
  createAthensDateTime,
  toServerUTC,
  formatTimeHHMM,
  generateOrderNumber,
} from "@/domain/time/athensTime";
import {
  LOCATION_DIVIDER_BEFORE,
  ORDERED_LOCATION_OPTIONS,
} from "@/domain/orders/locationOptions";
import { getBusinessRentalDaysByMinutes } from "@/domain/orders/numberOfDays";
import { RenderTextField } from "@/app/components/ui/inputs/Fields";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import {
  canonicalizeCustomerBookingLocation,
  isThessalonikiCityBookingLocation,
} from "@/domain/orders/halkidikiBookingLocations";
import { normalizeDeliveryPricingLocation } from "@/domain/orders/bookingPricingOptions";
import OrderUnsavedCloseDialog from "@/app/admin/features/orders/components/OrderUnsavedCloseDialog";
import {
  buildAddOrderSnapshot,
  isAddOrderDirty,
} from "@/app/admin/features/orders/utils/orderEditDirty";

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const AddOrder = ({ open, onClose, car, date, setUpdateStatus }) => {
  const { fetchAndUpdateOrders, company } =
    useMainContext();
  const { t, i18n } = useTranslation();
  const secondDriverPriceLabelValue = getSecondDriverPriceLabelValue();
  // Use Mongo _id as primary identifier for price calc to avoid
  // ambiguity with duplicated/changed regNumber or carNumber.
  const carApiIdentifier =
    car?._id?.toString?.() || car?.regNumber || car?.carNumber || "";

  const locations = ORDERED_LOCATION_OPTIONS;
  // const locations = company.locations.map((loc) => loc.name);

  const {
    defaultStartHour,
    defaultStartMinute,
    defaultEndHour,
    defaultEndMinute,
  } = returnHoursToParseToDayjs(company);

  const getInitialOrderDetails = useCallback(
    () => ({
      placeIn: "Nea Kallikratia",
      placeOut: "Nea Kallikratia",
      placeInDetail: "",
      placeOutDetail: "",
      customerName: "",
      phone: "",
      email: "",
      secondDriver: false,
      Viber: false,
      Whatsapp: false,
      Telegram: false,
      totalPrice: 0,
      numberOfDays: 0,
      confirmed: false,
      my_order: false,
      offline: false,
      ChildSeats: 0,
      insurance: "TPL",
      franchiseOrder: car?.franchise ?? 0,
      orderNumber: generateOrderNumber(),
      flightNumber: "",
      drivingLicenceUrls: [],
    }),
    [car?.franchise]
  );

  const [bookDates, setBookedDates] = useState({ start: null, end: null });
  const [orderDetails, setOrderDetails] = useState(() => getInitialOrderDetails());
  // Состояние для расчета стоимости
  const [daysAndTotal, setDaysAndTotal] = useState(() =>
    createEmptyBookingPriceSummary()
  );
  const [calcLoading, setCalcLoading] = useState(false);
  const [startTime, setStartTime] = useState(
    dayjs().hour(defaultStartHour).minute(defaultStartMinute)
  );
  const [endTime, setEndTime] = useState(
    dayjs().hour(defaultEndHour).minute(defaultEndMinute)
  );

  // Получение количества дней и общей стоимости через calculateTotalPrice из utils/action
  useEffect(() => {
    const abortController = new AbortController();

    const fetchTotalPrice = async () => {
      if (!carApiIdentifier || !bookDates?.start || !bookDates?.end) {
        setDaysAndTotal(createEmptyBookingPriceSummary());
        return;
      }
      setCalcLoading(true);
      try {
        const normalizedPlaceIn = normalizeDeliveryPricingLocation(
          orderDetails.placeIn
        );
        const normalizedPlaceOut = normalizeDeliveryPricingLocation(
          orderDetails.placeOut
        );
        const timeInAthens =
          startTime && bookDates.start
            ? createAthensDateTime(
                bookDates.start,
                formatTimeHHMM(dayjs(startTime))
              )
            : null;
        const timeOutAthens =
          endTime && bookDates.end
            ? createAthensDateTime(
                bookDates.end,
                formatTimeHHMM(dayjs(endTime))
              )
            : null;
        const timeInServer = timeInAthens ? toServerUTC(timeInAthens) : undefined;
        const timeOutServer = timeOutAthens ? toServerUTC(timeOutAthens) : undefined;
        const result = await calculateTotalPrice(
          carApiIdentifier,
          bookDates.start,
          bookDates.end,
          orderDetails.insurance,
          orderDetails.ChildSeats,
          {
            signal: abortController.signal,
            secondDriver: Boolean(orderDetails.secondDriver),
            timeIn: timeInServer,
            timeOut: timeOutServer,
            placeIn: normalizedPlaceIn,
            placeOut: normalizedPlaceOut,
          }
        );
        if (abortController.signal.aborted) return;
        setDaysAndTotal(buildBookingPriceSummary(result));
      } catch (error) {
        if (error?.name === "AbortError" || abortController.signal.aborted) return;
        setDaysAndTotal(createEmptyBookingPriceSummary());
      } finally {
        if (!abortController.signal.aborted) {
          setCalcLoading(false);
        }
      }
    };
    fetchTotalPrice();

    return () => {
      abortController.abort();
    };
  }, [
    carApiIdentifier,
    bookDates?.start,
    bookDates?.end,
    orderDetails.insurance,
    orderDetails.ChildSeats,
    orderDetails.secondDriver,
    startTime,
    endTime,
    orderDetails.placeIn,
    orderDetails.placeOut,
  ]);

  // Автоматически подставлять вычисленную стоимость в поле totalPrice
  useEffect(() => {
    if (daysAndTotal.totalPrice !== orderDetails.totalPrice) {
      setOrderDetails((prev) => ({
        ...prev,
        totalPrice: daysAndTotal.totalPrice,
      }));
    }
  }, [daysAndTotal.totalPrice, orderDetails.totalPrice]);
  // Хелпер для нормализации дат (аналогично BookingModal)
  function normalizeDate(date) {
    return date ? dayjs(date).format("YYYY-MM-DD") : null;
  }
  const [loadingState, setLoadingState] = useState(false);
  const [statusMessage, setStatusMessage] = useState({
    type: null,
    message: "",
  });
  const [unsavedCloseOpen, setUnsavedCloseOpen] = useState(false);
  const [unsavedSaving, setUnsavedSaving] = useState(false);
  const [addFormBaselineSnapshot, setAddFormBaselineSnapshot] = useState(null);
  const addFormLiveRef = useRef({
    bookDates,
    orderDetails,
    startTime,
    endTime,
  });
  addFormLiveRef.current = { bookDates, orderDetails, startTime, endTime };

  useEffect(() => {
    if (!open) {
      setAddFormBaselineSnapshot(null);
      setUnsavedCloseOpen(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const s = addFormLiveRef.current;
      setAddFormBaselineSnapshot(
        buildAddOrderSnapshot(
          s.bookDates,
          s.orderDetails,
          s.startTime,
          s.endTime
        )
      );
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, car?._id, date]);

  const addFormCurrentSnapshot = useMemo(
    () => buildAddOrderSnapshot(bookDates, orderDetails, startTime, endTime),
    [bookDates, orderDetails, startTime, endTime]
  );

  const isAddFormDirty =
    Boolean(addFormBaselineSnapshot) &&
    isAddOrderDirty(addFormCurrentSnapshot, addFormBaselineSnapshot);

  const requestCloseAddModal = useCallback(() => {
    if (loadingState) return;
    if (!isAddFormDirty) {
      onClose();
      return;
    }
    setUnsavedCloseOpen(true);
  }, [loadingState, isAddFormDirty, onClose]);

  const handleAddModalOnClose = useCallback(
    (_event, reason) => {
      if (reason === "backdropClick" || reason === "escapeKeyDown") {
        requestCloseAddModal();
      }
    },
    [requestCloseAddModal]
  );

  const handleUnsavedAddDiscard = useCallback(() => {
    setUnsavedCloseOpen(false);
    onClose();
  }, [onClose]);

  const handleUnsavedAddCancel = useCallback(() => {
    setUnsavedCloseOpen(false);
  }, []);

  // --- ВАЖНО: автоматическое заполнение даты и franchiseOrder при открытии модального окна ---
  const getInitialBookDates = useCallback(() => {
    if (!date) return { start: null, end: null };

    let startDate = null;
    let endDate = null;
    if (Array.isArray(date) && date.length === 2) {
      startDate = normalizeDate(date[0]);
      endDate = normalizeDate(date[1]);
    } else {
      startDate = normalizeDate(date);
      endDate = normalizeDate(dayjs(date).add(1, "day"));
    }

    const todayStr = dayjs().format("YYYY-MM-DD");
    if (startDate && dayjs(startDate).isBefore(dayjs(), "day")) {
      startDate = todayStr;
      if (!endDate || dayjs(endDate).isSameOrBefore(dayjs(startDate), "day")) {
        endDate = dayjs(startDate).add(1, "day").format("YYYY-MM-DD");
      }
    }

    return {
      start: startDate,
      end: endDate,
    };
  }, [date]);

  useEffect(() => {
    // Full reset when modal closes, so next open never flashes stale values
      if (!open) {
        setBookedDates({ start: null, end: null });
        setDaysAndTotal(createEmptyBookingPriceSummary());
        setCalcLoading(false);
        setOrderDetails(getInitialOrderDetails());
        setStartTime(dayjs().hour(defaultStartHour).minute(defaultStartMinute));
      setEndTime(dayjs().hour(defaultEndHour).minute(defaultEndMinute));
      return;
    }

    // Fresh state for each modal open
    setBookedDates(getInitialBookDates());
    setDaysAndTotal(createEmptyBookingPriceSummary());
    setCalcLoading(false);
    setOrderDetails(getInitialOrderDetails());
  }, [
    open,
    getInitialBookDates,
    getInitialOrderDetails,
    defaultStartHour,
    defaultStartMinute,
    defaultEndHour,
    defaultEndMinute,
  ]);

  const pickupDeliveryHelperText = buildDeliveryHelperText({
    locationValue: orderDetails.placeIn,
    deliveryCost: daysAndTotal.pickupDeliveryCost,
    locale: i18n.language,
    deliveryLabel: t("order.delivery"),
    isLoading: calcLoading,
    hideWhenZero: true,
  });
  const returnDeliveryHelperText = buildDeliveryHelperText({
    locationValue: orderDetails.placeOut,
    deliveryCost: daysAndTotal.returnDeliveryCost,
    locale: i18n.language,
    deliveryLabel: t("order.delivery"),
    isLoading: calcLoading,
    hideWhenZero: true,
  });

  // Оптимизированный обработчик изменения полей
  const handleFieldChange = useCallback((field, value) => {
    setOrderDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  useEffect(() => {
    setOrderDetails((prev) => {
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
  }, [orderDetails.placeIn, orderDetails.placeOut]);

  const toggleConfirmedStatus = useCallback(() => {
    setOrderDetails((prev) => ({
      ...prev,
      confirmed: !prev.confirmed,
    }));
  }, []);

  const toggleOfflineStatus = useCallback(() => {
    setOrderDetails((prev) => {
      const nextOffline = !prev.offline;
      return {
        ...prev,
        offline: nextOffline,
        // Offline bookings should block dates like confirmed internal orders.
        confirmed: nextOffline ? true : prev.confirmed,
        my_order: nextOffline ? false : prev.my_order,
      };
    });
  }, []);

  const parseTimeInput = useCallback((value, baseDate, fallbackTime) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
    if (!match) return fallbackTime;

    const [, hourStr, minuteStr] = match;
    const base = baseDate ? dayjs(baseDate) : dayjs();
    return base
      .hour(Number(hourStr))
      .minute(Number(minuteStr))
      .second(0)
      .millisecond(0);
  }, []);

  const handleStartTimeChange = useCallback(
    (value) => {
      setStartTime((prev) => parseTimeInput(value, bookDates.start, prev));
    },
    [bookDates.start, parseTimeInput]
  );

  const handleEndTimeChange = useCallback(
    (value) => {
      setEndTime((prev) => parseTimeInput(value, bookDates.end, prev));
    },
    [bookDates.end, parseTimeInput]
  );


  /**
   * @param {{ immediateCloseOnSuccess?: boolean }} [options]
   * @returns {Promise<boolean>} true если заказ успешно создан
   */
  const handleBookingComplete = async (options = {}) => {
    const { immediateCloseOnSuccess = false } = options;
    setLoadingState(true);
    setStatusMessage({ type: null, message: "" });
    
    // Валидация: цена должна быть рассчитана
    if (calcLoading) {
      setStatusMessage({
        type: "error",
        message: "Дождитесь расчёта стоимости",
      });
      setLoadingState(false);
      return false;
    }
    
    // Валидация: начало не раньше сегодняшнего дня
    if (bookDates.start && dayjs(bookDates.start).isBefore(dayjs(), "day")) {
      setStatusMessage({
        type: "error",
        message: "Дата начала аренды не может быть раньше сегодняшнего дня",
      });
      setLoadingState(false);
      return false;
    }

    const phoneTrim = (orderDetails.phone || "").trim();
    if (!phoneTrim || !isValidInternationalPhone(phoneTrim)) {
      setStatusMessage({
        type: "error",
        message: phoneTrim ? t("order.phoneInvalid") : t("order.required"),
      });
      setLoadingState(false);
      return false;
    }

    const pin = String(orderDetails.placeIn || "").trim();
    const pout = String(orderDetails.placeOut || "").trim();
    const cin = canonicalizeCustomerBookingLocation(pin);
    const cout = canonicalizeCustomerBookingLocation(pout);
    if (
      cin &&
      isThessalonikiCityBookingLocation(cin) &&
      String(orderDetails.placeInDetail || "").trim().length < 3
    ) {
      setStatusMessage({
        type: "error",
        message: t("order.thessalonikiDetailRequired"),
      });
      setLoadingState(false);
      return false;
    }
    if (
      cout &&
      isThessalonikiCityBookingLocation(cout) &&
      String(orderDetails.placeOutDetail || "").trim().length < 3
    ) {
      setStatusMessage({
        type: "error",
        message: t("order.thessalonikiDetailRequired"),
      });
      setLoadingState(false);
      return false;
    }

    // 🎯 Используем athensTime utilities для timezone-корректного создания времени
    // Извлекаем HH:mm и создаём заново в Athens БЕЗ конвертации из таймзоны браузера
    const timeInAthens = createAthensDateTime(
      bookDates.start,
      formatTimeHHMM(dayjs(startTime))
    );
    const timeOutAthens = createAthensDateTime(
      bookDates.end,
      formatTimeHHMM(dayjs(endTime))
    );

    // Конвертируем в UTC для сохранения в БД
    const timeInUTC = toServerUTC(timeInAthens);
    const timeOutUTC = toServerUTC(timeOutAthens);

    // Используем daysAndTotal.totalPrice если orderDetails.totalPrice ещё не обновился (race condition)
    const finalTotalPrice = orderDetails.totalPrice > 0 
      ? orderDetails.totalPrice 
      : daysAndTotal.totalPrice;
    
    const data = {
      carId: car?._id?.toString?.() || "",
      regNumber: car?.regNumber,
      carNumber: car?.carNumber,
      customerName: orderDetails.customerName,
      phone: phoneTrim,
      email: orderDetails.email,
      secondDriver: Boolean(orderDetails.secondDriver),
      Viber: orderDetails.Viber,
      Whatsapp: orderDetails.Whatsapp,
      Telegram: orderDetails.Telegram,
      timeIn: timeInUTC,
      timeOut: timeOutUTC,
      rentalStartDate: dayjs(bookDates.start).toDate(), // Дата без времени
      rentalEndDate: dayjs(bookDates.end).toDate(), // Дата без времени
      placeIn: cin || orderDetails.placeIn,
      placeOut: cout || orderDetails.placeOut,
      placeInDetail: String(orderDetails.placeInDetail || "").trim(),
      placeOutDetail: String(orderDetails.placeOutDetail || "").trim(),
      confirmed: orderDetails.confirmed,
      my_order: orderDetails.my_order,
      offline: Boolean(orderDetails.offline),
      ChildSeats: orderDetails.ChildSeats,
      insurance: orderDetails.insurance,
      franchiseOrder: orderDetails.franchiseOrder,
      orderNumber: orderDetails.orderNumber,
      totalPrice: finalTotalPrice,
      flightNumber: orderDetails.flightNumber,
      drivingLicenceUrls: Array.isArray(orderDetails.drivingLicenceUrls)
        ? orderDetails.drivingLicenceUrls
        : [],
    };

    try {
      const response = await addOrderNew(data);

      // Унифицированная обработка ответов addOrderNew
      if (response.status === "success") {
        const msg = response?.data?.message || "Заказ успешно добавлен";
        setStatusMessage({ type: "success", message: msg });
        setUpdateStatus({ type: 200, message: msg }); // type: 200 для обновления календаря
        // Явный вызов обновления заказов для BigCalendar
        if (typeof fetchAndUpdateOrders === "function") {
          fetchAndUpdateOrders();
        }
        if (immediateCloseOnSuccess) {
          setStatusMessage({ type: null, message: "" });
          onClose();
        } else {
          setTimeout(() => {
            setStatusMessage({ type: null, message: "" });
            onClose();
          }, 4000);
        }
        return true;
      }

      if (response.status === "startEndConflict") {
        const msg = response?.message || "Конфликт старт/финиш дат";
        setStatusMessage({ type: "warning", message: msg });
        setUpdateStatus({ type: 200, message: msg });
        return false;
      }

      if (response.status === "pending") {
        const msg = response?.message || "Есть неподтвержденные пересечения";
        setStatusMessage({ type: "warning", message: msg });
        setUpdateStatus({ type: 202, message: msg });
        return false;
      }

      if (response.status === "conflict") {
        const msg = response?.message || "Даты уже заняты и недоступны";
        setStatusMessage({ type: "error", message: msg });
        setUpdateStatus({ type: 409, message: msg });
        return false;
      }

      // status === 'error' или неожиданный статус
      {
        const msg = response?.message || "Не удалось добавить заказ";
        setStatusMessage({ type: "error", message: msg });
        setUpdateStatus({ type: 400, message: msg });
        return false;
      }
    } catch (error) {
      console.error("Ошибка при отправке данных:", error);

      setStatusMessage({
        type: "error",
        message:
          error?.message ||
          "Не удалось добавить заказ. Пожалуйста, проверьте данные.",
      });

      setUpdateStatus({
        type: 400,
        message: error?.message || "Ошибка сервера",
      });
      return false;
    } finally {
      setLoadingState(false);
    }
  };

  const handleBookingCompleteRef = useRef(handleBookingComplete);
  handleBookingCompleteRef.current = handleBookingComplete;

  const handleUnsavedAddSave = useCallback(async () => {
    setUnsavedSaving(true);
    try {
      const ok = await handleBookingCompleteRef.current({
        immediateCloseOnSuccess: true,
      });
      // Close the confirmation dialog in both outcomes:
      // on success modal will close; on failure user can continue editing.
      setUnsavedCloseOpen(false);
      if (!ok) {
        return;
      }
    } finally {
      setUnsavedSaving(false);
    }
  }, []);

  // Отрисовка статусного сообщения
  const renderStatusMessage = () => {
    if (!statusMessage.message) return null;

    const colorMap = {
      success: "success.main",
      error: "error.main",
      warning: "warning.main",
    };

    return (
      <Typography
        variant="body2"
        sx={{
          color: colorMap[statusMessage.type] || "inherit",
          textAlign: "center",
          mt: 2,
        }}
      >
        {statusMessage.message}
      </Typography>
    );
  };

  const renderDateTimeSection = () => {
    // Handle pickup date change with validation
    const handlePickupDateChange = (newStart) => {
      const normalized = normalizeDate(newStart);
      // Запрет выбора прошлой даты
      if (normalized && dayjs(normalized).isBefore(dayjs(), "day")) {
        return; // игнорируем недопустимый выбор
      }
      setBookedDates((dates) => {
        if (!normalized) return { ...dates, start: normalized };
        if (
          dates.end &&
          dayjs(dates.end).isSameOrBefore(dayjs(normalized), "day")
        ) {
          return {
            start: normalized,
            end: dayjs(normalized).add(1, "day").format("YYYY-MM-DD"),
          };
        }
        return { ...dates, start: normalized };
      });
    };

    // Handle return date change with validation
    const handleReturnDateChange = (newEnd) => {
      const normalized = normalizeDate(newEnd);
      if (
        bookDates.start &&
        normalized &&
        dayjs(normalized).isSameOrBefore(dayjs(bookDates.start), "day")
      ) {
        return;
      }
      setBookedDates((dates) => ({ ...dates, end: normalized }));
    };

    return (
      <Box sx={{ mb: 2 }}>
        {/* Date fields */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: { xs: 1, sm: 2 },
            mb: 1,
          }}
        >
          <BookingEditableDateField
            label={t("order.pickupDate")}
            value={bookDates.start || ""}
            onChange={(e) => handlePickupDateChange(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ min: dayjs().format("YYYY-MM-DD") }}
          />
          <BookingEditableDateField
            label={t("order.returnDate")}
            value={bookDates.end || ""}
            onChange={(e) => handleReturnDateChange(e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{
              min: bookDates.start
                ? dayjs(bookDates.start).add(1, "day").format("YYYY-MM-DD")
                : dayjs().format("YYYY-MM-DD"),
            }}
          />
        </Box>
        {/* Time fields */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          <BookingTimeField
            label={t("order.pickupTime")}
            value={startTime.format("HH:mm")}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            sx={{ flex: 1 }}
          />
          <BookingTimeField
            label={t("order.returnTime")}
            value={endTime.format("HH:mm")}
            onChange={(e) => handleEndTimeChange(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(orderDetails.offline)}
              onChange={toggleOfflineStatus}
              size="small"
            />
          }
          label="Офлайн (не через сайт)"
          sx={{ mb: 1, alignSelf: "flex-start" }}
        />
        {/* Location fields */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: { xs: 1, sm: 2 },
              alignItems: "stretch",
            }}
          >
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 1, sm: 2 },
                alignItems: "stretch",
              }}
            >
              <BookingLocationAutocomplete
                label={t("order.pickupLocation")}
                options={locations}
                dividerBeforeOption={LOCATION_DIVIDER_BEFORE}
                value={orderDetails.placeIn || ""}
                onChange={(_, newValue) =>
                  handleFieldChange("placeIn", newValue || "")
                }
                onInputChange={(_, newInputValue) =>
                  handleFieldChange("placeIn", newInputValue)
                }
                sx={{ flex: 1, minWidth: 0 }}
                helperText={pickupDeliveryHelperText || undefined}
              />
              {isThessalonikiCityBookingLocation(orderDetails.placeIn) && (
                <BookingTextField
                  label={t("order.thessalonikiHotelOrAddress")}
                  value={orderDetails.placeInDetail || ""}
                  onChange={(e) =>
                    handleFieldChange("placeInDetail", e.target.value)
                  }
                  sx={{
                    flex: { xs: 1, sm: 0.45 },
                    minWidth: 0,
                  }}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: { xs: 1, sm: 2 },
                alignItems: "stretch",
              }}
            >
              <BookingLocationAutocomplete
                label={t("order.returnLocation")}
                options={locations}
                dividerBeforeOption={LOCATION_DIVIDER_BEFORE}
                value={orderDetails.placeOut || ""}
                onChange={(_, newValue) =>
                  handleFieldChange("placeOut", newValue || "")
                }
                onInputChange={(_, newInputValue) =>
                  handleFieldChange("placeOut", newInputValue)
                }
                sx={{ flex: 1, minWidth: 0 }}
                helperText={returnDeliveryHelperText || undefined}
              />
              {isThessalonikiCityBookingLocation(orderDetails.placeOut) && (
                <BookingTextField
                  label={t("order.thessalonikiHotelOrAddress")}
                  value={orderDetails.placeOutDetail || ""}
                  onChange={(e) =>
                    handleFieldChange("placeOutDetail", e.target.value)
                  }
                  sx={{
                    flex: { xs: 1, sm: 0.45 },
                    minWidth: 0,
                  }}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </Box>
          </Box>
          {orderDetails.placeIn &&
            orderDetails.placeIn.toLowerCase() === "airport" && (
              <BookingFlightField
                label={t("order.flightNumber")}
                value={orderDetails.flightNumber || ""}
                onChange={(e) =>
                  handleFieldChange("flightNumber", e.target.value)
                }
                fullWidth
              />
            )}
        </Box>
      </Box>
    );
  };

  const renderCustomerSection = () => {
    const insuranceOptions =
      t("order.insuranceOptions", { returnObjects: true }) || [];

    return (
      <Box sx={{ mb: 2, mt: 0 }}>
        {/* Страховка и детские кресла — адаптивно */}
        <Box sx={{ 
          display: "flex", 
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 1, sm: 2 }, 
          mb: 1
        }}>
          <FormControl
            fullWidth
            sx={{
              width: { 
                xs: "100%", 
                sm: orderDetails.insurance === "TPL" ? "49%" : "30%" 
              },
            }}
          >
            <InputLabel>{t("order.insurance")}</InputLabel>
            <Select
              label={t("order.insurance")}
              value={orderDetails.insurance || ""}
              onChange={(e) => handleFieldChange("insurance", e.target.value)}
            >
              {(() => {
                const kaskoPrice = car?.PriceKacko ?? 0;
                return (t("order.insuranceOptions", { returnObjects: true }) || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.value === "CDW"
                      ? `${option.label} ${kaskoPrice}€/${t("order.perDay")}`
                      : option.label}
                  </MenuItem>
                ));
              })()}
            </Select>
          </FormControl>
          {orderDetails.insurance === "CDW" && (
            <Box sx={{ width: "16%" }}>
              <RenderTextField
                name="franchiseOrder"
                label={t("car.franchise") || "Франшиза заказа"}
                type="number"
                updatedCar={orderDetails}
                handleChange={(e) =>
                  handleFieldChange("franchiseOrder", Number(e.target.value))
                }
                isLoading={false}
                sx={{ mb: 0 }}
              />
            </Box>
          )}
          <FormControl fullWidth sx={{ width: { xs: "100%", sm: "49%" } }}>
            <InputLabel>
              {t("order.childSeats")}{" "}
              {car?.PriceChildSeats ?? 0}
              €/{t("order.perDay")}
            </InputLabel>
            <Select
              label={`${t("order.childSeats")} ${car?.PriceChildSeats ?? 0}€/${t("order.perDay")}`}
              value={
                typeof orderDetails.ChildSeats === "number"
                  ? orderDetails.ChildSeats
                  : 0
              }
              onChange={(e) =>
                handleFieldChange("ChildSeats", Number(e.target.value))
              }
            >
              <MenuItem value={0}>{t("order.childSeatsNone")}</MenuItem>
              {[1, 2, 3, 4].map((num) => (
                <MenuItem key={num} value={num}>
                  {num}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {/* Customer fields (shared component for admin/client modals) */}
        <BookingContactSection
          mode="admin"
          values={orderDetails}
          onFieldChange={handleFieldChange}
          rentalStartDate={bookDates.start || ""}
          disabled={loadingState}
          secondDriverPriceLabelValue={secondDriverPriceLabelValue}
          drivingLicenceEmphasized
        />
      </Box>
    );
  };

  return (
    <>
    <Modal
      open={open}
      onClose={handleAddModalOnClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
        py: { xs: 1, sm: 2 },
      }}
    >
      <Box
        sx={{
          padding: 2,
          margin: "auto",
          bgcolor: "background.paper",
          maxWidth: 700,
          minWidth: { xs: 0, sm: 600 }, // xs — для телефонов, sm и выше — minWidth: 600
          borderRadius: 2,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {loadingState && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              bgcolor: "rgba(0, 0, 0, 0.5)",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                textAlign: "center",
                color: "white",
              }}
            >
              <CircularProgress color="inherit" />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Отправка заказа...
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          aria-label={t("basic.close")}
          onClick={requestCloseAddModal}
          size="small"
          disabled={loadingState}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "text.secondary",
            "&:hover": { color: "primary.main" },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Typography
          variant="h6"
          color="primary.main"
          sx={{
            letterSpacing: "-0.5px",
            fontSize: "1.1rem",
            pr: 4,
          }}
        >
          {t("order.addOrder")}
          {orderDetails.orderNumber && (
            <>
              {" №"}
              {String(orderDetails.orderNumber)}
            </>
          )}
          {car?.model && (
            <>
              {" "}
              {t("basic.for")} {car.model}
              {car.regNumber ? ` (${car.regNumber})` : ""}
            </>
          )}
        </Typography>

        {/* Количество дней и общая стоимость */}
        <Box
          sx={{
            mb: 2,
            mt: 1,
            fontWeight: 400,
            fontSize: "1.05rem",
            color: "text.primary",
            display: "flex",
            gap: 2,
            alignItems: "center",
          }}
        >
          {calcLoading ? (
            t("order.calculating")
          ) : (
            <>
              <Typography
                variant="body1"
                component="span"
                sx={{ fontWeight: 400, color: "black" }}
              >
                {(() => {
                  let days = daysAndTotal.days;
                  if (bookDates.start && bookDates.end) {
                    const fallbackStart = createAthensDateTime(
                      bookDates.start,
                      formatTimeHHMM(dayjs(startTime))
                    );
                    const fallbackEnd = createAthensDateTime(
                      bookDates.end,
                      formatTimeHHMM(dayjs(endTime))
                    );
                    days = getBusinessRentalDaysByMinutes(
                      fallbackStart,
                      fallbackEnd
                    );
                  }
                  return (
                    <>
                      {t("order.daysNumber", { count: days })}
                      <Box
                        component="span"
                        sx={{
                          fontWeight: "bold",
                          color: "primary.main",
                          mx: 0.5,
                        }}
                      >
                        {days}
                      </Box>
                      | {t("order.price")}
                    </>
                  );
                })()}
              </Typography>
              <TextField
                value={orderDetails.totalPrice}
                onChange={(e) =>
                  handleFieldChange("totalPrice", Number(e.target.value))
                }
                type="number"
                variant="outlined"
                margin="dense"
                inputProps={{
                  style: {
                    fontWeight: 700,
                    fontSize: 18,
                    textAlign: "right",
                    letterSpacing: 1,
                    color: "error.main",
                    paddingRight: 0,
                  },
                  maxLength: 4,
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  size: 6,
                }}
                sx={{
                  ml: 1,
                  mt: 0,
                  mb: 1,
                  width: "115px",
                  "& .MuiInputBase-input": {
                    padding: "8px 8px 8px 12px",
                    width: "6ch",
                    boxSizing: "content-box",
                    color: "error.main",
                    fontSize: 18,
                  },
                  "& .MuiInputAdornment-root": {
                    marginLeft: 0,
                    marginRight: 0,
                  },
                }}
                placeholder="0"
                InputProps={{
                  endAdornment: (
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 18,
                        marginLeft: 0,
                        marginRight: "-8px",
                        paddingLeft: 0,
                        paddingRight: 0,
                        letterSpacing: 0,
                        color: "error.main",
                        display: "inline-block",
                      }}
                    >
                      €
                    </span>
                  ),
                }}
              />
            </>
          )}
        </Box>
        {renderDateTimeSection()}
        {renderCustomerSection()}

        {renderStatusMessage()}

        <Box sx={{ mt: 2, display: "flex", gap: 2, justifyContent: "center" }}>
          <CancelButton
            onClick={requestCloseAddModal}
            disabled={loadingState}
            label={t("basic.cancel")}
          />
          <ConfirmButton
            onClick={handleBookingComplete}
            loading={loadingState}
            disabled={
              !bookDates.start ||
              !bookDates.end ||
              !startTime ||
              !endTime ||
              !orderDetails.customerName ||
              !orderDetails.phone
            }
            label={t("order.CompleteBook")}
          />
        </Box>
      </Box>
    </Modal>
    <OrderUnsavedCloseDialog
      open={unsavedCloseOpen}
      onClose={handleUnsavedAddCancel}
      onDiscard={handleUnsavedAddDiscard}
      onSaveAndExit={handleUnsavedAddSave}
      saving={unsavedSaving}
    />
    </>
  );
};

export default AddOrder;
