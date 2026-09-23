import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  IconButton,
  Grow,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  ConfirmButton,
  CancelButton,
  BookingDateField,
  BookingTimeField,
  BookingTextField,
  BookingLocationAutocomplete,
  BookingAddressPlacesField,
  BookingFlightField,
} from "../ui";
import BookingContactSection from "@/app/components/orders/BookingContactSection";
import { useTranslation } from "react-i18next";
import { addOrderNew } from "@utils/action";
import SuccessMessage from "@/app/components/ui/feedback/SuccessMessage";
import { setTimeToDatejs, formatValidBookingDate, isValidBookingDateValue } from "@/domain/calendar";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useMainContext } from "../../Context";
import { useSnackbar } from "notistack";
import { calculateTotalPrice } from "@utils/action";
import { getSecondDriverPriceLabelValue } from "@utils/secondDriverPricing";
// 🎯 Athens timezone utilities — ЕДИНСТВЕННЫЙ источник правды для времени
import {
  toServerUTC,
  fromServerUTC,
  formatTimeHHMM,
  generateOrderNumber,
} from "@/domain/time/athensTime";
import { createBusinessDateTime } from "@/domain/time/businessInstant";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import {
  DEFAULT_BOOKING_LOCATION,
  LOCATION_DIVIDER_BEFORE,
  SELECTED_LOCATION_STORAGE_KEY,
  SELECTED_RETURN_LOCATION_STORAGE_KEY,
  normalizeBookingTimeHm,
} from "@/domain/orders/locationOptions";
import {
  isAllowedBookingLocation,
  canonicalizeBookingLocation,
  resolveBookingLocationOrDefault,
} from "@/domain/platform/bookingLocations";
import { useCompanyBookingLocations } from "@/app/hooks/useCompanyBookingLocations";
import { getSiteCountryCode } from "@config/siteCountry";
import {
  isSpainBookingSite,
  resolveCatalogDefaultPlace,
  resolveCatalogPlaceOptions,
  resolvePlaceRequiresAddressDetail,
} from "@/domain/orders/catalogPlaceOptions";
import { normalizeDeliveryPricingLocation } from "@/domain/orders/bookingPricingOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";
import {
  buildBookingPriceSummary,
  createEmptyBookingPriceSummary,
} from "@/domain/orders/bookingPriceSummary";
import { buildDeliveryHelperText } from "@/domain/orders/bookingDeliveryPresentation";
import {
  buildBookingPlaceOptionsWithOffices,
  findCarOfficeForPlace,
  isPlaceMatchingCarOffice,
  resolveBookingDisplayOffices,
  resolveOfficeFormAddress,
} from "@/domain/orders/carOffices";
import BookingOfficeDeliveryChoice from "./BookingOfficeDeliveryChoice";
import BookingContractsBlock from "./BookingContractsBlock";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import { parseRequiredCustomerEmail } from "@/domain/validation/customerEmail";
import { reportGoogleAdsPurchaseFromOrder } from "@/domain/analytics/googleAdsConversion";
import {
  formatMarketplaceEuro,
  marketplaceFeeNotice,
  marketplaceFinancialSplitFromMajor,
  marketplaceSplitLabels,
} from "@/domain/orders/marketplaceFinancialSplit";
import { resolveMarketplaceBookingFeeBps } from "@/domain/orders/marketplaceBookingFee";
import "@/styles/animations.css";

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
// DEBUG: ограничение логов по машине и дате (YYYY-MM-DD)
// Пример: const DEBUG_CAR_ID = "670bb226223dd911f0595286"; const DEBUG_DATE = "2025-11-30";
const DEBUG_CAR_ID = null;
const DEBUG_DATE = null;

function formatEuroAmount(value, locale) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  const roundedValue = Math.round(numericValue * 100) / 100;
  return new Intl.NumberFormat(locale || undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(roundedValue);
}

/** Soft fade + scale for booking dialog open/close (~280ms enter). */
const BookingDialogTransition = React.forwardRef(
  function BookingDialogTransition(props, ref) {
    return <Grow ref={ref} {...props} />;
  }
);

const BOOKING_DIALOG_TRANSITION = {
  enter: 280,
  exit: 200,
};

