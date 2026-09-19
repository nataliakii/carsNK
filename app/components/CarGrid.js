"use client";
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from "react";
import { Grid, Container, Typography, Box, Chip } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import { useMainContext } from "../Context";
import CarItemComponent from "./CarComponent/CarItemComponent";
import { carMatchesSearchQuery } from "@utils/carSearch";
import {
  carMatchesRegionFilter,
  isCarAvailableForSearchDates,
} from "@utils/carDateSearch";
import { calculateTotalPrice } from "@utils/action";
import dayjs from "dayjs";

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
    selectedRegion,
    ownerIdsByRegion,
    searchDates,
    ordersByCarId,
    company,
    platform,
  } = useMainContext();
  const deferredSearchQuery = useDeferredValue(carSearchQuery || "");

  const skipScrollOnFilterMount = useRef(true);
  const hasActiveDateSearch = Boolean(searchDates?.start && searchDates?.end);

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
    selectedRegion,
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
        const regionOk = carMatchesRegionFilter(
          selectedRegion,
          car.ownerId,
          ownerIdsByRegion
        );
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
          regionOk &&
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
    selectedRegion,
    ownerIdsByRegion,
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

  // Fetch prices for date search results (reuse calcTotalPrice API).
  useEffect(() => {
    if (!hasActiveDateSearch || filteredCars.length === 0) {
      setPricesByCarId({});
      setPricesLoading(false);
      return;
    }

    let cancelled = false;
    const abort = new AbortController();
    setPricesLoading(true);
    const carsSnapshot = filteredCars;

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
            "TPL",
            0,
            {
              signal: abort.signal,
              placeIn:
                selectedRegion && selectedRegion !== "All"
                  ? selectedRegion
                  : undefined,
              placeOut:
                selectedRegion && selectedRegion !== "All"
                  ? selectedRegion
                  : undefined,
            }
          );
          if (result?.ok !== false && result?.totalPrice != null) {
            next[String(car._id)] = {
              totalPrice: result.totalPrice,
              days: result.days,
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
    selectedRegion,
  ]);

  const noCarsMatchFilters =
    Array.isArray(cars) && cars.length > 0 && filteredCars.length === 0;

  return (
    <Container sx={{ mt: 5 }}>
      <Section>
        {hasActiveDateSearch && (
          <Box sx={{ mb: 2, px: 1 }}>
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
            {selectedRegion && selectedRegion !== "All" ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t("catalog.searchRegionLabel", { region: selectedRegion })}
              </Typography>
            ) : null}
          </Box>
        )}
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
            return (
              <Grid item xs={12} sx={{ padding: 2 }} key={car._id}>
                {hasActiveDateSearch && (priceInfo || pricesLoading) ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      mb: 1,
                    }}
                  >
                    <Chip
                      color="primary"
                      variant="outlined"
                      label={
                        priceInfo
                          ? t("catalog.searchPriceLabel", {
                              price: priceInfo.totalPrice,
                              days: priceInfo.days,
                            })
                          : t("basic.loading")
                      }
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                ) : null}
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
