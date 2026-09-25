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
  // Scroll to top for class/transmission/location/text filters only — not when
  // searchDates change from a car card (shared global range).
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
  ]);

  // --- Состояния для скидки ---
  const [discount, setDiscount] = useState(null);
  const [discountStart, setDiscountStart] = useState(null);
  const [discountEnd, setDiscountEnd] = useState(null);
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
            return (
              <Grid item xs={12} sx={{ padding: 2, width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }} key={car._id}>
                <CarItemComponent
                  car={car}
                  discount={discount}
                  discountStart={discountStart}
                  discountEnd={discountEnd}
                  isFirstCar={index === 0}
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
