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

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Box, Collapse, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { getSiteCountryCode } from "@config/siteCountry";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";
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
import { useActiveCalendarCar } from "@/app/hooks/useActiveCalendarCar";
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

const CalendarToggle = styled("button")(({ theme }) => ({
  width: "100%",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: "transparent",
  color: theme.palette.text.secondary,
  paddingBlock: theme.spacing(0.75),
  paddingInline: theme.spacing(1.5),
  fontFamily: theme.typography.body2.fontFamily,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  lineHeight: theme.typography.body2.lineHeight,
  cursor: "pointer",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
}));

const CalendarSlot = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "hidden",
  boxSizing: "border-box",
  borderRadius: Number(theme.shape.borderRadius) * 2,
}));

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function CarBookingPanel({
  car,
  orders = [],
  onContinue,
  searchRequest = null,
  onQuote,
}) {
  const { t, i18n } = useTranslation();
  const { bookingPlaceIn, bookingPlaceOut } = useMainContext();
  const { activeCarId, toggleCalendar } = useActiveCalendarCar();

  const carId = String(car?._id || car?.carNumber || car?.regNumber || "");
  const mode = resolvePublicBookingMode(searchRequest);
  const isSearchFirst = mode === BOOKING_MODE.SEARCH_FIRST;
  const locale = (i18n?.language || "en").split("-")[0];

  const placeIn = bookingPlaceIn?.trim() || "";
  const placeOut = bookingPlaceOut?.trim() || "";
  const insurance = resolveDefaultInsurance(car);
  const priceKind =
    isSpainBookingSite(getSiteCountryCode()) && (placeIn || placeOut)
      ? "estimated"
      : "rental";

  const calendarOpen = !isSearchFirst && activeCarId === carId;

  // One source of truth for blocked days: the grid paints them and the
  // selection reducer refuses to cross them. Deriving this in two places is
  // how a range could be committed straight through a booked day.
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
    today: todayKey(),
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
    enabled: isSearchFirst,
  });

  const start = isSearchFirst
    ? searchRequest?.startDate || null
    : carCalendar.state.startDate;
  const end = isSearchFirst
    ? searchRequest?.endDate || null
    : carCalendar.state.endDate;
  const quote = isSearchFirst ? searchQuote.quote : carCalendar.state.quote;
  const quoteStatus = isSearchFirst
    ? searchQuote.status
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

  const handleRetry = isSearchFirst ? searchQuote.retry : carCalendar.retryQuote;

  // Report the SEARCH_FIRST total upwards for result ordering only. The grid
  // never reads it back into this card, so it cannot become shared state.
  const reportedRef = useRef("");
  useEffect(() => {
    if (!isSearchFirst || searchQuote.status !== "ready") return;
    const key = `${searchQuote.quote?.quoteId || ""}`;
    if (reportedRef.current === key) return;
    reportedRef.current = key;
    onQuote?.(carId, searchQuote.quote);
  }, [isSearchFirst, searchQuote.status, searchQuote.quote, carId, onQuote]);

  return (
    <Root data-testid="car-booking-panel" data-mode={mode} data-car-id={carId}>
      <BookingCtaPanel view={view} onBook={handleBook} onRetry={handleRetry} />

      {isSearchFirst ? null : (
        <>
          <CalendarToggle
            type="button"
            onClick={() => toggleCalendar(carId)}
            aria-expanded={calendarOpen}
            aria-controls={`car-calendar-${carId}`}
            data-testid="calendar-toggle"
          >
            {calendarOpen
              ? t("catalog.booking.hideCalendar", { defaultValue: "Hide calendar" })
              : t("catalog.booking.showCalendar", {
                  defaultValue: "Check availability",
                })}
          </CalendarToggle>

          {/* Kept mounted so toggling never resets this car's selection. */}
          <Collapse in={calendarOpen} unmountOnExit={false} timeout="auto">
            <CalendarSlot id={`car-calendar-${carId}`} data-testid="booking-calendar">
              <CalendarPicker
                carId={car?._id}
                car={car}
                unavailableDates={unavailableDates}
                selectedStart={carCalendar.state.startDate}
                selectedEnd={carCalendar.state.endDate}
                displayMonth={carCalendar.state.displayMonth}
                onSelectDay={carCalendar.selectDate}
                onMonthChange={carCalendar.setMonth}
                onClearSelection={carCalendar.clear}
              />
            </CalendarSlot>
          </Collapse>
        </>
      )}
    </Root>
  );
}
