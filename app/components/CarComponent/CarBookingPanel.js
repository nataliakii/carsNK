"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
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
import GradientBookButton from "@/app/components/ui/buttons/GradientBookButton";
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
 * Search-card booking column: mini calendar always visible + breathing
 * Approx/price plate that becomes Book on hover.
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
  const [hovered, setHovered] = useState(false);
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
          sx={{ fontWeight: 700, textAlign: "center", fontSize: "0.95rem" }}
        >
          Choose your dates
        </Typography>
      ) : null}

      {view.showPrice ? (
        <Box sx={{ display: "flex", justifyContent: "center", px: 0.5 }}>
          <GradientBookButton
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
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            aria-label={hovered ? view.bookHoverLabel : view.platePriceText}
            sx={{
              minWidth: { xs: "160px", sm: "200px" },
              fontSize: "1.05rem",
              py: 1.1,
            }}
          >
            {hovered ? (
              <Box component="span" data-testid="book-hover-label">
                {view.bookHoverLabel}
              </Box>
            ) : (
              <Box
                data-testid="booking-price"
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 0.55,
                  lineHeight: 1.15,
                }}
              >
                {view.showApprox ? (
                  <Box
                    component="span"
                    data-testid="price-approx"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      opacity: 0.9,
                    }}
                  >
                    approx.
                  </Box>
                ) : null}
                <Box component="span" sx={{ fontWeight: 800, fontSize: "1.15rem" }}>
                  {view.platePriceText}
                </Box>
              </Box>
            )}
          </GradientBookButton>
        </Box>
      ) : null}

      {view.statusText ? (
        <Typography
          data-testid="availability-status"
          sx={{
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.85rem",
            color:
              view.status === "unavailable" || view.status === "error"
                ? "error.main"
                : "text.secondary",
          }}
        >
          {view.statusText}
        </Typography>
      ) : null}

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
      </Box>
    </Box>
  );
}
