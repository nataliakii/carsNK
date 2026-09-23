"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from "react";
import { Grid, Container, Typography, Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { useMainContext } from "../Context";
import CarItemComponent from "./CarComponent/CarItemComponent";
import { carMatchesSearchQuery } from "@utils/carSearch";
import { isCarAvailableForSearchDates } from "@utils/carDateSearch";
import { calculateTotalPrice } from "@utils/action";
import dayjs from "dayjs";
import { getSiteCountryCode } from "@config/siteCountry";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";

const Section = styled("section")(({ theme }) => ({
  backgroundColor: "transparent",
  textAlign: "center",
}));

function CarGrid() {
  const { t } = useTranslation();
  const {
    cars,
    selectedClass,
    selectedTransmission,
    selectedSeats,
    carSearchQuery,
    bookingPlaceIn,
    bookingPlaceOut,
    searchDates,
    ordersByCarId,
    company,
    platform,
  } = useMainContext();
  const deferredSearchQuery = useDeferredValue(carSearchQuery || "");

  const skipScrollOnFilterMount = useRef(true);
  const hasActiveDateSearch = Boolean(searchDates?.start && searchDates?.end);
  const spainSite = isSpainBookingSite(getSiteCountryCode());
  const hasSelectedCities = Boolean(
    bookingPlaceIn?.trim() || bookingPlaceOut?.trim()
  );
  const showDeliveryWithDatesNote =
    spainSite && hasSelectedCities && hasActiveDateSearch;

  useEffect(() => {
    if (skipScrollOnFilterMount.current) {
      skipScrollOnFilterMount.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [
    selectedClass,
    selectedTransmission,
    selectedSeats,
    deferredSearchQuery,
    bookingPlaceIn,
    bookingPlaceOut,
    searchDates?.start,
    searchDates?.end,
  ]);

  // --- Состояния для скидки ---
  const [discount, setDiscount] = useState(null);
  const [discountStart, setDiscountStart] = useState(null);
  const [discountEnd, setDiscountEnd] = useState(null);
  const [pricesByCarId, setPricesByCarId] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const fetchDiscount = useCallback(async () => {
    try {
      const res = await fetch("/api/discount");
      if (!res.ok) throw new Error("Ошибка загрузки скидки");
      const data = await res.json();
      setDiscount(data.discount || null);
      setDiscountStart(data.startDate ? dayjs(data.startDate) : null);
      setDiscountEnd(data.endDate ? dayjs(data.endDate) : null);
    } catch (err) {
      // Ошибка загрузки скидки - тихо игнорируем
    }
  }, []);

  useEffect(() => {
    let timer;
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      timer = window.requestIdleCallback(
        () => {
          fetchDiscount().catch(() => {});
        },
        { timeout: 2000 }
      );
    } else {
      timer = setTimeout(() => {
        fetchDiscount().catch(() => {});
      }, 100);
    }

    return () => {
      if (
        typeof window !== "undefined" &&
        window.requestIdleCallback &&
        typeof timer === "number"
      ) {
        window.cancelIdleCallback(timer);
      } else if (typeof timer !== "undefined") {
        clearTimeout(timer);
      }
    };
  }, [fetchDiscount]);

  const filteredCars = useMemo(() => {
    return cars
      .filter((car) => {
        const seatCount =
          typeof car.seats === "number" && Number.isFinite(car.seats)
            ? car.seats
            : null;
        const seatsOk =
          selectedSeats === "All" ||
          (seatCount != null && String(seatCount) === selectedSeats);
        const datesOk =
          !hasActiveDateSearch ||
          isCarAvailableForSearchDates({
            orders: ordersByCarId(car._id),
            start: searchDates.start,
            end: searchDates.end,
            company,
            platform,
          });
        return (
          (selectedClass === "All" || car.class === selectedClass) &&
          (selectedTransmission === "All" ||
            car.transmission === selectedTransmission) &&
          seatsOk &&
          datesOk &&
          carMatchesSearchQuery(car, deferredSearchQuery)
        );
      })
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [
    selectedClass,
    selectedTransmission,
    selectedSeats,
    deferredSearchQuery,
    hasActiveDateSearch,
    searchDates?.start,
    searchDates?.end,
    cars,
    ordersByCarId,
    company,
    platform,
  ]);

  const filteredCarIdsKey = useMemo(
    () => filteredCars.map((c) => String(c._id)).join(","),
    [filteredCars]
  );

  const pickupForPricing = bookingPlaceIn?.trim() || undefined;
  const returnForPricing = bookingPlaceOut?.trim() || undefined;

  // Fetch prices for date search results (reuse calcTotalPrice API).
  useEffect(() => {
    if (!hasActiveDateSearch || filteredCars.length === 0) {
      setPricesByCarId({});
      setPricesLoading(false);
      return;
    }

    let cancelled = false;
    const abort = new AbortController();
    // Clear immediately so a prior search (e.g. 2 days) never shows under new dates.
    setPricesByCarId({});
    setPricesLoading(true);
    const carsSnapshot = filteredCars;
    const searchStartKey = dayjs(searchDates.start).format("YYYY-MM-DD");
    const searchEndKey = dayjs(searchDates.end).format("YYYY-MM-DD");

    (async () => {
      const next = {};
      for (const car of carsSnapshot) {
        if (cancelled) return;
        const carApiIdentifier =
          car?._id?.toString?.() || car?.carNumber || car?.regNumber || "";
        if (!carApiIdentifier) continue;
        try {
          const result = await calculateTotalPrice(
            carApiIdentifier,
            searchDates.start,
            searchDates.end,
            resolveDefaultInsurance(car),
            0,
            {
              signal: abort.signal,
              placeIn: pickupForPricing,
              placeOut: returnForPricing,
            }
          );
          if (result?.ok !== false && result?.totalPrice != null) {
            next[String(car._id)] = {
              totalPrice: result.totalPrice,
              days: result.days,
              startKey: searchStartKey,
              endKey: searchEndKey,
            };
          }
        } catch {
          // Skip failed price for one car
        }
      }
      if (!cancelled) {
        setPricesByCarId(next);
        setPricesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [
    hasActiveDateSearch,
    filteredCarIdsKey,
    searchDates?.start,
    searchDates?.end,
    pickupForPricing,
    returnForPricing,
  ]);

  const noCarsMatchFilters =
    Array.isArray(cars) && cars.length > 0 && filteredCars.length === 0;

  const showLocationSummary =
    hasActiveDateSearch && (bookingPlaceIn?.trim() || bookingPlaceOut?.trim());

  return (
    <Container
      sx={{
        // Breathing room for results/meta copy between chrome clearance and cards
        pt: { xs: 1.5, sm: 2 },
        pb: 2,
      }}
    >
      <Section>
        {hasActiveDateSearch ? (
          <Box
            sx={{
              mb: { xs: 2.5, sm: 3 },
              px: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.75,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: "text.primary" }}
            >
              {t("catalog.searchResultsTitle", {
                from: dayjs(searchDates.start).format("DD.MM.YYYY"),
                to: dayjs(searchDates.end).format("DD.MM.YYYY"),
                count: filteredCars.length,
              })}
            </Typography>
            {showLocationSummary ? (
              <Typography variant="body2" color="text.secondary">
                {t("catalog.searchLocationsLabel", {
                  pickup:
                    bookingPlaceIn?.trim() ||
                    t("catalog.locationNotSet"),
                  return:
                    bookingPlaceOut?.trim() ||
                    t("catalog.locationNotSet"),
                })}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        <Grid
          container
          spacing={{ sm: 2, sx: 0.4 }}
          direction="column"
          sx={{ alignItems: "center", alignContent: "center" }}
        >
          {noCarsMatchFilters ? (
            <Grid item xs={12} sx={{ py: 4, px: 2, maxWidth: 560 }}>
              <Typography
                component="p"
                variant="body1"
                role="status"
                aria-live="polite"
                sx={{
                  color: "text.secondary",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {hasActiveDateSearch
                  ? t("catalog.noCarsMatchDateSearch")
                  : t("catalog.noCarsMatchFilters")}
              </Typography>
            </Grid>
          ) : null}
          {filteredCars?.map((car, index) => {
            const priceInfo = pricesByCarId[String(car._id)];
            const searchStartKey = hasActiveDateSearch
              ? dayjs(searchDates.start).format("YYYY-MM-DD")
              : null;
            const searchEndKey = hasActiveDateSearch
              ? dayjs(searchDates.end).format("YYYY-MM-DD")
              : null;
            const priceMatchesSearch =
              priceInfo &&
              priceInfo.startKey === searchStartKey &&
              priceInfo.endKey === searchEndKey;
            const showSearchPricePill =
              hasActiveDateSearch && (priceMatchesSearch || pricesLoading);
            const showApproxBadge = showDeliveryWithDatesNote;

            return (
              <Grid item xs={12} sx={{ padding: 2, width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }} key={car._id}>
                <CarItemComponent
                  car={car}
                  discount={discount}
                  discountStart={discountStart}
                  discountEnd={discountEnd}
                  isFirstCar={index === 0}
                  presetSearchDates={
                    hasActiveDateSearch
                      ? {
                          start: searchDates.start,
                          end: searchDates.end,
                        }
                      : null
                  }
                  searchPrice={
                    showSearchPricePill
                      ? {
                          loading: !priceMatchesSearch,
                          totalPrice: priceMatchesSearch
                            ? priceInfo.totalPrice
                            : null,
                          days: priceMatchesSearch ? priceInfo.days : null,
                          showApprox: showApproxBadge,
                        }
                      : null
                  }
                />
              </Grid>
            );
          })}
        </Grid>
      </Section>
    </Container>
  );
}

export default CarGrid;
