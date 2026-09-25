import React, { useState, useEffect, useRef, useCallback, startTransition } from "react";
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Grid,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import { Calendar, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import ruRU from "antd/locale/ru_RU";
import ukUA from "antd/locale/uk_UA";
import elGR from "antd/locale/el_GR";
import deDE from "antd/locale/de_DE";
import bgBG from "antd/locale/bg_BG";
import roRO from "antd/locale/ro_RO";
import plPL from "antd/locale/pl_PL";
import frFR from "antd/locale/fr_FR";
import itIT from "antd/locale/it_IT";
import svSE from "antd/locale/sv_SE";
import caES from "antd/locale/ca_ES";
import nbNO from "antd/locale/nb_NO";
import dayjs from "dayjs";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import DefaultButton from "@/app/components/ui/buttons/DefaultButton";
import GradientBookButton from "@/app/components/ui/buttons/GradientBookButton";
import {
  functionToretunrStartEndOverlap,
  getConfirmedAndUnavailableStartEndDates,
  extractArraysOfStartEndConfPending,
  returnTime,
  calculateAvailableTimes,
} from "@/domain/calendar";
import { calculateTotalPrice } from "@utils/action";
import { getBusinessRentalDaysByMinutes } from "@/domain/orders/numberOfDays";
import {
  companyUsesSeasons,
  getFlatDailyRateFromPricingTiers,
} from "@/domain/orders/flatDailyRate";
import { analyzeDates } from "@utils/analyzeDates";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import ClearIcon from "@mui/icons-material/Clear";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/ru";
import "dayjs/locale/el";
import "dayjs/locale/es";
import "dayjs/locale/uk";
import "dayjs/locale/de";
import "dayjs/locale/bg";
import "dayjs/locale/ro";
import "dayjs/locale/sr";
import "dayjs/locale/pl";
import "dayjs/locale/fr";
import "dayjs/locale/it";
import "dayjs/locale/sv";
import "dayjs/locale/nb";
import "dayjs/locale/ca";

const ANTD_LOCALES = {
  en: enUS,
  es: esES,
  ru: ruRU,
  uk: ukUA,
  el: elGR,
  de: deDE,
  bg: bgBG,
  ro: roRO,
  pl: plPL,
  fr: frFR,
  it: itIT,
  sv: svSE,
  ca: caES,
  no: nbNO,
};

const DAYJS_LOCALE = {
  no: "nb",
};
import { useMainContext } from "@app/Context";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import { getSiteCountryCode } from "@config/siteCountry";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";

dayjs.extend(utc);
dayjs.extend(timezone);

// DEBUG: укажите дату вида 'YYYY-MM-DD' и при необходимости конкретный carId,
// чтобы включить точечные логи только для выбранной машины и даты.
// Пример: const DEBUG_DATE = '2025-07-14'; const DEBUG_CAR_ID = '670bb226223dd911f0595287';
// По умолчанию логирование отключено (оба null)
const DEBUG_DATE = null;
const DEBUG_CAR_ID = null;

const CalendarPicker = ({
  isLoading,
  setBookedDates,
  onBookingComplete,
  orders,
  carId,
  car, // Добавляем объект car для получения regNumber/carNumber
  setSelectedTimes,
  selectedTimes,
  onDateChange, // ⬅️ новый проп
  onCurrentDateChange, // ДОБАВИТЬ ЭТОТ PROP
  discount,
  discountStart,
  discountEnd,
  onPriceCalculated, // Callback для передачи просчитанной цены
  presetSearchDates = null,
  embedded = false,
  onRangeCommitted,
  onSelectionCleared,
  onUnavailableRange,
}) => {
  const { t, i18n } = useTranslation();
  const uiLang = (i18n.language || "en").split("-")[0];
  const dayjsLang = DAYJS_LOCALE[uiLang] || uiLang;
  const antdLocale = ANTD_LOCALES[uiLang] || enUS;
  const { company, platform, bookingPlaceIn, bookingPlaceOut } = useMainContext();
  const calendarTz = resolveBusinessTimezone({
    company,
    countryCode: company?.country || platform?.country,
    platformSettings: platform,
    forNewOrder: true,
  });
  dayjs.tz.setDefault(calendarTz);
  const theme = useTheme();
  const isSmallLandscape = useMediaQuery(
    "(max-width:900px) and (orientation: landscape)"
  );
  const isPortraitPhone = useMediaQuery(
    "(max-width:600px) and (orientation: portrait)"
  );
  //console.log(t("order.chooseDates"));
  const [selectedRange, setSelectedRange] = useState([null, null]);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [confirmedDates, setConfirmedDates] = useState([]);
  const [startEndDates, setStartEndDates] = useState([]);
  const [showBookButton, setShowBookButton] = useState(false);
  const [startEndOverlapDates, setStartEndOverlapDates] = useState(null);
  // Add refs for the calendar container and tracking clicks
  const lastClickTimeRef = useRef(0);
  const clickCountRef = useRef(0);
  const userPickedRef = useRef(false);
  const bookButtonRef = useRef(null);
  // DEBUG: чтобы не спамить логами для одной и той же даты
  const loggedCellsRef = useRef(new Set());
  // Состояние для расчета суммы заказа
  const [totalPrice, setTotalPrice] = useState(0);
  const [calcLoading, setCalcLoading] = useState(false);
  const [priceIsApproximate, setPriceIsApproximate] = useState(false);
  // carId (_id) is always unique in MongoDB. Fallback: carNumber, regNumber.
  const carApiIdentifier = car?._id?.toString?.() || car?.carNumber || car?.regNumber || "";
  const pickupForPricing = bookingPlaceIn?.trim() || undefined;
  const returnForPricing = bookingPlaceOut?.trim() || undefined;
  const spainDeliveryMayVary =
    isSpainBookingSite(getSiteCountryCode()) &&
    Boolean(pickupForPricing || returnForPricing);

  const estimateClientTotal = useCallback(() => {
    if (!selectedRange[0] || !selectedRange[1]) return null;
    const days = getBusinessRentalDaysByMinutes(
      selectedRange[0],
      selectedRange[1],
      calendarTz
    );
    if (days <= 0) return null;

    if (!companyUsesSeasons(company)) {
      const rate = getFlatDailyRateFromPricingTiers(car?.pricingTiers);
      if (rate > 0) {
        const insurance = resolveDefaultInsurance(car);
        const cdwPerDay =
          insurance === "CDW" ? Number(car?.PriceKacko) || 0 : 0;
        const total = rate * days + cdwPerDay * days;
        return {
          totalPrice: Math.round(total * 100) / 100,
          days,
          approximate: true,
        };
      }
    }

    return null;
  }, [selectedRange, calendarTz, company, car?.pricingTiers, car?.PriceKacko]);

  // Расчет суммы заказа через action (+ client estimate so UI never sticks on "...")
  const fetchTotalPrice = useCallback(
    async ({ signal, isCurrent } = {}) => {
      if (!carApiIdentifier || !selectedRange[0] || !selectedRange[1]) {
        if (isCurrent?.()) {
          setTotalPrice(0);
          setPriceIsApproximate(false);
          setCalcLoading(false);
        }
        return;
      }

      const clientEstimate = estimateClientTotal();
      if (isCurrent?.() && clientEstimate?.totalPrice > 0) {
        setTotalPrice(clientEstimate.totalPrice);
        setPriceIsApproximate(true);
      }

      if (isCurrent?.()) setCalcLoading(true);
      try {
        const result = await calculateTotalPrice(
          carApiIdentifier,
          selectedRange[0].toDate(),
          selectedRange[1].toDate(),
          resolveDefaultInsurance(car),
          0,
          {
            signal,
            placeIn: pickupForPricing,
            placeOut: returnForPricing,
          }
        );
        if (!isCurrent?.()) return;

        if (result?.ok !== false && Number(result?.totalPrice) > 0) {
          setTotalPrice(result.totalPrice);
          setPriceIsApproximate(spainDeliveryMayVary);
        } else if (clientEstimate?.totalPrice > 0) {
          setTotalPrice(clientEstimate.totalPrice);
          setPriceIsApproximate(true);
        } else {
          setTotalPrice(0);
          setPriceIsApproximate(false);
        }
      } catch (error) {
        if (!isCurrent?.()) return;
        if (error?.name === "AbortError") {
          if (clientEstimate?.totalPrice > 0) {
            setTotalPrice(clientEstimate.totalPrice);
            setPriceIsApproximate(true);
          }
          return;
        }
        if (clientEstimate?.totalPrice > 0) {
          setTotalPrice(clientEstimate.totalPrice);
          setPriceIsApproximate(true);
        } else {
          setTotalPrice(0);
          setPriceIsApproximate(false);
        }
      } finally {
        if (isCurrent?.()) {
          setCalcLoading(false);
        }
      }
    },
    [
      carApiIdentifier,
      selectedRange,
      estimateClientTotal,
      pickupForPricing,
      returnForPricing,
      spainDeliveryMayVary,
      car,
    ]
  );

  useEffect(() => {
    if (!(showBookButton && selectedRange[0] && selectedRange[1])) {
      setTotalPrice(0);
      setPriceIsApproximate(false);
      setCalcLoading(false);
      if (onPriceCalculated) {
        onPriceCalculated(null);
      }
      return;
    }

    let current = true;
    const abort = new AbortController();
    const timeoutId = setTimeout(() => abort.abort(), 10000);
    fetchTotalPrice({
      signal: abort.signal,
      isCurrent: () => current,
    });

    return () => {
      current = false;
      clearTimeout(timeoutId);
      abort.abort();
    };
  }, [showBookButton, selectedRange, fetchTotalPrice, onPriceCalculated]);

  // Передаем просчитанную цену родителю
  useEffect(() => {
    if (onPriceCalculated && totalPrice > 0 && !calcLoading && selectedRange[0] && selectedRange[1]) {
      const days = getBusinessRentalDaysByMinutes(
        selectedRange[0],
        selectedRange[1],
        calendarTz
      );
      onPriceCalculated({ totalPrice, days, approximate: priceIsApproximate });
    }
  }, [
    totalPrice,
    calcLoading,
    selectedRange,
    onPriceCalculated,
    calendarTz,
    priceIsApproximate,
  ]);

  // After a complete range, bring the Book CTA (dates + total) into view.
  // Skip the first click: showBookButton stays false until the end date is set.
  // Wait until the CTA has a real box — it was display:none, and scrollIntoView
  // on a 0×0 node jumps the page to the top instead of the price.
  useEffect(() => {
    if (!showBookButton || embedded) return;

    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const tryScroll = () => {
      if (cancelled) return;
      const button = bookButtonRef.current;
      const rect = button?.getBoundingClientRect();
      if (!rect || rect.width < 1 || rect.height < 1) {
        if (attempts++ < 16) {
          frame = requestAnimationFrame(tryScroll);
        }
        return;
      }
      button.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    };

    frame = requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [showBookButton, embedded]);

  // Modified onSelect to handle double clicks
  // const onSelect = (date) => {
  //   const now = Date.now();
  //   const timeSinceLastClick = now - lastClickTimeRef.current;

  //   // Reset click count if it's been too long since the last click
  //   if (timeSinceLastClick > 300) {
  //     clickCountRef.current = 0;
  //   }

  //   clickCountRef.current += 1;
  //   lastClickTimeRef.current = now;

  //   // Handle double click
  //   if (clickCountRef.current === 2 && timeSinceLastClick < 300) {
  //     handleClearSelection();
  //     clickCountRef.current = 0;
  //     return;
  //   }

  //   // Regular single click handling
  //   const [start, end] = selectedRange;
  //   const dateStr = date.format("YYYY-MM-DD");

  //   if (!date.isSame(currentDate, "month")) {
  //     setCurrentDate(date.startOf("month"));
  //   }

  //   if (!start || (start && end)) {
  //     setSelectedRange([date, null]);
  //     setShowBookButton(false);
  //   } else {
  //     if (date.isBefore(start)) {
  //       setSelectedRange([date, null]);
  //       setShowBookButton(false);
  //     } else if (date.isSame(start, "day")) {
  //       setSelectedRange([start, null]);
  //       setShowBookButton(false);
  //     } else {
  //       const range = [start, date];
  //       const startStr = range[0];
  //       const endStr = range[1];
  //       setSelectedRange(range);

  //       const {
  //         availableStart,
  //         availableEnd,
  //         hourStart,
  //         minuteStart,
  //         hourEnd,
  //         minuteEnd,
  //       } = calculateAvailableTimes(startEndDates, startStr, endStr);

  //       setSelectedTimes({
  //         start: availableStart,
  //         end: availableEnd,
  //       });
  //       setBookedDates({
  //         start: dayjs.utc(range[0].hour(hourStart).minute(minuteStart)),
  //         end: dayjs.utc(range[1].hour(hourEnd).minute(minuteEnd)),
  //       });
  //       setShowBookButton(true);
  //     }
  //   }
  // };

  // Add a clear selection handler
  const updateSelectedTimes = (value) => {
    if (typeof setSelectedTimes === "function") setSelectedTimes(value);
  };

  const handleClearSelection = () => {
    setSelectedRange([null, null]);
    setShowBookButton(false);
    updateSelectedTimes({ start: null, end: null });
    setBookedDates({ start: null, end: null });
    if (typeof onSelectionCleared === "function") onSelectionCleared();
  };

  useEffect(() => {
    // функция которая возвращает 4 массива дат для удобного рендеринга клиентского календаря
    const { unavailable, confirmed, startEnd, transformedStartEndOverlap } =
      extractArraysOfStartEndConfPending(orders);
    // задаем єти 4 массива в стейт
    setStartEndOverlapDates(transformedStartEndOverlap);
    setUnavailableDates(unavailable);
    setConfirmedDates(confirmed);
    setStartEndDates(startEnd);

  }, [orders, carId]);

  // Apply catalog date-search range onto this car's calendar (all available cars).
  const appliedPresetKeyRef = useRef("");
  useEffect(() => {
    const startKey = presetSearchDates?.start
      ? dayjs(presetSearchDates.start).format("YYYY-MM-DD")
      : null;
    const endKey = presetSearchDates?.end
      ? dayjs(presetSearchDates.end).format("YYYY-MM-DD")
      : null;
    const presetKey = startKey && endKey ? `${startKey}|${endKey}` : "";

    if (!presetKey) {
      if (appliedPresetKeyRef.current) {
        appliedPresetKeyRef.current = "";
        setShowBookButton(false);
        setBookedDates({ start: null, end: null });
        // Keep a start the user just picked. Clearing here would wipe that
        // click when the parent drops the previous committed range.
        setSelectedRange((current) => {
          const [start, end] = current || [];
          if (start && !end) return current;
          return [null, null];
        });
      }
      return;
    }

    if (appliedPresetKeyRef.current === presetKey) return;
    appliedPresetKeyRef.current = presetKey;

    const start = dayjs.tz(startKey, "YYYY-MM-DD", calendarTz).startOf("day");
    const end = dayjs.tz(endKey, "YYYY-MM-DD", calendarTz).startOf("day");
    if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
      return;
    }

    setSelectedRange([start, end]);
    setCurrentDate(start);
    setBookedDates({ start, end });
    if (!embedded) setShowBookButton(true);
  }, [
    presetSearchDates?.start,
    presetSearchDates?.end,
    carId,
    calendarTz,
    setBookedDates,
    embedded,
  ]);

  // ДОБАВИТЬ ЭТОТ useEffect ЗДЕСЬ:
  useEffect(() => {
    //console.log("Текущий месяц:", currentDate.format("MMMM YYYY"));

    if (onCurrentDateChange) {
      onCurrentDateChange(currentDate);
    }
    // Сброс накопленных логов при смене текущего месяца
    loggedCellsRef.current.clear();
  }, [currentDate, onCurrentDateChange]);

  // Также сбрасываем накопленные логи при изменении источников дат
  useEffect(() => {
    loggedCellsRef.current.clear();
  }, [confirmedDates, unavailableDates, startEndDates, startEndOverlapDates]);

  const renderDateCell = (date) => {
    // выбранные даты
    const [start, end] = selectedRange;
    const isSelected =
      (date >= start && date <= end) ||
      date.isSame(start, "day") ||
      date.isSame(end, "day");
    // текущая дата вокруг которой будет рендер и которая будет сравниваться
    const dateStr = date.format("YYYY-MM-DD");

    const isDisabled = disabledDate(date);

    // If the date is disabled, return it with no styles (transparent background)
    if (isDisabled) {
      return (
        <Box
          sx={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {date.date()}
        </Box>
      );
    }

    // проверяем подтвержденная ли єто дата
    const isConfirmed = confirmedDates?.includes(dateStr);
    // проверяем ожидающая ли єто дата (еще не подтвердженная)
    const isUnavailable = unavailableDates?.includes(dateStr);
    // проверяем начальная или конечная ли єто дата
    const startEndInfo = startEndDates.find((d) => d.date === dateStr);
    // проверяем начальная ли єто дата
    const isStartDate = startEndInfo?.type === "start";
    // проверяем конечная ли єто дата
    const isEndDate = startEndInfo?.type === "end";

    // проверяем чтобы эта дата не была одновременно начальной и конечной для разных броинрований
    const isStartAndEndDateOverlapInfo = startEndOverlapDates?.find(
      (dateObj) => dateObj.date === dateStr
    );
    // если предыдущая функция нашла что-то, то эта вернет тру, и если нет таких дат, которые начальные и конечные тогда это будет фолс
    const isStartAndEndDateOverlap = Boolean(isStartAndEndDateOverlapInfo);

    // тест в консоли для конкретной машины
    // if (carId === "670bb226223dd911f0595287" && isStartAndEndDateOverlap) {
    //   console.log("isStartAndEndDateOverlapInfo", isStartAndEndDateOverlapInfo);
    // }

    // ДАЛЬШЕ КОД ВНЕДРЯЕТ СТИЛИ для каждого типа

    const getTooltipMessage = () => {
      if (isConfirmed) return t("order.unavailableDate");
      if (isUnavailable) return t("order.not100Date");
      if (isStartDate && startEndInfo.type == "confirmed")
        return t("order.returnAfterTime", { time: startEndInfo.time });
      if (isEndDate && startEndInfo.type == "confirmed")
        return t("order.availableAfterTime", { time: startEndInfo.time });
      return null;
    };

    const tooltipMessage = getTooltipMessage();

    // здесь задаем базовые значения для - бекграунд цвета ячейки, цвета таекста, рамки, радиуса рамки
    // Rest of your existing conditions
    let backgroundColor = "transparent";
    let color = "inherit";
    let border = "1px solid grey";
    let borderRadius;

    // Общие стили
    const baseStyles = {
      height: "100%",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    //если мы тыкаем в ячейку то все предыдущие стили переписываются
    // If selected, these styles will override everything else
    if (isSelected) {
      return (
        <Box
          sx={{
            ...baseStyles,
            backgroundColor: "secondary.main", // Бирюзовый из темы
            color: "#ffffff",
            borderRadius: "4px",
            fontWeight: "bold",
            boxShadow: "0 2px 8px rgba(0, 137, 137, 0.4)",
          }}
        >
          {date.date()}
        </Box>
      );
    }

    if (
      isConfirmed ||
      isStartAndEndDateOverlapInfo?.endConfirmed ||
      isStartAndEndDateOverlapInfo?.startConfirmed
    ) {
      backgroundColor = "primary.main";
      color = "common.white";
    } else if (
      isUnavailable ||
      isStartAndEndDateOverlapInfo?.endPending ||
      isStartAndEndDateOverlapInfo?.startPending
    ) {
      backgroundColor = "neutral.gray200"; // Ожидающие заказы - очень светло-серый
      color = "text.primary";
    }

    if (isConfirmed || isUnavailable) {
      return (
        <Tooltip title={tooltipMessage || ""} placement="top" arrow>
          <Box
            sx={{
              ...baseStyles,
              backgroundColor,
              borderRadius: "1px",
              color,
              border,
            }}
          >
            {date.date()}
          </Box>
        </Tooltip>
      );
    }

    if (isStartDate && !isEndDate && !isStartAndEndDateOverlap) {
      return (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            cursor: "pointer",
            border,
          }}
        >
          <Box
            sx={{
              width: "50%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {date.date()}
          </Box>

          <Tooltip title={tooltipMessage || ""} placement="top" arrow>
            <Box
              sx={{
                width: "50%",
                height: "100%",
                borderRadius: "50% 0 0 50%",
                backgroundColor: startEndInfo.confirmed
                  ? "primary.main"
                  : "neutral.gray200", // Ожидающие заказы - очень светло-серый
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: startEndInfo.confirmed ? "common.white" : "common.black",
              }}
            >
              {date.date()}
            </Box>
          </Tooltip>
        </Box>
      );
    }

    if (!isStartDate && isEndDate && !isStartAndEndDateOverlap) {
      return (
        <Box
          sx={{
            border,
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Tooltip title={tooltipMessage || ""} placement="top" arrow>
            <Box
              sx={{
                width: "50%",
                height: "100%",
                borderRadius: "0 50% 50% 0",
                backgroundColor: startEndInfo.confirmed
                  ? "primary.main"
                  : "neutral.gray200", // Ожидающие заказы - очень светло-серый
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: startEndInfo.confirmed ? "common.white" : "common.black",
              }}
            >
              {date.date()}
            </Box>
          </Tooltip>
          <Box
            sx={{
              width: "50%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {date.date()}
          </Box>
        </Box>
      );
    }

    // For overlapping start/end dates
    if (isStartAndEndDateOverlap) {
      return (
        <Box
          sx={{
            border: border,
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            cursor: "pointer",
          }}
        >
          {/* End Date Box - Left half */}
          <Box
            sx={{
              width: "50%",
              height: "100%",
              backgroundColor: isStartAndEndDateOverlapInfo.endConfirmed
                ? "primary.main"
                : "neutral.gray200", // Ожидающие заказы - очень светло-серый
              borderRadius: "0 50% 50% 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isStartAndEndDateOverlapInfo.endConfirmed
                ? "common.white"
                : "common.white",
            }}
          >
            {date.date()}
          </Box>

          {/* Start Date Box - Right half */}
          <Box
            sx={{
              width: "50%",
              height: "100%",
              backgroundColor: isStartAndEndDateOverlapInfo.startConfirmed
                ? "primary.main"
                : "neutral.gray200", // Ожидающие заказы - очень светло-серый
              borderRadius: "0 50% 50% 0",
              borderRadius: "50% 0 0 50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isStartAndEndDateOverlapInfo.startConfirmed
                ? "common.white"
                : "common.white",
            }}
          >
            {date.date()}
          </Box>
        </Box>
      );
    }
    //если ничего из меречисленного не работает то рендерить прозрачно
    //const { t } = useTranslation();
    return (
      <Box
        sx={{
          ...baseStyles,
          backgroundColor,
          borderRadius,
          color,
          border,
        }}
      >
        {date.date()}
      </Box>
    );
  };

  const handleBooking = () => {
    const [start, end] = selectedRange;
    const selection =
      start && end
        ? { start, end }
        : null;
    // Pass the latest calendar selection explicitly so Book never races
    // parent bookDates state (which previously opened BookingModal with nulls → Invalid Date).
    if (typeof onBookingComplete === "function") {
      onBookingComplete(selection);
    }
    startTransition(() => {
      setShowBookButton(false);
    });
  };

  const onSelect = (date) => {
    if (embedded && !userPickedRef.current) return;
    // --- ДОБАВЛЕНЫ ПРОВЕРКИ ДЛЯ ЗАПРЕТА КЛИКА ПО ПОДТВЕРЖДЁННЫМ ДАТАМ ---
    const dateStr = date.format("YYYY-MM-DD");
    const isConfirmed = confirmedDates?.includes(dateStr);
    const [start, end] = selectedRange;
    // 1. Если дата подтверждённая — просто выйти
    // 1. Если дата подтверждённая — показать снэк и выйти
    if (isConfirmed) {
      // if (onDateChange) {
      //   onDateChange({ type: "error", message: t("order.unavailableDate") });
      // }
      return;
    }
    // 2. Первый клик: если дата — начало подтверждённого заказа
    // 1.1. Первый клик: если дата одновременно confirmed start и confirmed end
    if (
      (!start || (start && end)) &&
      startEndDates.some(
        (d) => d.date === dateStr && d.type === "start" && d.confirmed
      ) &&
      startEndDates.some(
        (d) => d.date === dateStr && d.type === "end" && d.confirmed
      )
    ) {
      // if (onDateChange) {
      //   onDateChange({ type: "error", message: t("order.unavailableDate") });
      // }
      return;
    }
    if (
      (!start || (start && end)) &&
      startEndDates.some(
        (d) => d.date === dateStr && d.type === "start" && d.confirmed
      )
    ) {
      // if (onDateChange) {
      //   onDateChange({ type: "error", message: t("order.unavailableDate") });
      // }
      return;
    }
    // 3. Второй клик: если дата — конец подтверждённого заказа
    if (
      start &&
      !end &&
      startEndDates.some(
        (d) => d.date === dateStr && d.type === "end" && d.confirmed
      )
    ) {
      // if (onDateChange) {
      //   onDateChange({ type: "error", message: t("order.unavailableDate") });
      // }
      return;
    }
    // 4. Второй клик: если в диапазоне есть подтверждённые даты
    // 2. Второй клик: если в выбранном диапазоне есть подтверждённые даты
    if (start && !end && date.isAfter(start, "day")) {
      // Собираем все даты между start и date (включительно)
      const rangeDates = [];
      let cur = start.clone();
      while (cur.isSameOrBefore(date, "day")) {
        rangeDates.push(cur.format("YYYY-MM-DD"));
        cur = cur.add(1, "day");
      }
      const hasConfirmedInRange = rangeDates.some((d) =>
        confirmedDates.includes(d)
      );
      if (hasConfirmedInRange) {
        setSelectedRange([start, null]);
        setShowBookButton(false);
        if (typeof onUnavailableRange === "function") {
          onUnavailableRange();
        } else if (onDateChange) {
          onDateChange({
            type: "error",
            message: t("order.unavailableDates", {
              defaultValue: "Not available for these dates",
            }),
          });
        }
        return;
      }
    }
    // if (start && !end && date.isAfter(start, "day")) {
    //   // Собираем все даты между start и date (включительно)
    //   const rangeDates = [];
    //   let cur = start.clone();
    //   while (cur.isSameOrBefore(date, "day")) {
    //     rangeDates.push(cur.format("YYYY-MM-DD"));
    //     cur = cur.add(1, "day");
    //   }
    //   const hasConfirmedInRange = rangeDates.some((d) =>
    //     confirmedDates.includes(d)
    //   );
    //   if (hasConfirmedInRange) {
    //     // Можно заменить на ваш snackbar
    //     if (onDateChange) {
    //       onDateChange({
    //         type: "error",
    //         message: "В выбранном диапазоне есть занятые даты!",
    //       });
    //     }
    //     // if (typeof window !== "undefined") {
    //     //   window.alert && window.alert("В выбранном диапазоне есть занятые даты!");
    //     // }
    //     return;
    //   }
    // }
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;

    // Reset click count if it's been too long since the last click
    if (timeSinceLastClick > 300) {
      clickCountRef.current = 0;
    }

    clickCountRef.current += 1;
    lastClickTimeRef.current = now;

    // Handle double click. Embedded calendars ignore this: Ant Design also
    // emits onSelect while mounting, which was clearing the shared search dates.
    if (clickCountRef.current === 2 && timeSinceLastClick < 300 && !embedded) {
      handleClearSelection();
      clickCountRef.current = 0;
      return;
    }

    if (!date.isSame(currentDate, "month")) {
      setCurrentDate(date.startOf("month"));
    }

    if (!start || (start && end)) {
      // First click or resetting the range. Drop any committed price so an
      // incomplete selection cannot keep the previous BOOK! button.
      setSelectedRange([date, null]);
      setShowBookButton(false);
      if (start && end && typeof onSelectionCleared === "function") {
        onSelectionCleared();
      }
      // После первого клика или любого сброса диапазона показать снэк
      // if (onDateChange) {
      //   onDateChange({ type: "info", message: t("order.enterEndDate") });
      // }
    } else {
      if (date.isBefore(start)) {
        // If the second date is before the first, make it the new start
        setSelectedRange([date, null]);
        setShowBookButton(false);
        if (typeof onSelectionCleared === "function") onSelectionCleared();
        // if (onDateChange) {
        //   onDateChange({ type: "info", message: t("order.enterEndDate") });
        // }
      } else if (date.isSame(start, "day")) {
        // Повторный клик по дате начала: отменяем выбор и ждём новый первый клик
        setSelectedRange([null, null]);
        setShowBookButton(false);
        updateSelectedTimes({ start: null, end: null });
        setBookedDates({ start: null, end: null });
        if (typeof onSelectionCleared === "function") onSelectionCleared();
        // if (onDateChange) {
        //   onDateChange({ type: "info", message: t("order.chooseStartDate") });
        // }
      } else {
        // Regular behavior: set range with start and end dates
        const range = [start, date];
        const startStr = range[0];
        const endStr = range[1];
        setSelectedRange(range);

        const {
          availableStart,
          availableEnd,
          hourStart,
          minuteStart,
          hourEnd,
          minuteEnd,
        } = calculateAvailableTimes(startEndDates, startStr, endStr);

        // отдельно время забора и отдачи хранится в стринге "hh:mm"
        updateSelectedTimes({
          start: availableStart,
          end: availableEnd,
        });
        setBookedDates({
          // FIX: убран преждевременный перевод в UTC, храним локальные (Europe/Athens) даты
          start: range[0].hour(hourStart).minute(minuteStart),
          end: range[1].hour(hourEnd).minute(minuteEnd),
        });
        if (typeof onRangeCommitted === "function") {
          onRangeCommitted({
            start: range[0].format("YYYY-MM-DD"),
            end: range[1].format("YYYY-MM-DD"),
          });
        }
        if (!embedded) setShowBookButton(true);
      }
    }
  };

  const disabledDate = (current) => {
    const dateStr = current.format("YYYY-MM-DD");

    // Проверяем, является ли дата началом или концом существующего бронирования
    const isStartOrEnd = startEndDates.some((d) => d.date === dateStr);
    const isConfirmed = confirmedDates?.includes(dateStr);
    // Проверяем, есть ли пересечения бронирований
    // const hasOverlappingBookings =
    //   orders.filter((order) => {
    //     const start = dayjs(order.rentalStartDate);
    //     const end = dayjs(order.rentalEndDate);
    //     return current.isBetween(start, end, "day", "[]");
    //   }).length > 1;
    return current.isBefore(dayjs().startOf("day"));
  };

  const headerRender = ({ value }) => {
    const current = value.clone();
    // Получаем текущий язык из i18n
    // Локализуем название месяца и делаем первую букву заглавной
    let month = current.locale(dayjsLang).format("MMMM");
    month = month.charAt(0).toUpperCase() + month.slice(1);
    const year = current.year();

    // const goToNextMonth = () => {
    //   setCurrentDate((prev) => prev.add(1, "month"));
    // };

    // const goToPreviousMonth = () => {
    //   setCurrentDate((prev) => prev.subtract(1, "month"));
    // };
    // В headerRender обновите функции навигации:
    const goToNextMonth = () => {
      setCurrentDate((prev) => prev.add(1, "month"));
    };

    const goToPreviousMonth = () => {
      setCurrentDate((prev) => prev.subtract(1, "month"));
    };

    return (
      <Box
        sx={{
          padding: isPortraitPhone ? 0.5 : 1,
          display: "flex",
          color: "common.black",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <IconButton onClick={goToPreviousMonth} color="inherit">
          <ArrowBackIosNewIcon />
        </IconButton>
        <Typography variant="h6" sx={{ margin: 0 }}>
          {`${month} ${year}`}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {selectedRange[0] && !embedded && (
            <IconButton
              onClick={handleClearSelection}
              color="inherit"
              size="small"
              aria-label="Clear dates"
              sx={{
                backgroundColor: "rgba(0,0,0,0.05)",
                "&:hover": { backgroundColor: "rgba(0,0,0,0.1)" },
              }}
            >
              <ClearIcon />
            </IconButton>
          )}
          <IconButton onClick={goToNextMonth} color="inherit">
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>
        {/* <IconButton onClick={goToNextMonth} color="inherit">
          <ArrowForwardIosIcon />
        </IconButton> */}
      </Box>
    );
  };

  // Проверяем, действует ли скидка в текущем месяце
  let showDiscountInfo = false;
  let discountText = "";
  if (
    discount > 0 &&
    discountStart &&
    discountEnd &&
    dayjs(currentDate)
      .endOf("month")
      .isSameOrAfter(dayjs(discountStart), "day") &&
    dayjs(currentDate)
      .startOf("month")
      .isSameOrBefore(dayjs(discountEnd), "day")
  ) {
    showDiscountInfo = true;
    //   discountText = `Скидка ${discount}% с ${dayjs(discountStart).format(
    //     "DD.MM.YYYY"
    //   )} по ${dayjs(discountEnd).format("DD.MM.YYYY")}`;
    // }

    discountText =
      t("order.discount") +
      ` ${discount}% ` +
      t("basic.from") +
      `${dayjs(discountStart).format("DD.MM")} ` +
      t("basic.to") +
      `${dayjs(discountEnd).format("DD.MM")} `;
  }
  // compute header spacing depending on device
  const headerSx = {
    lineHeight: isPortraitPhone ? "1.15rem" : "1.3rem",
    letterSpacing: "0.02em",
    wordSpacing: "0.18em",
    fontSize: isPortraitPhone ? "0.95rem" : { xs: "1rem", sm: "1.1rem" },
    textTransform: "uppercase",
    whiteSpace: "normal",
    overflowWrap: "break-word",
    wordBreak: "normal",
    maxWidth: "100%",
    marginBottom: showDiscountInfo
      ? isPortraitPhone
        ? "4px"
        : isSmallLandscape
          ? "6px"
          : "8px"
      : isPortraitPhone
        ? "6px"
        : isSmallLandscape
          ? "12px"
          : "20px",
    marginTop: isSmallLandscape ? "4px" : isPortraitPhone ? "2px" : undefined,
    color: "primary.main",
  };

  return (
    <Box
      // Capture phase: Ant Design calls onSelect from the cell during pointerdown,
      // before this wrapper would see a bubble-phase pointerdown.
      onPointerDownCapture={() => {
        userPickedRef.current = true;
      }}
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        p: isPortraitPhone
          ? "4px 6px 6px"
          : { xs: "10px 10px 10px 10px", sm: "10px 10px 10px 10px" },
        // Ant Design mini-calendar uses fixed cell floors; force fluid Su–Sa fit.
        "& .ant-picker-calendar": {
          width: "100%",
          maxWidth: "100%",
          ...(isPortraitPhone ? { paddingInline: 4 } : null),
        },
        "& .ant-picker-panel": {
          width: "100% !important",
          maxWidth: "100%",
        },
        "& .ant-picker-date-panel": {
          width: "100% !important",
          maxWidth: "100%",
        },
        "& .ant-picker-body": {
          paddingInline: isPortraitPhone ? 2 : 4,
        },
        "& .ant-picker-content": {
          width: "100% !important",
          tableLayout: "fixed",
        },
        "& .ant-picker-content th, & .ant-picker-content td": {
          minWidth: 0,
          width: "14.2857%",
          padding: "1px 0",
        },
        "& .ant-picker-content thead > tr > th": {
          paddingBlock: isPortraitPhone ? "2px" : "4px",
          overflow: "hidden",
          textOverflow: "clip",
        },
        "& .ant-picker-content tbody .ant-picker-cell": {
          padding: "1px 0",
        },
        "& .ant-picker-cell .ant-picker-cell-inner": {
          minWidth: 0,
          width: "100%",
          maxWidth: "100%",
          ...(isPortraitPhone
            ? { minHeight: "22px", lineHeight: "22px" }
            : null),
        },
      }}
    >
      {" "}
      {/* Уменьшили верхний padding */}
      {embedded ? null : (
      <Typography variant="h6" sx={headerSx}>
        {t("order.chooseDates")}
      </Typography>
      )}
      {/* {showDiscountInfo && (
        <Typography
          variant="body2"
          sx={{ color: "error.main", fontWeight: 600, mb: 2 }}
        >
          {discountText}
        </Typography>
      )} */}
      {/* Убран CircularProgress для isLoading:
          - isLoading = background refresh заказов из Context
          - Не должен блокировать UI — календарь остаётся функциональным
          - Данные обновятся автоматически после refresh */}
            <Box
              sx={{
          display: !embedded && showBookButton ? "flex" : "none",
                justifyContent: "center",
                mb: isPortraitPhone ? 1 : 2,
                mt: isPortraitPhone ? 0.5 : 1,
              }}
            >
              <GradientBookButton
                ref={bookButtonRef}
                onClick={handleBooking}
                sx={{
                  fontSize: "1.2rem",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    whiteSpace: "pre-line",
                  }}
                >
                  <Box component="span">
                    {selectedRange[0]?.isValid?.() && selectedRange[1]?.isValid?.()
                      ? `${t("order.bookShort")}\n${selectedRange[0]
                          .locale(dayjsLang)
                          .format("DD MMM")
                          .replace(/\./g, "")} - ${selectedRange[1]
                          .locale(dayjsLang)
                          .format("DD MMM")
                          .replace(/\./g, "")}`
                      : t("order.bookShort")}
                  </Box>
                  {calcLoading && !(totalPrice > 0) ? (
                    <Box
                      sx={{
                        display: "inline-flex",
                        gap: 0.3,
                        alignItems: "center",
                        "& span": {
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          display: "inline-block",
                          animation: "dotPulse 1.4s ease-in-out infinite",
                          "&:nth-of-type(1)": {
                            animationDelay: "0s",
                          },
                          "&:nth-of-type(2)": {
                            animationDelay: "0.2s",
                          },
                          "&:nth-of-type(3)": {
                            animationDelay: "0.4s",
                          },
                          "@keyframes dotPulse": {
                            "0%, 60%, 100%": {
                              opacity: 0.3,
                              transform: "scale(0.8)",
                            },
                            "30%": {
                              opacity: 1,
                              transform: "scale(1.2)",
                            },
                          },
                        },
                      }}
                    >
                      <Box component="span" />
                      <Box component="span" />
                      <Box component="span" />
                    </Box>
                  ) : totalPrice > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.15,
                        lineHeight: 1.15,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 0.5,
                        }}
                      >
                        {priceIsApproximate ? (
                          <Box
                            component="span"
                            sx={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              letterSpacing: "0.02em",
                              textTransform: "uppercase",
                              opacity: 0.9,
                            }}
                          >
                            {t("catalog.bookPriceApprox")}
                          </Box>
                        ) : null}
                        <Box
                          component="span"
                          sx={{
                            fontSize: "1.15rem",
                            fontWeight: 800,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {`${totalPrice}€`}
                        </Box>
                      </Box>
                    </Box>
                  ) : null}
                </Box>
              </GradientBookButton>
            </Box>

          <ConfigProvider locale={antdLocale}>
          <Calendar
            fullscreen={false}
            onSelect={onSelect}
            fullCellRender={renderDateCell}
            headerRender={headerRender}
            value={currentDate}
            disabledDate={disabledDate}
          />
          </ConfigProvider>
    </Box>
  );
};

export default CalendarPicker;