const BookingModal = ({
  open,
  onClose,
  onExited,
  car,
  presetDates = null,
  fetchAndUpdateOrders,
  isLoading,
  selectedTimes,
  initialPrice = null, // Просчитанная цена из календаря
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [daysAndTotal, setDaysAndTotal] = useState(() =>
    createEmptyBookingPriceSummary()
  );
  const [calcLoading, setCalcLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const secondDriverPriceLabelValue = getSecondDriverPriceLabelValue();
  const {
    company,
    companyLoading,
    companyError,
    lang,
    platform,
    bookingTimeIn,
    bookingTimeOut,
  } = useMainContext();
  const TIME_ZONE = resolveBusinessTimezone({
    company,
    countryCode: company?.country || platform?.country,
    platformSettings: platform,
    forNewOrder: true,
  });
  const {
    names: companyPlaceOptions,
    defaultName: companyDefaultBookingLocation,
    requiresDetail: companyRequiresDetail,
    isAirport,
  } = useCompanyBookingLocations(car?.ownerId || company?._id);
  const siteCountry = getSiteCountryCode();
  const spainSite = isSpainBookingSite(siteCountry);
  const marketplaceFee = useMemo(
    () =>
      resolveMarketplaceBookingFeeBps({
        marketplaceBookingFeeBps:
          car?.marketplaceBookingFeeBps ?? company?.marketplaceBookingFeeBps,
      }),
    [car?.marketplaceBookingFeeBps, company?.marketplaceBookingFeeBps]
  );
  const marketplaceSplit = useMemo(() => {
    if (!spainSite) return null;
    return marketplaceFinancialSplitFromMajor(
      daysAndTotal.totalPrice,
      "EUR",
      { feeBps: marketplaceFee.bps }
    );
  }, [spainSite, daysAndTotal.totalPrice, marketplaceFee.bps]);
  const marketplaceLabels = marketplaceSplitLabels(i18n?.language);
  const catalogPlaceNames = useMemo(
    () => resolveCatalogPlaceOptions(companyPlaceOptions, siteCountry),
    [companyPlaceOptions, siteCountry]
  );
  const officeFreeNote = t("order.officeDeliveryFreeShort");
  const defaultBookingLocation = resolveCatalogDefaultPlace(
    companyDefaultBookingLocation,
    siteCountry
  );
  const displayOffices = useMemo(
    () =>
      resolveBookingDisplayOffices(car, company, {
        countryCode: siteCountry,
        selectedCity: defaultBookingLocation,
      }),
    [car, company, siteCountry, defaultBookingLocation]
  );
  const placeOptions = useMemo(
    () =>
      buildBookingPlaceOptionsWithOffices({
        cityNames: catalogPlaceNames,
        carOffices: displayOffices,
        company,
        freeNote: officeFreeNote,
      }),
    [catalogPlaceNames, displayOffices, company, officeFreeNote]
  );
  const placeOptionNames = useMemo(
    () =>
      placeOptions.map((opt) =>
        typeof opt === "string" ? opt : String(opt?.value || opt?.label || "")
      ),
    [placeOptions]
  );
  const requiresDetail = useCallback(
    (value) =>
      resolvePlaceRequiresAddressDetail(
        value,
        companyRequiresDetail,
        siteCountry
      ),
    [companyRequiresDetail, siteCountry]
  );
  const locationOutsideMsg =
    t(
      spainSite
        ? "order.spainLocationOutsideServiceArea"
        : "order.locationOutsideServiceArea"
    ) ||
    (spainSite
      ? "Choose a city from the list"
      : "Choose pickup and return from the list");
  const addressDetailRequiredMsg =
    t(
      spainSite
        ? "order.spainDetailRequired"
        : "order.thessalonikiDetailRequired"
    ) || "Enter hotel or full address (min. 3 characters).";
  const hotelOrAddressLabel =
    t(
      spainSite
        ? "order.spainHotelOrAddress"
        : "order.thessalonikiHotelOrAddress"
    ) || "Hotel or address";
  const locationDividerBefore = spainSite
    ? undefined
    : LOCATION_DIVIDER_BEFORE;
  // carId (_id) is always unique in MongoDB. Fallback: carNumber, regNumber.
  const carApiIdentifier = car?._id?.toString?.() || car?.carNumber || car?.regNumber || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [secondDriver, setSecondDriver] = useState(false);
  const [viber, setViber] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [telegram, setTelegram] = useState(false);
  const [childSeats, setChildSeats] = useState(0);
  const [insurance, setInsurance] = useState("");
  const [franchiseOrder, setFranchiseOrder] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [submittedOrder, setSubmittedOrder] = useState(null);

  const [startTime, setStartTime] = useState(() =>
    isValidBookingDateValue(presetDates?.startDate)
      ? setTimeToDatejs(presetDates.startDate, null, true)
      : null
  );
  const [endTime, setEndTime] = useState(() =>
    isValidBookingDateValue(presetDates?.endDate)
      ? setTimeToDatejs(presetDates.endDate, null)
      : null
  );
  const [timeLimits, setTimeLimits] = useState({
    minStart: null,
    maxEnd: null,
  });
  const [timeErrors, setTimeErrors] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const isAirportLocation = (loc) => isAirport(loc);
  const [placeIn, setPlaceIn] = useState("");
  const [placeOut, setPlaceOut] = useState("");
  const [placeInDetail, setPlaceInDetail] = useState("");
  const [placeOutDetail, setPlaceOutDetail] = useState("");
  const [placeInGeo, setPlaceInGeo] = useState(null);
  const [placeOutGeo, setPlaceOutGeo] = useState(null);
  const [pickupMethod, setPickupMethod] = useState("delivery");
  const [returnMethod, setReturnMethod] = useState("delivery");
  const [pickupOfficeId, setPickupOfficeId] = useState("");
  const [returnOfficeId, setReturnOfficeId] = useState("");
  const [pickupPlaceId, setPickupPlaceId] = useState("");
  const [returnPlaceId, setReturnPlaceId] = useState("");
  const [sameReturnLocation, setSameReturnLocation] = useState(true);
  const [locationQuote, setLocationQuote] = useState(null);
  const [flightNumber, setFlightNumber] = useState("");
  const [termsState, setTermsState] = useState({
    ready: false,
    payload: null,
    platformAccepted: false,
    companyAccepted: true,
    companyRequired: false,
  });

  const placeInIsOffice =
    pickupMethod === "office" ||
    isPlaceMatchingCarOffice(placeIn, displayOffices);
  const placeOutIsOffice =
    returnMethod === "office" ||
    isPlaceMatchingCarOffice(placeOut, displayOffices);

  const applyPlaceSelection = useCallback(
    (rawValue, which) => {
      const setPlace = which === "in" ? setPlaceIn : setPlaceOut;
      const setDetail = which === "in" ? setPlaceInDetail : setPlaceOutDetail;
      const setGeo = which === "in" ? setPlaceInGeo : setPlaceOutGeo;
      setGeo(null);

      if (rawValue == null || rawValue === "") {
        setPlace("");
        return;
      }
      if (typeof rawValue === "object") {
        const name = String(rawValue.value || rawValue.label || "").trim();
        setPlace(name);
        if (rawValue.kind === "office") {
          setDetail(resolveOfficeFormAddress(rawValue, company));
        }
        return;
      }
      const name = String(rawValue).trim();
      setPlace(name);
      const office = findCarOfficeForPlace(name, displayOffices);
      if (office) {
        const addr = resolveOfficeFormAddress(office, company);
        if (addr) setDetail(addr);
      }
    },
    [displayOffices, company]
  );

  const switchLegMethod = useCallback(
    (which, nextMethod, office) => {
      const setMethod = which === "in" ? setPickupMethod : setReturnMethod;
      setMethod(nextMethod);
      if (nextMethod === "office") {
        const target = office || displayOffices[0];
        if (target) {
          applyPlaceSelection(
            { value: target.name, kind: "office", address: target.address },
            which
          );
          const id = String(target.id || target._id || "");
          if (which === "in") setPickupOfficeId(id);
          else setReturnOfficeId(id);
        }
        return;
      }
      if (which === "in") {
        setPickupOfficeId("");
        setPickupPlaceId("");
      } else {
        setReturnOfficeId("");
        setReturnPlaceId("");
      }
      const fallback =
        defaultBookingLocation ||
        (spainSite ? "Barcelona" : DEFAULT_BOOKING_LOCATION);
      if (which === "in") {
        setPlaceIn(fallback);
        setPlaceInDetail("");
        setPlaceInGeo(null);
      } else {
        setPlaceOut(fallback);
        setPlaceOutDetail("");
        setPlaceOutGeo(null);
      }
    },
    [applyPlaceSelection, defaultBookingLocation, displayOffices, spainSite]
  );

  const formatOutsideHelper = useCallback(
    (geo) => {
      if (!geo) return "";
      if (geo.deliveryBlocked) {
        return t("order.addressBeyondServiceArea");
      }
      if (geo.explanation && geo.explanation.km > 0) {
        return t("order.addressOutsideCityBreakdown", {
          km: formatEuroAmount(geo.explanation.km, lang),
          city: geo.explanation.city || "",
          rate: formatEuroAmount(geo.explanation.perKm, lang),
          fee: formatEuroAmount(geo.deliveryFeeEstimate, lang),
        });
      }
      if (geo.outsideCity === true) {
        const fee = Number(geo.deliveryFeeEstimate);
        if (Number.isFinite(fee) && fee > 0) {
          return t("order.addressOutsideCityWithFee", {
            fee: formatEuroAmount(fee, lang),
          });
        }
        return t("order.addressOutsideCity");
      }
      return "";
    },
    [t, lang]
  );

  // Получение стоимости с сервера при изменении дат
  const fetchTotalPrice = useCallback(
    async (signal) => {
      if (
        !open ||
        !carApiIdentifier ||
        !presetDates?.startDate ||
        !presetDates?.endDate
      ) {
        setDaysAndTotal(createEmptyBookingPriceSummary());
        return;
      }
      const normalizedStartDate = dayjs(presetDates.startDate).tz(TIME_ZONE);
      const normalizedEndDate = dayjs(presetDates.endDate).tz(TIME_ZONE);
      if (!normalizedStartDate.isValid() || !normalizedEndDate.isValid()) {
        setDaysAndTotal(createEmptyBookingPriceSummary());
        return;
      }
      const normalizedPlaceIn = normalizeDeliveryPricingLocation(placeIn);
      const normalizedPlaceOut = normalizeDeliveryPricingLocation(placeOut);
      const timeInAthens =
        startTime && presetDates?.startDate
          ? createBusinessDateTime(
              dayjs(presetDates.startDate).tz(TIME_ZONE).format("YYYY-MM-DD"),
              formatTimeHHMM(dayjs(startTime)),
              TIME_ZONE
            )
          : null;
      const timeOutAthens =
        endTime && presetDates?.endDate
          ? createBusinessDateTime(
              dayjs(presetDates.endDate).tz(TIME_ZONE).format("YYYY-MM-DD"),
              formatTimeHHMM(dayjs(endTime)),
              TIME_ZONE
            )
          : null;
      const timeInServer = timeInAthens ? toServerUTC(timeInAthens) : undefined;
      const timeOutServer = timeOutAthens
        ? toServerUTC(timeOutAthens)
        : undefined;
      setCalcLoading(true);
      // Clear stale location quotes before refetch so a failed/partial response
      // cannot leave previous delivery fees on screen.
      setLocationQuote(null);
      try {
        const result = await calculateTotalPrice(
          carApiIdentifier,
          normalizedStartDate.format("YYYY-MM-DD"),
          normalizedEndDate.format("YYYY-MM-DD"),
          insurance,
          childSeats,
          {
            signal,
            secondDriver,
            timeIn: timeInServer,
            timeOut: timeOutServer,
            placeIn: normalizedPlaceIn,
            placeOut: normalizedPlaceOut,
            placeInDetail: String(placeInDetail || "").trim() || undefined,
            placeOutDetail: String(placeOutDetail || "").trim() || undefined,
            placeInLat: placeInGeo?.lat,
            placeInLon: placeInGeo?.lon,
            placeOutLat: placeOutGeo?.lat,
            placeOutLon: placeOutGeo?.lon,
            placeInLocality: placeInGeo?.locality,
            placeOutLocality: placeOutGeo?.locality,
          }
        );
        if (signal?.aborted) return;
        let summary = buildBookingPriceSummary(result);
        try {
          const quoteRes = await fetch("/api/public/delivery/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({
              carId: car?._id,
              language: lang,
              pickup: {
                kind: pickupMethod,
                officeId: pickupOfficeId,
                placeId: pickupPlaceId,
              },
              return: {
                kind: sameReturnLocation ? pickupMethod : returnMethod,
                officeId: sameReturnLocation ? pickupOfficeId : returnOfficeId,
                placeId: sameReturnLocation ? pickupPlaceId : returnPlaceId,
                sameAsPickup: sameReturnLocation,
              },
            }),
          });
          const quoteBody = await quoteRes.json().catch(() => ({}));
          if (quoteBody?.success && quoteBody.snapshot) {
            setLocationQuote(quoteBody);
            summary = {
              ...summary,
              pickupDeliveryCost: Number(quoteBody.deliveryIn) || 0,
              returnDeliveryCost: Number(quoteBody.deliveryOut) || 0,
              deliveryCost: Number(quoteBody.deliveryTotal) || 0,
              totalPrice:
                Number(summary.rentalPrice || 0) +
                (Number(quoteBody.deliveryTotal) || 0),
              deliveryStatus: "ready",
            };
          } else {
            setLocationQuote(quoteBody?.success === false ? quoteBody : null);
          }
        } catch (quoteErr) {
          if (quoteErr?.name === "AbortError" || signal?.aborted) return;
        }
        setDaysAndTotal(summary);
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) return;
        setDaysAndTotal(createEmptyBookingPriceSummary());
      } finally {
        if (!signal?.aborted) {
          setCalcLoading(false);
        }
      }
    },
    [
      open,
      carApiIdentifier,
      presetDates?.startDate,
      presetDates?.endDate,
      insurance,
      childSeats,
      secondDriver,
      startTime,
      endTime,
      placeIn,
      placeOut,
      placeInDetail,
      placeOutDetail,
      placeInGeo,
      placeOutGeo,
      pickupMethod,
      returnMethod,
      pickupOfficeId,
      returnOfficeId,
      pickupPlaceId,
      returnPlaceId,
      sameReturnLocation,
      car?._id,
      lang,
      TIME_ZONE,
    ]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchTotalPrice(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchTotalPrice]);

  useEffect(() => {
    if (
      pickupMethod !== "office" &&
      !requiresDetail(placeIn) &&
      !isPlaceMatchingCarOffice(placeIn, displayOffices)
    ) {
      setPlaceInDetail("");
      setPlaceInGeo(null);
    }
  }, [placeIn, requiresDetail, displayOffices, pickupMethod]);

  useEffect(() => {
    if (
      returnMethod !== "office" &&
      !requiresDetail(placeOut) &&
      !isPlaceMatchingCarOffice(placeOut, displayOffices)
    ) {
      setPlaceOutDetail("");
      setPlaceOutGeo(null);
    }
  }, [placeOut, requiresDetail, displayOffices, returnMethod]);

  // Лог: даты бронирования, отображаемые в BookingModal (start/end + времена)
  useEffect(() => {
    const carIdentifier = car?._id || car?.regNumber || car?.carNumber;
    // Базовые объекты (могут быть dayjs или Date)
    const rawStart = presetDates?.startDate
      ? dayjs(presetDates.startDate)
      : null;
    const rawEnd = presetDates?.endDate ? dayjs(presetDates.endDate) : null;
    // Локальные (Europe/Athens) календарные даты, скорректированные из UTC
    // FIX: убран повторный вызов utc(); интерпретируем сохранённые даты как локальные Athens
    const presetStartStr = rawStart
      ? rawStart.tz(TIME_ZONE).format("YYYY-MM-DD")
      : null;
    const presetEndStr = rawEnd
      ? rawEnd.tz(TIME_ZONE).format("YYYY-MM-DD")
      : null;
    // ISO строки для сравнения (сырье)
    const rawStartISO = rawStart ? rawStart.toISOString() : null;
    const rawEndISO = rawEnd ? rawEnd.toISOString() : null;
    // Диагностический пролог: покажем, почему лог мог быть подавлен
    try {
      const carMatch =
        !DEBUG_CAR_ID ||
        [car?._id, car?.regNumber, car?.carNumber].includes(DEBUG_CAR_ID);
      const dateMatch =
        !DEBUG_DATE ||
        DEBUG_DATE === presetEndStr ||
        DEBUG_DATE === presetStartStr;
      // console.log("[BookingModal][DEBUG] log gate:", {
      //   carId: carIdentifier,
      //   car_id: car?._id,
      //   car_number: car?.carNumber,
      //   presetStartDate: presetStartStr,
      //   presetEndDate: presetEndStr,
      //   rawStartISO,
      //   rawEndISO,
      //   DEBUG_CAR_ID,
      //   DEBUG_DATE,
      //   carMatch,
      //   dateMatch,
      // });
    } catch {}
    if (
      (!DEBUG_CAR_ID ||
        [car?._id, car?.regNumber, car?.carNumber].includes(DEBUG_CAR_ID)) &&
      (!DEBUG_DATE ||
        DEBUG_DATE === presetEndStr ||
        DEBUG_DATE === presetStartStr)
    ) {
      try {
        const startTimeStr = startTime
          ? dayjs(startTime).format("HH:mm")
          : null;
        const endTimeStr = endTime ? dayjs(endTime).format("HH:mm") : null;
        const localStartCombined =
          presetStartStr && startTimeStr
            ? dayjs.tz(
                `${presetStartStr} ${startTimeStr}`,
                "YYYY-MM-DD HH:mm",
                TIME_ZONE
              )
            : null;
        const localCombined =
          presetEndStr && endTimeStr
            ? dayjs.tz(
                `${presetEndStr} ${endTimeStr}`,
                "YYYY-MM-DD HH:mm",
                TIME_ZONE
              )
            : null;
        if (process.env.NODE_ENV === "development") {
          console.log("[BookingModal] Booking dates displayed:", {
            carId: carIdentifier,
            presetStartDate: presetStartStr,
            presetEndDate: presetEndStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            startLocal: localStartCombined
              ? localStartCombined.format("YYYY-MM-DD HH:mm")
              : null,
            startUTC: localStartCombined
              ? localStartCombined.utc().format("YYYY-MM-DD HH:mm")
              : null,
            dateLocal: localCombined
              ? localCombined.format("YYYY-MM-DD HH:mm")
              : null,
            dateUTC: localCombined
              ? localCombined.utc().format("YYYY-MM-DD HH:mm")
              : null,
            rawStartISO,
            rawEndISO,
          });
        }
      } catch (e) {
        // Error in date calculation
      }
    }
  }, [
    presetDates?.startDate,
    presetDates?.endDate,
    startTime,
    endTime,
    car?._id,
    car?.regNumber,
    car?.carNumber,
    TIME_ZONE,
  ]);

  // Определение граничных заказов и установка дефолтных/смещённых времен
  useEffect(() => {
    if (
      !isValidBookingDateValue(presetDates?.startDate) ||
      !isValidBookingDateValue(presetDates?.endDate) ||
      !company
    ) {
      setStartTime(null);
      setEndTime(null);
      setLocationQuote(null);
      return;
    }

    const diffStart = Number(company.hoursDiffForStart) || 0; // обычно >0
    const diffEnd = Number(company.hoursDiffForEnd) || 0; // может быть отрицательным

    // previous boundary: selectedTimes.start содержит время окончания предыдущего заказа если он заканчивается в день старта нового
    const prevEndRaw = selectedTimes?.start; // HH:mm или null
    // next boundary: selectedTimes.end содержит время начала следующего заказа если он начинается в день окончания нового
    const nextStartRaw = selectedTimes?.end; // HH:mm или null

    let minStart = null; // нижняя граница для старта
    let maxEnd = null; // верхняя граница для окончания
    const storedStart = normalizeBookingTimeHm(bookingTimeIn);
    const storedEnd = normalizeBookingTimeHm(bookingTimeOut);
    let startDefault = storedStart || company.defaultStart; // строка HH:mm
    let endDefault = storedEnd || company.defaultEnd; // строка HH:mm

    // Если есть предыдущий граничный заказ: старт = (конец предыдущего + diffStart часов)
    if (prevEndRaw) {
      const base = dayjs(prevEndRaw, "HH:mm").add(diffStart, "hour");
      startDefault = base.format("HH:mm");
      minStart = startDefault; // нельзя раньше этой границы
    }

    // Если есть следующий граничный заказ: окончание = (начало следующего + diffEnd часов)
    if (nextStartRaw) {
      const baseNext = dayjs(nextStartRaw, "HH:mm").add(diffEnd, "hour");
      endDefault = baseNext.format("HH:mm");
      maxEnd = endDefault; // нельзя позже этой границы
    }

    // Установка времен
    setStartTime(setTimeToDatejs(presetDates.startDate, startDefault, true));
    setEndTime(setTimeToDatejs(presetDates.endDate, endDefault));
    setTimeLimits({ minStart, maxEnd });

    // Валидация пересечения только если даты начала и окончания ОДИНАКОВЫЕ (same day)
    // Если даты разные, сравнение только по времени некорректно и не требуется.
    if (
      minStart &&
      maxEnd &&
      dayjs(presetDates.startDate).isSame(dayjs(presetDates.endDate), "day")
    ) {
      const startVal = dayjs(startDefault, "HH:mm");
      const endVal = dayjs(endDefault, "HH:mm");
      if (!startVal.isBefore(endVal)) {
        setTimeErrors(
          t("order.invalidBoundaryInterval", {
            defaultValue:
              "Недопустимый интервал между граничными заказами. Выберите другие даты.",
          })
        );
      } else setTimeErrors(null);
    } else setTimeErrors(null);
  }, [presetDates, selectedTimes, company, t, bookingTimeIn, bookingTimeOut]);

  // Клампинг ручного ввода времени старта
  const handleStartTimeChange = (value) => {
    if (!isValidBookingDateValue(presetDates?.startDate)) return;
    const chosen = dayjs(value, "HH:mm");
    if (timeLimits.minStart) {
      const min = dayjs(timeLimits.minStart, "HH:mm");
      if (chosen.isBefore(min)) {
        setStartTime(
          setTimeToDatejs(presetDates.startDate, timeLimits.minStart, true)
        );
        return;
      }
    }
    setStartTime(setTimeToDatejs(presetDates.startDate, value, true));
  };

  // Клампинг ручного ввода времени окончания
  const handleEndTimeChange = (value) => {
    if (!isValidBookingDateValue(presetDates?.endDate)) return;
    const chosen = dayjs(value, "HH:mm");
    if (timeLimits.maxEnd) {
      const max = dayjs(timeLimits.maxEnd, "HH:mm");
      if (chosen.isAfter(max)) {
        setEndTime(setTimeToDatejs(presetDates.endDate, timeLimits.maxEnd));
        return;
      }
    }
    setEndTime(setTimeToDatejs(presetDates.endDate, value));
  };

  // Email is required on submit (parseRequiredCustomerEmail).

  const bookButtonRef = useRef(null);

  useEffect(() => {
    if (
      open &&
      !isSubmitted &&
      name &&
      email &&
      phone &&
      presetDates?.startDate &&
      presetDates?.endDate &&
      bookButtonRef.current
    ) {
      const timer = setTimeout(() => {
        bookButtonRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    open,
    isSubmitted,
    name,
    email,
    phone,
    presetDates?.startDate,
    presetDates?.endDate,
  ]);

  useEffect(() => {
    if (open) {
      resetForm(); // Сбросить форму при каждом открытии модального окна
      setInsurance(resolveDefaultInsurance(car));
      setChildSeats(0); // Всегда по умолчанию 0
      setOrderNumber(generateOrderNumber(TIME_ZONE));
      if (car && typeof car.franchise !== "undefined") {
        setFranchiseOrder(Number(car.franchise) || 0);
      } else if (car && car._id) {
        fetch(`/api/car/${car._id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && typeof data.franchise !== "undefined") {
              setFranchiseOrder(Number(data.franchise) || 0);
            }
          })
          .catch(() => {});
      } else {
        setFranchiseOrder(0);
      }
    }
  }, [open, car, TIME_ZONE]);

  useEffect(() => {
    if (!open || !placeOptions.length) return;
    const savedPickup =
      typeof window !== "undefined"
        ? localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY)
        : null;
    const savedReturn =
      typeof window !== "undefined"
        ? localStorage.getItem(SELECTED_RETURN_LOCATION_STORAGE_KEY)
        : null;
    const fallback =
      defaultBookingLocation ||
      (spainSite ? "" : DEFAULT_BOOKING_LOCATION);
    const nextPickup = resolveBookingLocationOrDefault(
      savedPickup || fallback,
      placeOptionNames,
      fallback
    );
    const nextReturn = resolveBookingLocationOrDefault(
      savedReturn || savedPickup || fallback,
      placeOptionNames,
      fallback
    );
    if (displayOffices.length) {
      const office = displayOffices[0];
      const officeId = String(office.id || office._id || "");
      setPickupMethod("office");
      setReturnMethod("office");
      setPickupOfficeId(officeId);
      setReturnOfficeId(officeId);
      setSameReturnLocation(true);
      applyPlaceSelection(
        { value: office.name, kind: "office", address: office.address },
        "in"
      );
      applyPlaceSelection(
        { value: office.name, kind: "office", address: office.address },
        "out"
      );
      return;
    }
    setPickupMethod("delivery");
    setReturnMethod("delivery");
    setPlaceIn(nextPickup);
    setPlaceOut(nextReturn);
  }, [open, placeOptionNames, defaultBookingLocation, spainSite, displayOffices, applyPlaceSelection]);

  // Prefill office address when place matches a car office
  useEffect(() => {
    if (!placeInIsOffice) return;
    const office = findCarOfficeForPlace(placeIn, displayOffices);
    const addr = resolveOfficeFormAddress(office, company);
    if (addr && !String(placeInDetail || "").trim()) {
      setPlaceInDetail(addr);
    }
  }, [placeIn, placeInIsOffice, displayOffices, company, placeInDetail]);

  useEffect(() => {
    if (!placeOutIsOffice) return;
    const office = findCarOfficeForPlace(placeOut, displayOffices);
    const addr = resolveOfficeFormAddress(office, company);
    if (addr && !String(placeOutDetail || "").trim()) {
      setPlaceOutDetail(addr);
    }
  }, [placeOut, placeOutIsOffice, displayOffices, company, placeOutDetail]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const newErrors = {};
    const requiredMsg = t("order.required") || "Required";
    if (!name?.trim()) newErrors.name = requiredMsg;
    const emailCheck = parseRequiredCustomerEmail(email);
    if (!emailCheck.ok) {
      newErrors.email = t(emailCheck.messageKey);
    }
    if (!phone?.trim()) newErrors.phone = requiredMsg;
    if (phone?.trim() && !isValidInternationalPhone(phone))
      newErrors.phone = t("order.phoneInvalid");
    if (!termsState.ready) {
      newErrors.terms = t("order.platformTermsUnavailable");
    } else if (!termsState.platformAccepted) {
      newErrors.terms = t("order.platformTermsRequired");
    } else if (termsState.companyRequired && !termsState.companyAccepted) {
      newErrors.terms = t("order.companyTermsRequired");
    }
    if (
      !isValidBookingDateValue(presetDates?.startDate) ||
      !isValidBookingDateValue(presetDates?.endDate)
    ) {
      newErrors.dates = t("order.requiredDates") || "Pick-up and return dates";
    }
    if (!startTime || !dayjs(startTime).isValid() || !endTime || !dayjs(endTime).isValid()) {
      newErrors.time = t("order.requiredValidTimes") || "Valid pickup/return times";
    }
    if (timeErrors) newErrors.time = timeErrors;
    const pin = String(placeIn || "").trim();
    const pout = String(placeOut || "").trim();
    if (!isAllowedBookingLocation(pin, placeOptionNames)) {
      newErrors.placeIn = locationOutsideMsg;
    }
    if (!isAllowedBookingLocation(pout, placeOptionNames)) {
      newErrors.placeOut = locationOutsideMsg;
    }
    const canonIn = canonicalizeBookingLocation(pin, placeOptionNames);
    const canonOut = canonicalizeBookingLocation(pout, placeOptionNames);
    if (
      pickupMethod === "delivery" &&
      canonIn &&
      requiresDetail(canonIn) &&
      !placeInIsOffice &&
      String(placeInDetail || "").trim().length < 3
    ) {
      newErrors.placeInDetail = addressDetailRequiredMsg;
    }
    if (
      returnMethod === "delivery" &&
      canonOut &&
      requiresDetail(canonOut) &&
      !placeOutIsOffice &&
      String(placeOutDetail || "").trim().length < 3
    ) {
      newErrors.placeOutDetail = addressDetailRequiredMsg;
    }
    if (pickupMethod === "delivery" && !String(pickupPlaceId || "").trim()) {
      newErrors.placeInDetail = t("order.unverifiedAddress") || addressDetailRequiredMsg;
    }
    if (
      !sameReturnLocation &&
      returnMethod === "delivery" &&
      !String(returnPlaceId || "").trim()
    ) {
      newErrors.placeOutDetail = t("order.unverifiedAddress") || addressDetailRequiredMsg;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // 🎯 Используем athensTime utilities для timezone-корректного создания времени
      const startDateStr = presetDates?.startDate
        ? dayjs(presetDates.startDate).tz(TIME_ZONE).format("YYYY-MM-DD")
        : null;
      const endDateStr = presetDates?.endDate
        ? dayjs(presetDates.endDate).tz(TIME_ZONE).format("YYYY-MM-DD")
        : null;

      // Извлекаем HH:mm и создаём заново в Athens БЕЗ конвертации из таймзоны браузера
      const timeInAthens = startDateStr
        ? createBusinessDateTime(startDateStr, formatTimeHHMM(dayjs(startTime)), TIME_ZONE)
        : null;
      const timeOutAthens = endDateStr
        ? createBusinessDateTime(endDateStr, formatTimeHHMM(dayjs(endTime)), TIME_ZONE)
        : null;

      // Конвертируем в UTC для сохранения в БД
      const timeInUTC = toServerUTC(timeInAthens);
      const timeOutUTC = toServerUTC(timeOutAthens);

      const orderData = {
        carId: car?._id?.toString?.() || "",
        regNumber: car?.regNumber || "",
        carNumber: car?.carNumber || "",
        customerName: name || "",
        phone: phone || "",
        email: emailCheck.email,
        secondDriver: Boolean(secondDriver),
        Viber: viber,
        Whatsapp: whatsapp,
        Telegram: telegram,
        timeIn: timeInUTC,
        timeOut: timeOutUTC,
        // Привязываем даты аренды к тем же суткам, что и timeIn/timeOut
        rentalStartDate: timeInUTC ? dayjs(timeInUTC).toDate() : "",
        rentalEndDate: timeOutUTC ? dayjs(timeOutUTC).toDate() : "",
        my_order: true,
        ChildSeats: childSeats,
        insurance: insurance,
        totalPrice: Number(daysAndTotal.totalPrice) || 0,
        franchiseOrder: Number(franchiseOrder) || 0,
        orderNumber: orderNumber,
        placeIn: canonIn || placeIn,
        placeOut: canonOut || placeOut,
        placeInDetail: String(placeInDetail || "").trim(),
        placeOutDetail: String(placeOutDetail || "").trim(),
        pickupMethod,
        returnMethod,
        location: {
          pickup: {
            kind: pickupMethod,
            officeId: pickupOfficeId,
            placeId: pickupPlaceId,
          },
          return: {
            kind: sameReturnLocation ? pickupMethod : returnMethod,
            officeId: sameReturnLocation ? pickupOfficeId : returnOfficeId,
            placeId: sameReturnLocation ? pickupPlaceId : returnPlaceId,
            sameAsPickup: sameReturnLocation,
          },
        },
        flightNumber: flightNumber,
        locale: lang || "en",
        termsAcceptance: termsState.payload,
      };

      const response = await addOrderNew(orderData);

      // Фронт только обрабатывает ответ бэка: успех/ошибка создания заказа
      switch (response.status) {
        case "success":
          setSubmittedOrder(response.data);
          setIsSubmitted(true);
          reportGoogleAdsPurchaseFromOrder(response.data);
          fetchAndUpdateOrders();
          break;
        case "pending": {
          setSubmittedOrder(response.data);
          reportGoogleAdsPurchaseFromOrder(response.data);
          if (response.messageCode && response.dates) {
            setMessage(
              t(response.messageCode, { dates: response.dates.join(", ") })
            );
          } else {
            setMessage(response.message);
          }
          setIsSubmitted(true);
          fetchAndUpdateOrders();
          break;
        }
        case "conflict":
          setErrors({ submit: response.message });
          break;
        case "error":
          setErrors({
            submit: response.messageKey
              ? t(response.messageKey, { defaultValue: response.message })
              : response.message,
          });
          break;
        default:
          setErrors({
            submit: response.message || `Unexpected response status: ${response.status}`,
          });
          break;
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("BookingModal: Ошибка при подтверждении заказа:", error);
      }
      setErrors({
        submit:
          error.message || "An error occurred while processing your request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setSecondDriver(false);
    setViber(false);
    setWhatsapp(false);
    setTelegram(false);
    setTermsState({
      ready: false,
      payload: null,
      platformAccepted: false,
      companyAccepted: true,
      companyRequired: false,
    });
    setErrors({});
    setIsSubmitted(false);
    setIsSubmitting(false);
    setSubmittedOrder(null);
    setMessage(null);
    setPlaceIn("");
    setPlaceOut("");
    setPlaceInDetail("");
    setPlaceOutDetail("");
    setPickupMethod("delivery");
    setReturnMethod("delivery");
    setPlaceInGeo(null);
    setPlaceOutGeo(null);
    setFlightNumber("");
    setDaysAndTotal(createEmptyBookingPriceSummary());
    setCalcLoading(false);
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  // Unified close handler - only allow close button (not backdrop or Escape)
  // This matches the default behavior contract: transactional modals should not close accidentally
  const handleDialogClose = (_event, reason) => {
    // Block backdrop clicks and Escape key (default: closeOnBackdropClick=false, closeOnEscape=false)
    if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
      handleModalClose();
    }
  };

  const pickupDeliveryHelperText = (() => {
    const priced = buildDeliveryHelperText({
      locationValue: placeIn,
      deliveryCost: daysAndTotal.pickupDeliveryCost,
      locale: lang,
      deliveryLabel: t("order.delivery"),
      isLoading: calcLoading,
      hideWhenZero: true,
    });
    if (priced) return priced;
    if (
      String(placeIn || "").trim() &&
      !calcLoading &&
      daysAndTotal.pickupDeliveryCost === 0 &&
      placeInIsOffice
    ) {
      return t("order.officeDeliveryFree");
    }
    const outsideNote = formatOutsideHelper(placeInGeo);
    if (outsideNote) return outsideNote;
    if (
      spainSite &&
      String(placeIn || "").trim() &&
      !calcLoading &&
      daysAndTotal.pickupDeliveryCost === 0
    ) {
      return t("order.deliveryQuotedWithOrder");
    }
    return "";
  })();
  const returnDeliveryHelperText = (() => {
    const priced = buildDeliveryHelperText({
      locationValue: placeOut,
      deliveryCost: daysAndTotal.returnDeliveryCost,
      locale: lang,
      deliveryLabel: t("order.delivery"),
      isLoading: calcLoading,
      hideWhenZero: true,
    });
    if (priced) return priced;
    if (
      String(placeOut || "").trim() &&
      !calcLoading &&
      daysAndTotal.returnDeliveryCost === 0 &&
      placeOutIsOffice
    ) {
      return t("order.officeDeliveryFree");
    }
    const outsideNote = formatOutsideHelper(placeOutGeo);
    if (outsideNote) return outsideNote;
    if (
      spainSite &&
      String(placeOut || "").trim() &&
      !calcLoading &&
      daysAndTotal.returnDeliveryCost === 0
    ) {
      return t("order.deliveryQuotedWithOrder");
    }
    return "";
  })();

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={true}
      fullWidth
      maxWidth="sm"
      TransitionComponent={BookingDialogTransition}
      transitionDuration={BOOKING_DIALOG_TRANSITION}
      TransitionProps={{
        onExited,
        easing: {
          enter: "cubic-bezier(0, 0, 0.2, 1)",
          exit: "cubic-bezier(0.4, 0, 1, 1)",
        },
        style: { transformOrigin: "center center" },
      }}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: 2,
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: "95vh", sm: "90vh" },
        },
      }}
    >
      {isLoading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
            p: 8,
            minHeight: 200,
          }}
        >
          <CircularProgress sx={{ color: "primary.main" }} />
          <CircularProgress sx={{ color: "secondary.main" }} />
          <CircularProgress sx={{ color: "triadic.green" }} />
        </Box>
      ) : (
        <React.Fragment>
          {/* Единый липкий блок: заголовок + период бронирования + дни/стоимость */}
          {!isSubmitted && (
            <Box
              sx={{
                position: { xs: "sticky", sm: "static" },
                top: { xs: 0 },
                zIndex: { xs: 40 },
                backgroundColor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                pt: { xs: 2.4, sm: 1.5 },
                pb: { xs: 1.3, sm: 1.5 },
                mb: { xs: 0.3, sm: 0 },
                position: "relative",
              }}
            >
              {/* Close button */}
              <IconButton
                onClick={handleModalClose}
                size="small"
                sx={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  color: "text.secondary",
                  "&:hover": { color: "primary.main" },
                }}
                aria-label="close"
              >
                <CloseIcon />
              </IconButton>

              <Typography
                variant="h6"
                align="center"
                sx={{
                  fontSize: { xs: "1.05rem", sm: "1.25rem" },
                  px: 4, // Добавляем padding чтобы текст не заходил под кнопку
                  m: 1,
                  lineHeight: 1.25,
                  fontWeight: 600,
                }}
              >
                {t("order.book", { model: car.model })}
              </Typography>
              {/* Строка периода бронирования (скрыта по просьбе клиента)
            <Typography
              variant="body2"
              align="center"
              sx={{
                mt: { xs: 0.15, sm: 0.4 },
                mb: { xs: 0, sm: 0.3 },
                lineHeight: 1.1,
                fontSize: { xs: "0.78rem", sm: "0.9rem" },
              }}
            >
              {t("basic.from")}
              <Box component="span" sx={{ fontWeight: 600, color: "primary.main", mx: 0.5 }}>
                {dayjs(presetDates?.startDate).format("DD.MM.YYYY")}
              </Box>
              {t("order.till")}
              <Box component="span" sx={{ fontWeight: 600, color: "primary.main", mx: 0.5 }}>
                {dayjs(presetDates?.endDate).format("DD.MM.YYYY")}
              </Box>
            </Typography>
            */}
              {/* Дни и стоимость – без промежутка, приклеено */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  mt: { xs: 0.15, sm: 0.4 },
                  lineHeight: 1.14,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 0, sm: 2 },
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      fontSize: { xs: "0.94rem", sm: "1.1rem" },
                      m: 0,
                      lineHeight: 1.14,
                      textAlign: "center",
                    }}
                  >
                    {t("order.daysNumber", { count: daysAndTotal.days })}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: "bold",
                        color: "primary.main",
                        mx: 0.5,
                      }}
                    >
                      {daysAndTotal.days}
                    </Box>
                  </Typography>
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      fontSize: { xs: "0.94rem", sm: "1.1rem" },
                      m: 0,
                      lineHeight: 1.14,
                      textAlign: "center",
                    }}
                  >
                    {t("order.price")}
                    <Box
                      component="span"
                      sx={{
                        fontWeight: "bold",
                        color: "primary.main",
                        mx: 0.5,
                      }}
                    >
                      {calcLoading
                        ? ""
                        : `${formatEuroAmount(daysAndTotal.totalPrice, lang)}€`}
                    </Box>
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
          <DialogContent
            sx={{
              pt: isSubmitted ? 3 : 2,
            }}
          >
            {isSubmitted ? (
              <Box sx={{ position: "relative", textAlign: "center" }}>
                {/* Close button for success state */}
                <IconButton
                  onClick={handleModalClose}
                  size="small"
                  sx={{
                    position: "absolute",
                    right: -16,
                    top: -16,
                    color: "text.secondary",
                    "&:hover": { color: "primary.main" },
                  }}
                  aria-label="close"
                >
                  <CloseIcon />
                </IconButton>
                <SuccessMessage
                  submittedOrder={submittedOrder}
                  presetDates={presetDates}
                  onClose={onClose}
                  message={message}
                />
              </Box>
            ) : (
              <Box>
                {/* Удалён старый отдельный блок: теперь информация перенесена в липкий заголовок */}
                <Box
                  component="form"
                  sx={{ "& .MuiTextField-root": { my: { xs: 0.5, sm: 1 } } }}
                >
                  {/* Дата над временем, нередактируемые поля с видом выпадающих */}
                  <Box sx={{ display: "flex", gap: 2, mb: { xs: 1, sm: 1 } }}>
                    {/* Колонка получения */}
                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <BookingDateField
                        label={t("order.pickupDate") || "Дата получения"}
                        value={formatValidBookingDate(
                          presetDates?.startDate,
                          "DD.MM.YYYY",
                          ""
                        )}
                        error={Boolean(errors.dates)}
                        helperText={errors.dates || ""}
                      />
                      <BookingTimeField
                        label={t("order.pickupTime")}
                        value={
                          startTime && dayjs(startTime).isValid()
                            ? startTime.format("HH:mm")
                            : ""
                        }
                        inputProps={
                          timeLimits.minStart
                            ? { min: timeLimits.minStart }
                            : {}
                        }
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        error={Boolean(timeErrors || errors.time)}
                        helperText={
                          errors.time || timeErrors
                            ? errors.time || timeErrors
                            : timeLimits.minStart
                            ? `${t("order.minAllowed", {
                                defaultValue: "Не раньше: ",
                              })}${timeLimits.minStart}`
                            : ""
                        }
                        FormHelperTextProps={{
                          sx: { color: "error.main", fontWeight: 600 },
                        }}
                      />
                    </Box>
                    {/* Колонка возврата */}
                    <Box
                      sx={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                      }}
                    >
                      <BookingDateField
                        label={t("order.returnDate") || "Дата возврата"}
                        value={formatValidBookingDate(
                          presetDates?.endDate,
                          "DD.MM.YYYY",
                          ""
                        )}
                        error={Boolean(errors.dates)}
                      />
                      <BookingTimeField
                        label={t("order.returnTime")}
                        value={
                          endTime && dayjs(endTime).isValid()
                            ? endTime.format("HH:mm")
                            : ""
                        }
                        inputProps={
                          timeLimits.maxEnd ? { max: timeLimits.maxEnd } : {}
                        }
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        error={Boolean(timeErrors)}
                        helperText={
                          timeErrors
                            ? timeErrors
                            : timeLimits.maxEnd
                            ? `${t("order.maxAllowed", {
                                defaultValue: "Не позже: ",
                              })}${timeLimits.maxEnd}`
                            : ""
                        }
                        FormHelperTextProps={{
                          sx: { color: "error.main", fontWeight: 600 },
                        }}
                      />
                    </Box>
                  </Box>
                  {/* Locations: stack below md; city + detail/flight always stacked full-width */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      gap: 2,
                      mb: { xs: 1, sm: 2 },
                      mt: 0,
                      width: "100%",
                      alignItems: "stretch",
                    }}
                  >
                    {/* Pickup column */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: { xs: "100%", md: "50%" },
                        minWidth: 0,
                        gap: 1,
                        alignItems: "stretch",
                      }}
                    >
                      <BookingOfficeDeliveryChoice
                        method={pickupMethod}
                        onMethodChange={(next) => switchLegMethod("in", next)}
                        offices={displayOffices}
                        selectedOfficeName={placeIn}
                        selectedOfficeId={pickupOfficeId}
                        onSelectOffice={(office) =>
                          switchLegMethod("in", "office", office)
                        }
                        officeLabel={t("order.pickupAtOffice")}
                        deliveryLabel={t("order.deliveryToAddress")}
                      />
                      {pickupMethod === "delivery" || !displayOffices.length ? (
                        <BookingLocationAutocomplete
                          label={t("order.pickupLocation") || "Место получения"}
                          options={placeOptions}
                          freeSolo={!spainSite}
                          dividerBeforeOption={locationDividerBefore}
                          value={placeIn}
                          onChange={(e, newValue) => {
                            applyPlaceSelection(newValue, "in");
                            if (errors.placeIn) {
                              setErrors((prev) => {
                                const { placeIn: _p, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onInputChange={(event, newInputValue, reason) => {
                            if (reason === "reset") return;
                            if (event?.type === "change" || reason === "clear") {
                              setPlaceIn(newInputValue);
                              setPlaceInGeo(null);
                            }
                            if (errors.placeIn) {
                              setErrors((prev) => {
                                const { placeIn: _p, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          error={Boolean(errors.placeIn)}
                          helperText={errors.placeIn || pickupDeliveryHelperText}
                          FormHelperTextProps={{
                            sx: {
                              fontSize: "0.72rem",
                              color: errors.placeIn
                                ? "error.main"
                                : placeInIsOffice
                                  ? "success.main"
                                  : "text.secondary",
                              lineHeight: 1.3,
                              mt: 0.5,
                              whiteSpace: "normal",
                            },
                          }}
                          sx={{ width: "100%", minWidth: 0 }}
                        />
                      ) : null}
                      {placeIn &&
                      pickupMethod === "delivery" &&
                      isAirportLocation(placeIn) ? (
                        <BookingFlightField
                          label={t("order.flightNumber") || "Номер рейса"}
                          value={flightNumber}
                          onChange={(e) => setFlightNumber(e.target.value)}
                          sx={{
                            width: "100%",
                            minWidth: 0,
                            alignSelf: "stretch",
                          }}
                        />
                      ) : null}
                      {pickupMethod === "delivery" &&
                      placeIn &&
                      requiresDetail(placeIn) &&
                      !placeInIsOffice &&
                      !isAirportLocation(placeIn) ? (
                        <BookingAddressPlacesField
                          label={hotelOrAddressLabel}
                          value={placeInDetail}
                          country={siteCountry}
                          language={lang}
                          cityBias={placeIn}
                          companyId={car?.ownerId || company?._id}
                          carId={car?._id}
                          requireVerifiedPlace={spainSite}
                          onChange={(next) => {
                            setPlaceInDetail(next);
                            setPlaceInGeo(null);
                            if (errors.placeInDetail) {
                              setErrors((prev) => {
                                const { placeInDetail: _d, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onResolved={(geo) => {
                            setPlaceInGeo(geo);
                            setPickupPlaceId(geo?.placeId || "");
                          }}
                          error={Boolean(errors.placeInDetail)}
                          helperText={
                            errors.placeInDetail ||
                            formatOutsideHelper(placeInGeo) ||
                            ""
                          }
                          FormHelperTextProps={{
                            sx: {
                              color: errors.placeInDetail
                                ? "error.main"
                                : placeInGeo?.outsideCity
                                  ? "warning.main"
                                  : "text.secondary",
                              fontSize: "0.72rem",
                              whiteSpace: "normal",
                            },
                          }}
                          sx={{
                            width: "100%",
                            minWidth: 0,
                            alignSelf: "stretch",
                          }}
                        />
                      ) : null}
                    </Box>

                    {/* Return column */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: { xs: "100%", md: "50%" },
                        minWidth: 0,
                        gap: 1,
                        alignItems: "stretch",
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={sameReturnLocation}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSameReturnLocation(checked);
                              if (checked) {
                                setReturnMethod(pickupMethod);
                                setReturnOfficeId(pickupOfficeId);
                                setReturnPlaceId(pickupPlaceId);
                                setPlaceOut(placeIn);
                                setPlaceOutDetail(placeInDetail);
                              }
                            }}
                          />
                        }
                        label={
                          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                            {t("order.sameReturnLocation")}
                          </Typography>
                        }
                        sx={{ m: 0 }}
                      />
                      {sameReturnLocation ? null : (
                      <BookingOfficeDeliveryChoice
                        method={returnMethod}
                        onMethodChange={(next) => switchLegMethod("out", next)}
                        offices={displayOffices}
                        selectedOfficeName={placeOut}
                        selectedOfficeId={returnOfficeId}
                        onSelectOffice={(office) =>
                          switchLegMethod("out", "office", office)
                        }
                        officeLabel={t("order.returnAtOffice")}
                        deliveryLabel={t("order.returnDeliveryToAddress")}
                      />
                      )}
                      {sameReturnLocation ? null : (returnMethod === "delivery" || !displayOffices.length) ? (
                        <BookingLocationAutocomplete
                          label={t("order.returnLocation") || "Место возврата"}
                          options={placeOptions}
                          freeSolo={!spainSite}
                          dividerBeforeOption={locationDividerBefore}
                          value={placeOut}
                          onChange={(e, newValue) => {
                            applyPlaceSelection(newValue, "out");
                            if (errors.placeOut) {
                              setErrors((prev) => {
                                const { placeOut: _p, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onInputChange={(event, newInputValue, reason) => {
                            if (reason === "reset") return;
                            if (event?.type === "change" || reason === "clear") {
                              setPlaceOut(newInputValue);
                              setPlaceOutGeo(null);
                            }
                            if (errors.placeOut) {
                              setErrors((prev) => {
                                const { placeOut: _p, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          error={Boolean(errors.placeOut)}
                          helperText={errors.placeOut || returnDeliveryHelperText}
                          FormHelperTextProps={{
                            sx: {
                              fontSize: "0.72rem",
                              color: errors.placeOut
                                ? "error.main"
                                : placeOutIsOffice
                                  ? "success.main"
                                  : "text.secondary",
                              lineHeight: 1.3,
                              mt: 0.5,
                              whiteSpace: "normal",
                            },
                          }}
                          sx={{ width: "100%", minWidth: 0 }}
                        />
                      ) : null}
                      {!sameReturnLocation &&
                      returnMethod === "delivery" &&
                      placeOut &&
                      requiresDetail(placeOut) &&
                      !placeOutIsOffice ? (
                        <BookingAddressPlacesField
                          label={hotelOrAddressLabel}
                          value={placeOutDetail}
                          country={siteCountry}
                          language={lang}
                          cityBias={placeOut}
                          companyId={car?.ownerId || company?._id}
                          carId={car?._id}
                          requireVerifiedPlace={spainSite}
                          onChange={(next) => {
                            setPlaceOutDetail(next);
                            setPlaceOutGeo(null);
                            if (errors.placeOutDetail) {
                              setErrors((prev) => {
                                const { placeOutDetail: _d, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          onResolved={(geo) => {
                            setPlaceOutGeo(geo);
                            setReturnPlaceId(geo?.placeId || "");
                          }}
                          error={Boolean(errors.placeOutDetail)}
                          helperText={
                            errors.placeOutDetail ||
                            formatOutsideHelper(placeOutGeo) ||
                            ""
                          }
                          FormHelperTextProps={{
                            sx: {
                              color: errors.placeOutDetail
                                ? "error.main"
                                : placeOutGeo?.outsideCity
                                  ? "warning.main"
                                  : "text.secondary",
                              fontSize: "0.72rem",
                              whiteSpace: "normal",
                            },
                          }}
                          sx={{
                            width: "100%",
                            minWidth: 0,
                            alignSelf: "stretch",
                          }}
                        />
                      ) : null}
                      {locationQuote?.success === false && locationQuote.message ? (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                          {locationQuote.message}
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1.5,
                      px: 1.5,
                      py: 1.25,
                      mb: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, mb: 0.5 }}>
                      {t("order.locationPriceSummary")}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {t("order.baseRental")}: €{Number(daysAndTotal.rentalPrice || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {t("order.pickupDeliveryFee")}:{" "}
                      {pickupMethod === "office" ||
                      Number(daysAndTotal.pickupDeliveryCost || 0) === 0
                        ? `${t("order.officeFreeBadge") || "Free"} / EUR 0`
                        : `€${Number(daysAndTotal.pickupDeliveryCost || 0).toFixed(2)}`}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block" }}>
                      {t("order.returnDeliveryFee")}:{" "}
                      {(sameReturnLocation ? pickupMethod : returnMethod) ===
                        "office" ||
                      Number(daysAndTotal.returnDeliveryCost || 0) === 0
                        ? `${t("order.officeFreeBadge") || "Free"} / EUR 0`
                        : `€${Number(daysAndTotal.returnDeliveryCost || 0).toFixed(2)}`}
                    </Typography>
                    {spainSite && marketplaceSplit ? (
                      <>
                        <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
                          {marketplaceLabels.total}: {formatMarketplaceEuro(marketplaceSplit.grossMinor)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {marketplaceLabels.payNow}: {formatMarketplaceEuro(marketplaceSplit.platformAmountMinor)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {marketplaceLabels.payAtPickup}: {formatMarketplaceEuro(marketplaceSplit.supplierBalanceMinor)}
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
                          {marketplaceFeeNotice(
                            i18n?.language,
                            marketplaceSplit.platformAmountMinor
                          )}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
                        {t("order.totalRental")}: €{Number(daysAndTotal.totalPrice || 0).toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                  {/* <TextField
                    label={t("order.name")}
                    variant="outlined"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    error={!!errors.name}
                    helperText={errors.name}
                  /> */}
                  {/* Страховка, франшиза (условно) и детское кресло */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      mt: { xs: 1, sm: 1 },
                      mb: { xs: 1, sm: 3 },
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { sm: "center" },
                    }}
                  >
                    <FormControl
                      size="small"
                      sx={{
                        flex: insurance === "TPL" ? 2 : 1,
                        width: { xs: "100%" },
                      }}
                    >
                      <InputLabel>{t("order.insurance")}</InputLabel>
                      <Select
                        label={t("order.insurance")}
                        value={insurance}
                        onChange={(e) => setInsurance(e.target.value)}
                        sx={{
                          height: { sm: "40px" },
                          // Используем правильный синтаксис MUI для кастомных media queries
                          "@media (max-width:600px) and (orientation: portrait)":
                            {
                              height: "50px",
                            },
                        }}
                      >
                        {(
                          t("order.insuranceOptions", {
                            returnObjects: true,
                          }) || []
                        ).map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.value === "CDW"
                              ? `${option.label} ${
                                  car.PriceKacko ? car.PriceKacko : 0
                                }€/${t("order.perDay")}`
                              : option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {insurance === "CDW" && (
                      <BookingTextField
                        label={t("order.franchise")}
                        type="number"
                        value={franchiseOrder || 0}
                        InputProps={{ readOnly: true }}
                        size="small"
                        sx={{
                          flex: 1,
                          // Используем правильный синтаксис MUI для кастомных media queries
                          "@media (max-width:600px) and (orientation: portrait)":
                            {
                              "& .MuiInputBase-root": {
                                height: "50px !important",
                                minHeight: "50px !important",
                              },
                            },
                          "& .MuiInputBase-root": {
                            height: "40px !important",
                            minHeight: "40px !important",
                          },
                        }}
                      />
                    )}
                    <FormControl
                      size="small"
                      sx={{ flex: 1, width: { xs: "100%" } }}
                    >
                      <InputLabel>
                        {t("order.childSeats")}{" "}
                        {car.PriceChildSeats ? car.PriceChildSeats : 0}€/
                        {t("order.perDay")}
                      </InputLabel>
                      <Select
                        label={`${t("order.childSeats")} ${
                          car.PriceChildSeats ? car.PriceChildSeats : 0
                        }€/${t("order.perDay")}`}
                        value={childSeats}
                        onChange={(e) => setChildSeats(Number(e.target.value))}
                        sx={{
                          height: { sm: "40px" },
                          // Используем правильный синтаксис MUI для кастомных media queries
                          "@media (max-width:600px) and (orientation: portrait)":
                            {
                              height: "50px",
                            },
                        }}
                      >
                        <MenuItem value={0}>
                          {t("order.childSeatsNone")}
                        </MenuItem>
                        {[1, 2, 3, 4].map((num) => (
                          <MenuItem key={num} value={num}>
                            {num}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <BookingContactSection
                    mode="client"
                    values={{
                      customerName: name,
                      phone,
                      email,
                      secondDriver,
                      Viber: viber,
                      Whatsapp: whatsapp,
                      Telegram: telegram,
                    }}
                    onFieldChange={(field, value) => {
                      switch (field) {
                        case "customerName":
                          setName(value);
                          if (errors.name)
                            setErrors((prev) => ({ ...prev, name: undefined }));
                          break;
                        case "phone":
                          setPhone(value);
                          if (errors.phone)
                            setErrors((prev) => ({ ...prev, phone: undefined }));
                          break;
                        case "email":
                          setEmail(value);
                          if (errors.email)
                            setErrors((prev) => ({ ...prev, email: undefined }));
                          break;
                        case "secondDriver":
                          setSecondDriver(Boolean(value));
                          break;
                        case "Viber":
                          setViber(Boolean(value));
                          break;
                        case "Whatsapp":
                          setWhatsapp(Boolean(value));
                          break;
                        case "Telegram":
                          setTelegram(Boolean(value));
                          break;
                        default:
                          break;
                      }
                    }}
                    rentalStartDate={
                      presetDates?.startDate
                        ? dayjs(presetDates.startDate).tz(TIME_ZONE).format("YYYY-MM-DD")
                        : ""
                    }
                    disabled={isSubmitting}
                    secondDriverPriceLabelValue={secondDriverPriceLabelValue}
                    errors={errors}
                    showDrivingLicenceUpload={false}
                  />
                </Box>
                <BookingContractsBlock
                  companyId={car?.ownerId || company?._id}
                  lang={lang}
                  companyName={company?.name}
                  error={errors.terms}
                  compactMarketplace={Boolean(spainSite && marketplaceSplit)}
                  feeAmountMinor={marketplaceSplit?.platformAmountMinor}
                  onChange={(next) => {
                    setTermsState(next);
                    if (errors.terms)
                      setErrors((prev) => ({ ...prev, terms: undefined }));
                  }}
                />
                {errors.submit && (
                  <Typography color="error" sx={{ mt: 2 }}>
                    {errors.submit}
                  </Typography>
                )}
                {/* Кнопки: Бронировать всегда активна, при ошибках подсвечиваются поля (Formik-стиль) */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 2,
                    mt: 3,
                    pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    "@media (max-width:600px) and (orientation: portrait)": {
                      width: "100%",
                      justifyContent: "space-between",
                      mt: 1,
                      pt: 1,
                    },
                  }}
                >
                  {isSubmitted ? (
                    <ConfirmButton
                      onClick={handleModalClose}
                      label="OK"
                      sx={{
                        "@media (max-width:600px) and (orientation: portrait)":
                          {
                            flexBasis: 0,
                            flexGrow: 1,
                            minWidth: 0,
                            backgroundColor: "secondary.main",
                            color: "secondary.contrastText",
                          },
                      }}
                    />
                  ) : (
                    <>
                      <CancelButton
                        onClick={handleModalClose}
                        label={t("basic.cancel")}
                        sx={{
                          "@media (max-width:600px) and (orientation: portrait)":
                            {
                              flexBasis: 0,
                              flexGrow: 0.7,
                              minWidth: 0,
                            },
                        }}
                      />
                      <ConfirmButton
                        ref={bookButtonRef}
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        pulse={!isSubmitting}
                        label={
                          isSubmitting
                            ? t("order.processing") || "Processing..."
                            : t("order.confirmBooking")
                        }
                        sx={{
                          "@media (max-width:600px) and (orientation: portrait)":
                            {
                              flexBasis: 0,
                              flexGrow: 1.3,
                              minWidth: 0,
                              padding: "12px 20px",
                            },
                        }}
                      />
                    </>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
        </React.Fragment>
      )}
    </Dialog>
  );
};

export default BookingModal;
