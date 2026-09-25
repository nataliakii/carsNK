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
  Grow,
} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import {
  ConfirmButton,
  CancelButton,
  BookingDateField,
  BookingTimeField,
  BookingTextField,
  BookingFlightField,
} from "../ui";
import BookingContactSection from "@/app/components/orders/BookingContactSection";
import {
  DrivingLicenceCaptureField,
  emptyDrivingLicenceValue,
} from "@/app/components/ui/inputs";
import { licenceCaptureMessageKey } from "@/domain/legal/drivingLicenceSnapshot";
import { clientDrivingLicenceReadyForCreate } from "@/domain/legal/drivingLicenceCreateGateClient";
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
  LOCATION_DIVIDER_BEFORE,
  SELECTED_LOCATION_STORAGE_KEY,
  SELECTED_RETURN_LOCATION_STORAGE_KEY,
  normalizeBookingTimeHm,
} from "@/domain/orders/locationOptions";
import { useCompanyBookingLocations } from "@/app/hooks/useCompanyBookingLocations";
import {
  canonicalOfficeId,
  resolveSelectedOfficeId,
  validateCustomerBookingLocation,
  isManualPlaceId,
} from "@/domain/orders/bookingLocationSelection";
import { getSiteCountryCode } from "@config/siteCountry";
import {
  isSpainBookingSite,
  resolvePlaceRequiresAddressDetail,
} from "@/domain/orders/catalogPlaceOptions";
import { normalizeDeliveryPricingLocation } from "@/domain/orders/bookingPricingOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";
import {
  buildBookingPriceSummary,
  createEmptyBookingPriceSummary,
} from "@/domain/orders/bookingPriceSummary";
import {
  findCarOfficeForPlace,
  isPlaceMatchingCarOffice,
  resolveBookingDisplayOffices,
  resolveOfficeFormAddress,
} from "@/domain/orders/carOffices";
import BookingLocationSelector from "./BookingLocationSelector";
import BookingPriceDetails from "./BookingPriceDetails";
import BookingContractsBlock from "./BookingContractsBlock";
import { placeCountryCode } from "@/domain/geo/googlePlaces";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import { parseRequiredCustomerEmail } from "@/domain/validation/customerEmail";
import { reportGoogleAdsPurchaseFromOrder } from "@/domain/analytics/googleAdsConversion";
import {
  marketplaceFinancialSplitFromMajor,
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
  const [priceParts, setPriceParts] = useState(null);
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
    coverage,
    coverageReady,
    requiresDetail: companyRequiresDetail,
    isAirport,
  } = useCompanyBookingLocations(car?.ownerId || company?._id);
  const bookingCompanyId = String(car?.ownerId || company?._id || "");
  const deliveryAreaNames = useMemo(
    () =>
      (coverage?.deliveryAreas || [])
        .map((area) => area.name)
        .filter(Boolean),
    [coverage]
  );
  const deliveryUnavailable =
    coverageReady && String(coverage?.companyId || "") === bookingCompanyId
      ? !coverage.deliveryAvailable
      : false;
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
  const defaultBookingLocation =
    deliveryAreaNames.length === 1 ? deliveryAreaNames[0] : "";
  // Prefer coverage offices (car owner) — Context `company` is often the
  // platform company and would strip real office ids via resolveEligibleOffices.
  const displayOffices = useMemo(() => {
    if (
      coverageReady &&
      String(coverage?.companyId || "") === bookingCompanyId &&
      Array.isArray(coverage?.offices) &&
      coverage.offices.length
    ) {
      return coverage.offices.map((office) => ({
        id: office.id,
        _id: office.id,
        name: office.name,
        address: office.address || "",
        lat: office.lat || "",
        lon: office.lon || "",
        city: office.city || "",
        country: office.countryCode || "",
        locationType: office.locationType || "office",
        collectionInstructions: office.collectionInstructions || "",
        returnInstructions: office.returnInstructions || "",
        freePickup: office.freePickup !== false,
        freeReturn: office.freeReturn !== false,
      }));
    }
    const ownerMatches =
      String(company?._id || "") === bookingCompanyId || !car?.ownerId;
    return resolveBookingDisplayOffices(car, ownerMatches ? company : null, {
      countryCode: siteCountry,
      selectedCity: defaultBookingLocation,
    });
  }, [
    coverageReady,
    coverage?.companyId,
    coverage?.offices,
    bookingCompanyId,
    car,
    company,
    siteCountry,
    defaultBookingLocation,
  ]);
  const placesCountry =
    placeCountryCode(coverage?.countryCode || company?.country || siteCountry) ||
    "";
  const placeOptions = useMemo(
    () =>
      deliveryAreaNames.map((name) => ({
        value: name,
        label: name,
        kind: "city",
      })),
    [deliveryAreaNames]
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
  const [drivingLicence, setDrivingLicence] = useState(emptyDrivingLicenceValue);
  const [licenceSubmitAttempted, setLicenceSubmitAttempted] = useState(false);

  const licenceCaptureReady = useMemo(
    () => clientDrivingLicenceReadyForCreate({ payload: drivingLicence }),
    [drivingLicence]
  );

  const placeInIsOffice =
    pickupMethod === "office" ||
    isPlaceMatchingCarOffice(placeIn, displayOffices);
  const placeOutIsOffice =
    returnMethod === "office" ||
    isPlaceMatchingCarOffice(placeOut, displayOffices);
  const sameReturnSummary = (() => {
    if (pickupMethod === "office") {
      const selectedId = canonicalOfficeId(pickupOfficeId);
      const office = selectedId
        ? displayOffices.find(
            (row) => canonicalOfficeId(row) === selectedId
          )
        : null;
      return office
        ? `Pick-up office: ${office.name}${
            office.address ? ` — ${office.address}` : ""
          }`
        : "Same as pick-up office";
    }
    const address = String(placeInDetail || placeIn || "").trim();
    return address ? `Delivery: ${address}` : "Same as pick-up";
  })();

  useEffect(() => {
    if (!sameReturnLocation) return;
    setReturnMethod(pickupMethod);
    setReturnOfficeId(pickupOfficeId);
    setReturnPlaceId(pickupPlaceId);
    setPlaceOut(placeIn);
    setPlaceOutDetail(placeInDetail);
    setPlaceOutGeo(placeInGeo);
  }, [
    sameReturnLocation,
    pickupMethod,
    pickupOfficeId,
    pickupPlaceId,
    placeIn,
    placeInDetail,
    placeInGeo,
  ]);

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
        const currentId = which === "in" ? pickupOfficeId : returnOfficeId;
        const target =
          office ||
          displayOffices.find(
            (row) => canonicalOfficeId(row) === canonicalOfficeId(currentId)
          ) ||
          (displayOffices.length === 1 ? displayOffices[0] : null);
        if (target) {
          applyPlaceSelection(
            { value: target.name, kind: "office", address: target.address },
            which
          );
          const id = canonicalOfficeId(target);
          if (which === "in") {
            setPickupOfficeId(id);
            setPickupPlaceId("");
            setPlaceInDetail("");
            setPlaceInGeo(null);
          } else {
            setReturnOfficeId(id);
            setReturnPlaceId("");
            setPlaceOutDetail("");
            setPlaceOutGeo(null);
          }
          setErrors((prev) => {
            const next = { ...prev };
            delete next.placeIn;
            delete next.placeOut;
            delete next.placeInDetail;
            delete next.placeOutDetail;
            delete next.submit;
            return next;
          });
          setDaysAndTotal((prev) => {
            const clearPickup = which === "in";
            const clearReturn = which === "out" || sameReturnLocation;
            const removed =
              (clearPickup ? Number(prev.pickupDeliveryCost || 0) : 0) +
              (clearReturn ? Number(prev.returnDeliveryCost || 0) : 0);
            return {
              ...prev,
              pickupDeliveryCost: clearPickup ? 0 : prev.pickupDeliveryCost,
              returnDeliveryCost: clearReturn ? 0 : prev.returnDeliveryCost,
              totalPrice: Math.max(0, Number(prev.totalPrice || 0) - removed),
            };
          });
        } else if (which === "in") {
          setPickupOfficeId("");
          setPickupPlaceId("");
          setPlaceInDetail("");
          setPlaceInGeo(null);
          setDaysAndTotal((prev) => ({
            ...prev,
            pickupDeliveryCost: 0,
            returnDeliveryCost: sameReturnLocation ? 0 : prev.returnDeliveryCost,
            totalPrice: Math.max(
              0,
              Number(prev.totalPrice || 0) -
                Number(prev.pickupDeliveryCost || 0) -
                (sameReturnLocation ? Number(prev.returnDeliveryCost || 0) : 0)
            ),
          }));
        } else {
          setReturnOfficeId("");
          setReturnPlaceId("");
          setPlaceOutDetail("");
          setPlaceOutGeo(null);
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
      const fallback = defaultBookingLocation || deliveryAreaNames[0] || "";
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
    [applyPlaceSelection, defaultBookingLocation, deliveryAreaNames, displayOffices, pickupOfficeId, returnOfficeId, sameReturnLocation]
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
        setPriceParts(result?.authoritativePrice || null);
        const pickupOfficeReady =
          pickupMethod === "office"
            ? Boolean(canonicalOfficeId(pickupOfficeId))
            : Boolean(String(pickupPlaceId || "").trim());
        const returnOfficeReady = sameReturnLocation
          ? pickupOfficeReady
          : returnMethod === "office"
            ? Boolean(canonicalOfficeId(returnOfficeId))
            : Boolean(String(returnPlaceId || "").trim());
        const quoteReady =
          (pickupMethod === "office" || pickupMethod === "delivery") &&
          pickupOfficeReady &&
          returnOfficeReady;
        try {
          if (!quoteReady) {
            setLocationQuote(null);
          } else {
            const quoteRes = await fetch("/api/public/delivery/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({
                carId: car?._id,
                language: lang,
                pickup: {
                  kind: pickupMethod,
                  method: pickupMethod,
                  officeId: pickupMethod === "office" ? pickupOfficeId : null,
                  placeId: pickupMethod === "delivery" ? pickupPlaceId : null,
                  address:
                    pickupMethod === "delivery"
                      ? String(placeInDetail || "").trim()
                      : undefined,
                  cityName:
                    pickupMethod === "delivery"
                      ? String(placeIn || "").trim()
                      : undefined,
                },
                return: {
                  kind: sameReturnLocation ? pickupMethod : returnMethod,
                  method: sameReturnLocation ? pickupMethod : returnMethod,
                  officeId: sameReturnLocation
                    ? pickupMethod === "office"
                      ? pickupOfficeId
                      : null
                    : returnMethod === "office"
                      ? returnOfficeId
                      : null,
                  placeId: sameReturnLocation
                    ? pickupMethod === "delivery"
                      ? pickupPlaceId
                      : null
                    : returnMethod === "delivery"
                      ? returnPlaceId
                      : null,
                  address: sameReturnLocation
                    ? pickupMethod === "delivery"
                      ? String(placeInDetail || "").trim()
                      : undefined
                    : returnMethod === "delivery"
                      ? String(placeOutDetail || "").trim()
                      : undefined,
                  cityName: sameReturnLocation
                    ? pickupMethod === "delivery"
                      ? String(placeIn || "").trim()
                      : undefined
                    : returnMethod === "delivery"
                      ? String(placeOut || "").trim()
                      : undefined,
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
            } else if (quoteBody?.code === "RATE_LIMIT") {
              setLocationQuote(null);
            } else {
              setLocationQuote(quoteBody?.success === false ? quoteBody : null);
            }
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
  const pickupOfficeRef = useRef(null);
  const returnOfficeRef = useRef(null);
  const pickupAddressRef = useRef(null);
  const returnAddressRef = useRef(null);
  const locationInitKeyRef = useRef("");
  const returnDraftRef = useRef(null);

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
    if (!open) {
      locationInitKeyRef.current = "";
      return;
    }
    if (!coverageReady) return;
    if (String(coverage?.companyId || "") !== bookingCompanyId) return;
    const officeKey = displayOffices
      .map((office) => canonicalOfficeId(office))
      .filter(Boolean)
      .join(",");
    const initKey = `${bookingCompanyId}:${officeKey || "no-office"}:${deliveryAreaNames.join("|")}`;
    if (locationInitKeyRef.current === initKey) return;
    locationInitKeyRef.current = initKey;
    const storageKey = bookingCompanyId
      ? `booking-location:${bookingCompanyId}`
      : "";
    const savedPickup =
      typeof window !== "undefined" && storageKey
        ? localStorage.getItem(storageKey)
        : "";
    if (typeof window !== "undefined") {
      const stale = localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY);
      if (
        stale &&
        !deliveryAreaNames.some(
          (name) => name.toLowerCase() === String(stale).toLowerCase()
        )
      ) {
        localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
        localStorage.removeItem(SELECTED_RETURN_LOCATION_STORAGE_KEY);
      }
    }
    const allowedPickup = deliveryAreaNames.some(
      (name) => name.toLowerCase() === String(savedPickup || "").toLowerCase()
    )
      ? savedPickup
      : defaultBookingLocation;
    if (displayOffices.length) {
      const officeId = resolveSelectedOfficeId(displayOffices, "");
      const office = displayOffices.find(
        (row) => canonicalOfficeId(row) === officeId
      );
      setPickupMethod("office");
      setReturnMethod("office");
      setPickupOfficeId(officeId);
      setReturnOfficeId(officeId);
      setSameReturnLocation(true);
      setPickupPlaceId("");
      setReturnPlaceId("");
      if (office) {
        applyPlaceSelection(
          { value: office.name, kind: "office", address: office.address },
          "in"
        );
        applyPlaceSelection(
          { value: office.name, kind: "office", address: office.address },
          "out"
        );
      }
      return;
    }
    if (!deliveryAreaNames.length) {
      setPickupMethod("office");
      setReturnMethod("office");
      setPlaceIn("");
      setPlaceOut("");
      setPickupPlaceId("");
      setReturnPlaceId("");
      return;
    }
    const nextPickup = allowedPickup || "";
    setPickupMethod("delivery");
    setReturnMethod("delivery");
    setPlaceIn(nextPickup);
    setPlaceOut(nextPickup);
    if (storageKey && nextPickup && typeof window !== "undefined") {
      localStorage.setItem(storageKey, nextPickup);
    }
  }, [
    open,
    coverageReady,
    coverage?.companyId,
    bookingCompanyId,
    deliveryAreaNames,
    defaultBookingLocation,
    displayOffices,
    applyPlaceSelection,
  ]);

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
    // Mirrors resolveDrivingLicenceForCreate — server re-verifies the receipt.
    setLicenceSubmitAttempted(true);
    if (!licenceCaptureReady.ok) {
      newErrors.drivingLicence = t(
        licenceCaptureMessageKey(licenceCaptureReady.code),
        licenceCaptureReady.message
      );
    }
    const locationCheck = validateCustomerBookingLocation({
      pickupMethod,
      pickupOfficeId,
      pickupPlaceId,
      sameReturnLocation,
      returnMethod,
      returnOfficeId,
      returnPlaceId,
      pickupManualAddress:
        Boolean(placeInGeo?.manual) || isManualPlaceId(pickupPlaceId),
      pickupAddressText: placeInDetail,
      returnManualAddress:
        Boolean(placeOutGeo?.manual) || isManualPlaceId(returnPlaceId),
      returnAddressText: placeOutDetail,
    });
    if (!locationCheck.ok) {
      Object.assign(newErrors, locationCheck.errors);
    }
    const effective = locationCheck.location;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const focus =
        (newErrors.phone &&
          typeof document !== "undefined" &&
          document.querySelector('input[name="phone"], input[type="tel"]')) ||
        (newErrors.email &&
          typeof document !== "undefined" &&
          document.querySelector('input[name="email"], input[type="email"]')) ||
        (newErrors.name &&
          typeof document !== "undefined" &&
          document.querySelector('input[name="name"]')) ||
        (newErrors.placeIn && pickupOfficeRef.current) ||
        (newErrors.placeInDetail && pickupAddressRef.current) ||
        (newErrors.placeOut && returnOfficeRef.current) ||
        (newErrors.placeOutDetail && returnAddressRef.current) ||
        null;
      if (focus) {
        focus.scrollIntoView?.({ behavior: "smooth", block: "center" });
        if (typeof focus.focus === "function") {
          focus.focus();
        } else {
          const field = focus.querySelector?.("input, textarea, [tabindex]");
          field?.focus?.();
        }
      }
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
        placeIn: placeIn,
        placeOut: sameReturnLocation ? placeIn : placeOut,
        placeInDetail: effective.pickupMethod === "office" ? "" : String(placeInDetail || "").trim(),
        placeOutDetail: effective.returnMethod === "office" ? "" : String(placeOutDetail || "").trim(),
        pickupMethod: effective.pickupMethod,
        returnMethod: effective.returnMethod,
        sameReturnLocation: effective.sameReturnLocation,
        location: {
          pickup: {
            method: effective.pickupMethod,
            kind: effective.pickupMethod,
            officeId: effective.pickupOfficeId || null,
            placeId: effective.pickupPlaceId || null,
          },
          return: {
            method: effective.returnMethod,
            kind: effective.returnMethod,
            officeId: effective.returnOfficeId || null,
            placeId: effective.returnPlaceId || null,
            sameAsPickup: effective.sameReturnLocation,
          },
        },
        flightNumber: flightNumber,
        locale: lang || "en",
        termsAcceptance: termsState.payload,
        drivingLicence: {
          holderName: drivingLicence.holderName,
          licenceNumber: drivingLicence.licenceNumber,
          issuingCountry: drivingLicence.issuingCountry,
          expiryDate: drivingLicence.expiryDate,
          issueDate: drivingLicence.issueDate,
          // Opaque proof the upload landed. The browser never holds a storage URL.
          uploadReceipt: drivingLicence.uploadReceipt,
        },
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
          if (response.licenceCode) {
            setLicenceSubmitAttempted(true);
            setErrors({
              drivingLicence: t(
                licenceCaptureMessageKey(response.licenceCode),
                { defaultValue: response.message }
              ),
            });
          } else {
            setErrors({
              submit: response.messageKey
                ? t(response.messageKey, { defaultValue: response.message })
                : response.message,
            });
          }
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
    setDrivingLicence(emptyDrivingLicenceValue);
    setLicenceSubmitAttempted(false);
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

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={true}
      fullWidth
      maxWidth="md"
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
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                      gap: 2,
                      alignItems: "start",
                      width: "100%",
                      mb: { xs: 1, sm: 2 },
                      overflowX: "hidden",
                    }}
                  >
                    <BookingLocationSelector
                      mode="pickup"
                      fieldRef={pickupOfficeRef}
                      heading="Where would you like to pick up the car?"
                      dateField={
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
                      }
                      timeField={
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
                      }
                      method={pickupMethod}
                      onMethodChange={(next) => {
                        if (next === "delivery" && deliveryUnavailable) return;
                        switchLegMethod("in", next);
                      }}
                      offices={displayOffices}
                      selectedOfficeId={pickupOfficeId}
                      onSelectOffice={(office) =>
                        switchLegMethod("in", "office", office)
                      }
                      deliveryUnavailable={deliveryUnavailable}
                      deliveryUnavailableMessage="Delivery is not available for this vehicle. Please choose an office."
                      cityOptions={placeOptions}
                      cityValue={placeIn}
                      onCityChange={(newValue) => {
                        applyPlaceSelection(newValue, "in");
                        if (errors.placeIn) {
                          setErrors((prev) => {
                            const { placeIn: _p, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      cityReadOnly={deliveryAreaNames.length === 1}
                      locationDividerBefore={locationDividerBefore}
                      addressValue={placeInDetail}
                      onAddressChange={(next) => {
                        setPlaceInDetail(next);
                        setPlaceInGeo(null);
                        setPickupPlaceId("");
                        if (errors.placeInDetail) {
                          setErrors((prev) => {
                            const { placeInDetail: _d, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      onAddressResolved={(geo) => {
                        if (geo?.clearedWhileTyping) {
                          setPlaceInGeo(null);
                          setPickupPlaceId("");
                          return;
                        }
                        if (geo?.selectable === false || geo?.success === false) {
                          setPlaceInGeo(null);
                          setPickupPlaceId("");
                          if (geo?.message && !geo?.clearedWhileTyping) {
                            setErrors((prev) => ({
                              ...prev,
                              placeInDetail: geo.message,
                            }));
                          }
                          return;
                        }
                        setPlaceInGeo(geo);
                        setPickupPlaceId(geo?.placeId || "");
                        if (geo?.address) setPlaceInDetail(geo.address);
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.placeInDetail;
                          delete next.submit;
                          return next;
                        });
                      }}
                      addressCountry={placesCountry}
                      addressLanguage={lang}
                      companyId={car?.ownerId || company?._id}
                      carId={car?._id}
                      requireVerifiedPlace={spainSite}
                      allowManualFallback
                      officeError={pickupMethod === "office" ? errors.placeIn || "" : ""}
                      cityError={pickupMethod === "delivery" ? errors.placeIn || "" : ""}
                      addressError={
                        pickupMethod === "delivery" ? errors.placeInDetail || "" : ""
                      }
                      extraDeliveryFields={
                        placeIn && pickupMethod === "delivery" && isAirportLocation(placeIn) ? (
                          <BookingFlightField
                            label={t("order.flightNumber") || "Номер рейса"}
                            value={flightNumber}
                            onChange={(e) => setFlightNumber(e.target.value)}
                            sx={{ width: "100%", minWidth: 0 }}
                          />
                        ) : null
                      }
                    />
                    <BookingLocationSelector
                      mode="return"
                      fieldRef={returnOfficeRef}
                      showSameReturnCheckbox
                      sameReturnLocation={sameReturnLocation}
                      onSameReturnChange={(checked) => {
                        if (checked) {
                          returnDraftRef.current = {
                            returnMethod,
                            returnOfficeId,
                            returnPlaceId,
                            placeOut,
                            placeOutDetail,
                            placeOutGeo,
                          };
                          setSameReturnLocation(true);
                          setReturnMethod(pickupMethod);
                          setReturnOfficeId(pickupOfficeId);
                          setReturnPlaceId(pickupPlaceId);
                          setPlaceOut(placeIn);
                          setPlaceOutDetail(placeInDetail);
                          setPlaceOutGeo(placeInGeo);
                          return;
                        }
                        setSameReturnLocation(false);
                        const draft = returnDraftRef.current;
                        if (draft) {
                          setReturnMethod(draft.returnMethod || "office");
                          setReturnOfficeId(draft.returnOfficeId || "");
                          setReturnPlaceId(draft.returnPlaceId || "");
                          setPlaceOut(draft.placeOut || "");
                          setPlaceOutDetail(draft.placeOutDetail || "");
                          setPlaceOutGeo(draft.placeOutGeo || null);
                        } else {
                          setReturnMethod(pickupMethod);
                          setReturnOfficeId(pickupOfficeId);
                          setReturnPlaceId("");
                          setPlaceOut(placeIn);
                          setPlaceOutDetail("");
                          setPlaceOutGeo(null);
                        }
                      }}
                      sameReturnSummary={sameReturnSummary}
                      dateField={
                        <BookingDateField
                          label={t("order.returnDate") || "Дата возврата"}
                          value={formatValidBookingDate(
                            presetDates?.endDate,
                            "DD.MM.YYYY",
                            ""
                          )}
                          error={Boolean(errors.dates)}
                        />
                      }
                      timeField={
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
                      }
                      method={returnMethod}
                      onMethodChange={(next) => {
                        if (next === "delivery" && deliveryUnavailable) return;
                        switchLegMethod("out", next);
                      }}
                      offices={displayOffices}
                      selectedOfficeId={returnOfficeId}
                      onSelectOffice={(office) =>
                        switchLegMethod("out", "office", office)
                      }
                      deliveryUnavailable={deliveryUnavailable}
                      deliveryUnavailableMessage="Delivery is not available for this vehicle. Please choose an office."
                      cityOptions={placeOptions}
                      cityValue={placeOut}
                      onCityChange={(newValue) => {
                        applyPlaceSelection(newValue, "out");
                        if (errors.placeOut) {
                          setErrors((prev) => {
                            const { placeOut: _p, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      cityReadOnly={deliveryAreaNames.length === 1}
                      locationDividerBefore={locationDividerBefore}
                      addressValue={placeOutDetail}
                      onAddressChange={(next) => {
                        setPlaceOutDetail(next);
                        setPlaceOutGeo(null);
                        setReturnPlaceId("");
                        if (errors.placeOutDetail) {
                          setErrors((prev) => {
                            const { placeOutDetail: _d, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      onAddressResolved={(geo) => {
                        if (geo?.clearedWhileTyping) {
                          setPlaceOutGeo(null);
                          setReturnPlaceId("");
                          return;
                        }
                        if (geo?.selectable === false || geo?.success === false) {
                          setPlaceOutGeo(null);
                          setReturnPlaceId("");
                          if (geo?.message && !geo?.clearedWhileTyping) {
                            setErrors((prev) => ({
                              ...prev,
                              placeOutDetail: geo.message,
                            }));
                          }
                          return;
                        }
                        setPlaceOutGeo(geo);
                        setReturnPlaceId(geo?.placeId || "");
                        if (geo?.address) setPlaceOutDetail(geo.address);
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.placeOutDetail;
                          delete next.submit;
                          return next;
                        });
                      }}
                      addressCountry={placesCountry}
                      addressLanguage={lang}
                      companyId={car?.ownerId || company?._id}
                      carId={car?._id}
                      requireVerifiedPlace={spainSite}
                      allowManualFallback
                      officeError={returnMethod === "office" ? errors.placeOut || "" : ""}
                      cityError={returnMethod === "delivery" ? errors.placeOut || "" : ""}
                      addressError={
                        returnMethod === "delivery" ? errors.placeOutDetail || "" : ""
                      }
                    />
                  </Box>
                  {locationQuote?.success === false && locationQuote.message ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      {locationQuote.message}
                    </Typography>
                  ) : null}
                  <BookingPriceDetails
                    summary={daysAndTotal}
                    parts={priceParts}
                    split={spainSite ? marketplaceSplit : null}
                    pickupMethod={pickupMethod}
                    returnMethod={sameReturnLocation ? pickupMethod : returnMethod}
                    pickupVerified={
                      pickupMethod === "office" || Boolean(pickupPlaceId)
                    }
                    returnVerified={
                      (sameReturnLocation ? pickupMethod : returnMethod) ===
                        "office" ||
                      Boolean(sameReturnLocation ? pickupPlaceId : returnPlaceId)
                    }
                  />
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
                  <DrivingLicenceCaptureField
                    value={drivingLicence}
                    onChange={(next) => {
                      setDrivingLicence(next);
                      if (errors.drivingLicence) {
                        setErrors((prev) => ({ ...prev, drivingLicence: undefined }));
                      }
                    }}
                    disabled={isSubmitting}
                    showErrors={licenceSubmitAttempted}
                    serverErrorKey=""
                  />
                  {errors.drivingLicence && (
                    <Typography color="error" variant="body2">
                      {errors.drivingLicence}
                    </Typography>
                  )}
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
