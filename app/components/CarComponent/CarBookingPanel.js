"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography, styled } from "@mui/material";
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

const BookSlot = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  paddingLeft: theme.spacing(0.5),
  paddingRight: theme.spacing(0.5),
}));

const BookFace = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(0.5),
  lineHeight: theme.typography.body1.lineHeight,
}));

const BookWord = styled("span")(({ theme }) => ({
  fontFamily: theme.typography.button.fontFamily,
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.button.fontSize,
  letterSpacing: theme.typography.button.letterSpacing,
  lineHeight: theme.typography.button.lineHeight,
}));

const PriceLine = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
  gap: theme.spacing(0.5),
}));

const ApproxWord = styled("span")(({ theme }) => ({
  fontSize: theme.typography.caption.fontSize,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: theme.typography.overline.letterSpacing,
  textTransform: "uppercase",
  lineHeight: theme.typography.caption.lineHeight,
}));

const PriceWord = styled("span")(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.subtitle1.fontSize,
  lineHeight: theme.typography.subtitle1.lineHeight,
}));

const StatusLine = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "tone",
})(({ theme, tone }) => ({
  textAlign: "center",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.body2.fontSize,
  color:
    tone === "error" ? theme.palette.error.main : theme.palette.text.secondary,
}));

/**
 * Search-card booking column. A complete range shows BOOK! above the month
 * title, with the approximate total from the existing price action.
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
    const dateKey = `${panel.start}|${panel.end}`;
    setQuote({ status: "checking", priceKind, rangeKey: dateKey });
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
        next.rangeKey = dateKey;
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
          rangeKey: dateKey,
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
      previousTotalRef.current = null;
      if (next.start && next.end) {
        setQuote({
          status: "checking",
          priceKind,
          rangeKey: `${next.start}|${next.end}`,
        });
      } else {
        setQuote({ status: "idle" });
      }
    },
    [setSearchDates, priceKind]
  );

  const clearDates = useCallback(() => {
    const next = reduceBookingPanel(panelRef.current, { type: "clear" });
    setPanel(next);
    setSearchDates({ start: null, end: null });
    previousTotalRef.current = null;
    setQuote({ status: "idle" });
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

      {view.showBook ? (
        <BookSlot>
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
          >
            <BookFace>
              <BookWord data-testid="book-label">{view.bookLabel}</BookWord>
              {view.showPrice ? (
                <PriceLine data-testid="booking-price">
                  {view.showApprox ? (
                    <ApproxWord data-testid="price-approx">approx.</ApproxWord>
                  ) : null}
                  <PriceWord>{view.platePriceText}</PriceWord>
                </PriceLine>
              ) : null}
            </BookFace>
          </GradientBookButton>
        </BookSlot>
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

      {view.statusText ? (
        <StatusLine
          data-testid="availability-status"
          tone={
            view.status === "unavailable" || view.status === "error"
              ? "error"
              : "neutral"
          }
        >
          {view.statusText}
        </StatusLine>
      ) : null}
    </Box>
  );
}
