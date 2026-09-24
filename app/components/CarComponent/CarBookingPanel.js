"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useMainContext } from "@app/Context";
import { calculateTotalPrice } from "@utils/action";
import { normalizeSearchDates } from "@utils/carDateSearch";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";
import { getSiteCountryCode } from "@config/siteCountry";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import {
  buildCarBookingPanelView,
  reduceBookingPanel,
} from "@/domain/booking/carBookingPanel";
import CalendarPicker from "./CalendarPicker";

function quoteStatusFromResult(result, previousTotal) {
  if (!result || result.ok === false) {
    return {
      status: "error",
      totalPrice: null,
      days: null,
      message: result?.error || "Could not check availability",
    };
  }
  if (result.available === false) {
    return {
      status: "unavailable",
      totalPrice: null,
      days: result.days ?? null,
      message: "Not available for these dates",
    };
  }
  const total = Number(result.totalPrice);
  const changed =
    previousTotal != null &&
    Number.isFinite(total) &&
    Number(previousTotal) !== total;
  return {
    status: changed ? "priceChanged" : "available",
    totalPrice: total,
    days: result.days,
    message: "",
  };
}

/**
 * One booking summary for a car. Reads pickup/return dates from the shared
 * search state (search bar, URL, and this panel all write the same values).
 */
