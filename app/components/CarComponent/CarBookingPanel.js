"use client";

/**
 * Booking column of one public car card.
 *
 * Ownership, deliberately:
 *   - SEARCH_FIRST reads the immutable header search request and prices this
 *     car for it. No calendar is rendered in a result card.
 *   - CAR_FIRST owns this car's draft dates inside `calendarStateByCarId`,
 *     keyed by the stable `_id`. Nothing here writes a date into global state,
 *     which is what used to copy one car's range into every other card.
 */

import React, { useCallback, useMemo } from "react";
import { Box, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { getSiteCountryCode } from "@config/siteCountry";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";
import { resolveBusinessTimezone } from "@/domain/time/resolveBusinessTimezone";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  calculateAvailableTimes,
  extractArraysOfStartEndConfPending,
} from "@/domain/calendar";
import { buildCarBookingPanelView } from "@/domain/booking/carBookingPanel";
import {
  BOOKING_MODE,
  buildBookingDraft,
  resolvePublicBookingMode,
} from "@/domain/booking/publicBookingMode";
import { useCarCalendar } from "@/app/hooks/useCarCalendar";
import { useSearchFirstQuote } from "@/app/hooks/useSearchFirstQuote";
import BookingCtaPanel from "@/app/components/ui/booking/BookingCtaPanel";
import CalendarPicker from "./CalendarPicker";

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(1),
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  // The mini calendar must never widen the card or the document.
  overflowX: "hidden",
}));

const CalendarSlot = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "hidden",
  boxSizing: "border-box",
  borderRadius: Number(theme.shape.borderRadius) * 2,
}));

dayjs.extend(utc);
dayjs.extend(timezone);

function todayKeyInZone(tz) {
  return dayjs().tz(tz || dayjs.tz.guess()).format("YYYY-MM-DD");
}

export default function CarBookingPanel({
  car,
  orders = [],
  onContinue,
  searchRequest = null,
  catalogQuote,
}) {
  const { i18n } = useTranslation();
  const { bookingPlaceIn, bookingPlaceOut, company, platform } = useMainContext();

  const carId = String(car?._id || car?.carNumber || car?.regNumber || "");
  const mode = resolvePublicBookingMode(searchRequest);
  const isSearchFirst = mode === BOOKING_MODE.SEARCH_FIRST;
  const locale = (i18n?.language || "en").split("-")[0];

  const placeIn = bookingPlaceIn?.trim() || "";
  const placeOut = bookingPlaceOut?.trim() || "";
  const insurance = resolveDefaultInsurance(car);
  const calendarTz = resolveBusinessTimezone({
    company,
    countryCode: company?.country || platform?.country,
    platformSettings: platform,
    forNewOrder: true,
  });
  const today = todayKeyInZone(calendarTz);
  const priceKind =
    isSpainBookingSite(getSiteCountryCode()) && (placeIn || placeOut)
      ? "estimated"
      : "rental";

  const { unavailableDates, startEndDates } = useMemo(() => {
    const { unavailable, confirmed, startEnd } =
      extractArraysOfStartEndConfPending(orders);
    return {
      unavailableDates: Array.from(
        new Set([...(confirmed || []), ...(unavailable || [])])
      ),
      startEndDates: startEnd || [],
    };
  }, [orders]);

  // CAR_FIRST: this car's own draft range, month and quote.
  const carCalendar = useCarCalendar({
    carId,
    unavailableDates,
    today,
    placeIn,
    placeOut,
    insurance,
    // A car with no dates never requests anything, so an unopened calendar is
    // silent by construction. Gating on `calendarOpen` instead would strand
    // the CTA on "Calculating price…" if the card is collapsed mid-flight.
    enabled: !isSearchFirst,
  });

  // SEARCH_FIRST: this car priced for the shared, immutable search request.
  const searchQuote = useSearchFirstQuote({
    carId,
    startDate: searchRequest?.startDate || null,
    endDate: searchRequest?.endDate || null,
    placeIn,
    placeOut,
    insurance,
    enabled: isSearchFirst && catalogQuote === undefined,
  });

  const start = isSearchFirst
    ? searchRequest?.startDate || null
    : carCalendar.state.startDate;
  const end = isSearchFirst
    ? searchRequest?.endDate || null
    : carCalendar.state.endDate;
  const quote = isSearchFirst
    ? catalogQuote !== undefined
      ? catalogQuote?.quote
      : searchQuote.quote
    : carCalendar.state.quote;
  const quoteStatus = isSearchFirst
    ? catalogQuote !== undefined
      ? catalogQuote?.status || "idle"
      : searchQuote.status
    : carCalendar.state.quoteStatus;

  const view = useMemo(
    () =>
      buildCarBookingPanelView({
        start,
        end,
        quote,
        quoteStatus,
        priceKind,
        locale,
      }),
    [start, end, quote, quoteStatus, priceKind, locale]
  );

  const handleBook = useCallback(() => {
    const draft = buildBookingDraft({
      sourceMode: mode,
      carId,
      startDate: view.canonicalStart,
      endDate: view.canonicalEnd,
      quoteId: view.quoteId,
    });
    if (!draft) return;
    // Pickup/return clamps when a neighbouring confirmed rental ends on the
    // start day or begins on the end day. Derived from this car's orders only.
    const { availableStart, availableEnd } = calculateAvailableTimes(
      startEndDates,
      draft.startDate,
      draft.endDate
    );
    onContinue?.({
      ...draft,
      boundaryTimes: { start: availableStart, end: availableEnd },
    });
  }, [
    mode,
    carId,
    view.canonicalStart,
    view.canonicalEnd,
    view.quoteId,
    onContinue,
    startEndDates,
  ]);

  const handleRetry =
    isSearchFirst && catalogQuote === undefined
      ? searchQuote.retry
      : isSearchFirst
        ? undefined
        : carCalendar.retryQuote;

  return (
    <Root data-testid="car-booking-panel" data-mode={mode} data-car-id={carId}>
      <BookingCtaPanel view={view} onBook={handleBook} onRetry={handleRetry} />

      {isSearchFirst ? null : (
        <CalendarSlot id={`car-calendar-${carId}`} data-testid="booking-calendar">
          <CalendarPicker
            carId={car?._id}
            car={car}
            orders={orders}
            embedded
            setBookedDates={() => {}}
            onRangeCommitted={({ start, end }) => {
              carCalendar.selectDate(start);
              carCalendar.selectDate(end);
            }}
            onSelectionCleared={carCalendar.clear}
          />
        </CalendarSlot>
      )}
    </Root>
  );
}