export default function CarBookingPanel({ car, orders = [], onContinue }) {
  const {
    searchDates,
    setSearchDates,
    bookingPlaceIn,
    bookingPlaceOut,
  } = useMainContext();

  const canonical = normalizeSearchDates(searchDates);
  const [panel, setPanel] = useState(() =>
    reduceBookingPanel(
      { start: canonical.start, end: canonical.end, editing: false },
      { type: "externalDates", start: canonical.start, end: canonical.end }
    )
  );
  const [quote, setQuote] = useState({ status: "idle" });
  const previousTotalRef = useRef(null);
  const [rangeMessage, setRangeMessage] = useState("");
  const panelRef = useRef(panel);
  panelRef.current = panel;

  useEffect(() => {
    setPanel((prev) => {
      if (prev.start === canonical.start && prev.end === canonical.end) {
        return prev;
      }
      return reduceBookingPanel(prev, {
        type: "externalDates",
        start: canonical.start,
        end: canonical.end,
      });
    });
  }, [canonical.start, canonical.end]);

  const priceKind =
    isSpainBookingSite(getSiteCountryCode()) &&
    Boolean(bookingPlaceIn?.trim() || bookingPlaceOut?.trim())
      ? "estimated"
      : "rental";

  useEffect(() => {
    if (!panel.start || !panel.end) {
      setQuote({ status: "idle" });
      previousTotalRef.current = null;
      return;
    }

    let current = true;
    const abort = new AbortController();
    setQuote({ status: "checking", priceKind });
    const dateKey = `${panel.start}|${panel.end}`;
    const previous = previousTotalRef.current;
    const previousTotal =
      previous?.key === dateKey ? previous.total : null;
    const carApiIdentifier =
      car?._id?.toString?.() || car?.carNumber || car?.regNumber || "";

    calculateTotalPrice(
      carApiIdentifier,
      panel.start,
      panel.end,
      resolveDefaultInsurance(car),
      0,
      {
        signal: abort.signal,
        placeIn: bookingPlaceIn?.trim() || undefined,
        placeOut: bookingPlaceOut?.trim() || undefined,
      }
    )
      .then((result) => {
      if (!current) return;
      const next = quoteStatusFromResult(result, previousTotal);
      next.priceKind = priceKind;
      if (next.status === "available" || next.status === "priceChanged") {
        previousTotalRef.current = { key: dateKey, total: next.totalPrice };
      }
      if (next.status === "unavailable") {
        setPanel((prev) => reduceBookingPanel(prev, { type: "unavailable" }));
      }
      setQuote(next);
    })
      .catch(() => {
        if (!current) return;
        setQuote({
          status: "error",
          message: "Could not check availability",
          priceKind,
        });
      });

    return () => {
      current = false;
      abort.abort();
    };
  }, [
    panel.start,
    panel.end,
    car,
    bookingPlaceIn,
    bookingPlaceOut,
    priceKind,
  ]);

  const view = buildCarBookingPanelView({
    start: panel.start,
    end: panel.end,
    editing: panel.editing,
    quote,
  });

  const commitDates = useCallback(
    (start, end) => {
      const next = reduceBookingPanel(panelRef.current, {
        type: "commit",
        start,
        end,
      });
      setPanel(next);
      setSearchDates({ start: next.start, end: next.end });
    },
    [setSearchDates]
  );

  const clearDates = useCallback(() => {
    const next = reduceBookingPanel(panelRef.current, { type: "clear" });
    setPanel(next);
    setSearchDates({ start: null, end: null });
  }, [setSearchDates]);

  const cancelEdit = useCallback(() => {
    const next = reduceBookingPanel(panelRef.current, { type: "cancel" });
    setPanel(next);
    setSearchDates({ start: next.start, end: next.end });
  }, [setSearchDates]);

  useEffect(() => {
    if (!view.calendarOpen || !view.hasDates) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") cancelEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.calendarOpen, view.hasDates, cancelEdit]);

  return (
    <Box
      data-testid="car-booking-panel"
      style={{ overflowX: "hidden", maxWidth: "100%" }}
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1,
      }}
    >
      {view.showChooseDates ? (
        <Typography
          component="h2"
          data-testid="choose-dates"
          sx={{ fontWeight: 700, textAlign: "center" }}
        >
          Choose your dates
        </Typography>
      ) : (
        <Box data-testid="booking-summary" sx={{ textAlign: "center" }}>
          <Typography
            data-testid="availability-status"
            sx={{ fontWeight: 700, color: view.status === "unavailable" ? "error.main" : "success.main" }}
          >
            {view.statusText}
          </Typography>
          {view.dateRangeLabel ? (
            <Typography data-testid="booking-dates" sx={{ fontWeight: 700, mt: 0.5 }}>
              {view.dateRangeLabel}
            </Typography>
          ) : null}
          {view.durationLabel ? (
            <Typography data-testid="booking-duration" color="text.secondary">
              {view.durationLabel}
            </Typography>
          ) : null}
          {view.showPrice ? (
            <Box data-testid="booking-price" sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {view.priceCaption}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "1.35rem" }}>
                {view.priceText}
              </Typography>
            </Box>
          ) : null}
          <Button
            variant="contained"
            fullWidth
            data-testid="continue-booking"
            data-start={view.canonicalStart || ""}
            data-end={view.canonicalEnd || ""}
            disabled={view.continueDisabled}
            onClick={() =>
              onContinue?.({
                start: view.canonicalStart,
                end: view.canonicalEnd,
              })
            }
            sx={{ mt: 1.5 }}
          >
            {view.continueLabel}
          </Button>
          <Button
            variant="text"
            data-testid="change-dates"
            onClick={() =>
              setPanel((prev) => reduceBookingPanel(prev, { type: "changeDates" }))
            }
          >
            Change dates
          </Button>
        </Box>
      )}

      {view.calendarOpen ? (
        <Box data-testid="booking-calendar" sx={{ width: "100%", minWidth: 0, overflowX: "hidden" }}>
          <CalendarPicker
            carId={car?._id}
            car={car}
            orders={orders}
            embedded
            presetSearchDates={
              view.hasDates ? { start: panel.start, end: panel.end } : null
            }
            setBookedDates={() => {}}
            onRangeCommitted={({ start, end }) => {
              setRangeMessage("");
              commitDates(start, end);
            }}
            onSelectionCleared={() => {
              setRangeMessage("");
              clearDates();
            }}
            onUnavailableRange={() => {
              setRangeMessage("Not available for these dates");
              setPanel((prev) => reduceBookingPanel(prev, { type: "unavailable" }));
            }}
          />
          {rangeMessage ? (
            <Typography data-testid="range-error" color="error" sx={{ textAlign: "center" }}>
              {rangeMessage}
            </Typography>
          ) : null}
          {view.hasDates ? (
            <Button
              variant="text"
              data-testid="cancel-date-change"
              onClick={cancelEdit}
            >
              Cancel date change
            </Button>
          ) : null}
          {view.hasDates ? (
            <Button variant="text" data-testid="clear-dates" onClick={clearDates}>
              Clear dates
            </Button>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
