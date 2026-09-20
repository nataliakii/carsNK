"use client";

import React, { useMemo, useState } from "react";
import { Box, Button, Divider, Grow, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import DialogLayout from "@/app/components/ui/modals/DialogLayout";
import { useMainContext } from "../Context";

/** Same soft fade + scale as BookingModal (~280ms enter). */
const BookingContextDialogTransition = React.forwardRef(
  function BookingContextDialogTransition(props, ref) {
    return <Grow ref={ref} {...props} />;
  }
);

const BOOKING_CONTEXT_DIALOG_TRANSITION = {
  enter: 280,
  exit: 200,
};

function formatFilterValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Catalog search stores YYYY-MM-DD only. Show a time only when context
 * actually carries one (not midnight on a date-only key).
 */
function formatSearchTime(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }
  const d = dayjs(value);
  if (!d.isValid()) return null;
  const time = d.format("HH:mm");
  if (time === "00:00") return null;
  return time;
}

function focusCatalogFilter(target) {
  if (typeof document === "undefined") return;
  const bar = document.getElementById("catalog-filters");
  if (bar) {
    bar.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const selectors = {
    dates: 'input[name="searchStart"]',
    pickup: "#pickupLocation, input[name='pickupLocation']",
    return: "#returnLocation, input[name='returnLocation']",
    search: 'input[name="carSearch"]',
  };
  const el = document.querySelector(selectors[target] || selectors.dates);
  if (!el || typeof el.focus !== "function") return;
  window.setTimeout(() => {
    el.focus();
  }, 50);
}

function DetailRow({ label, value, muted = false, stacked = false }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: stacked ? "column" : { xs: "column", sm: "row" },
        alignItems: stacked
          ? "flex-start"
          : { xs: "flex-start", sm: "baseline" },
        justifyContent: "space-between",
        gap: stacked ? 0.5 : { xs: 0.25, sm: 2 },
        py: 1,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 600, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          fontWeight: muted ? 500 : 700,
          color: muted ? "text.secondary" : "text.primary",
          textAlign: stacked ? "left" : { xs: "left", sm: "right" },
          lineHeight: 1.45,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Search/booking context sheet — not the per-car BookingModal.
 * Lists pickup/return, dates, delivery notes, and active filters. No prices.
 */
export default function BookingContextDetailsDialog({
  open,
  onClose,
  deliveryHint = "",
  deliveryNote = "",
}) {
  const { t } = useTranslation();
  const {
    selectedClass,
    selectedTransmission,
    selectedSeats,
    carSearchQuery,
    bookingPlaceIn,
    bookingPlaceOut,
    searchDates,
  } = useMainContext();

  const [focusAfterClose, setFocusAfterClose] = useState(null);

  const hasActiveDateSearch = Boolean(searchDates?.start && searchDates?.end);
  const pickup = bookingPlaceIn?.trim() || "";
  const dropoff = bookingPlaceOut?.trim() || "";
  const searchQuery = String(carSearchQuery || "").trim();
  const classValue =
    selectedClass && selectedClass !== "All"
      ? formatFilterValue(selectedClass)
      : "";
  const transmissionValue =
    selectedTransmission && selectedTransmission !== "All"
      ? formatFilterValue(selectedTransmission)
      : "";
  const seatsValue =
    selectedSeats && selectedSeats !== "All"
      ? t("header.seatsOption", { count: Number(selectedSeats) })
      : "";

  const dateLabel = useMemo(() => {
    if (!hasActiveDateSearch) return null;
    return t("catalog.bookingDetailsDateRange", {
      from: dayjs(searchDates.start).format("DD.MM.YYYY"),
      to: dayjs(searchDates.end).format("DD.MM.YYYY"),
    });
  }, [hasActiveDateSearch, searchDates?.start, searchDates?.end, t]);

  const timeLabel = useMemo(() => {
    const startTime = formatSearchTime(searchDates?.start);
    const endTime = formatSearchTime(searchDates?.end);
    if (!startTime && !endTime) return null;
    if (startTime && endTime) {
      return t("catalog.bookingDetailsTimeRange", {
        from: startTime,
        to: endTime,
      });
    }
    return startTime || endTime;
  }, [searchDates?.start, searchDates?.end, t]);

  const hasFilters = Boolean(
    classValue || transmissionValue || seatsValue || searchQuery
  );

  const resolveFocusTarget = () => {
    if (!hasActiveDateSearch) return "dates";
    if (!pickup) return "pickup";
    return "dates";
  };

  const handleEditFilters = () => {
    setFocusAfterClose(resolveFocusTarget());
    onClose();
  };

  const handleDialogClose = (event, reason) => {
    onClose(event, reason);
  };

  return (
    <DialogLayout
      open={open}
      onClose={handleDialogClose}
      title={t("catalog.bookingDetailsTitle")}
      maxWidth="sm"
      closeOnBackdropClick
      closeOnEscape
      disableRestoreFocus={Boolean(focusAfterClose)}
      TransitionComponent={BookingContextDialogTransition}
      transitionDuration={BOOKING_CONTEXT_DIALOG_TRANSITION}
      TransitionProps={{
        onExited: () => {
          if (!focusAfterClose) return;
          focusCatalogFilter(focusAfterClose);
          setFocusAfterClose(null);
        },
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
      actions={
        <>
          <Button
            variant="outlined"
            onClick={handleEditFilters}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "10px",
              px: 2,
            }}
          >
            {t("catalog.bookingDetailsEdit")}
          </Button>
          <Button
            variant="contained"
            onClick={handleDialogClose}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "10px",
              px: 2.25,
              boxShadow: "none",
            }}
          >
            {t("catalog.bookingDetailsClose")}
          </Button>
        </>
      }
    >
      <Box sx={{ m: 0 }}>
        <DetailRow
          label={t("catalog.bookingDetailsPickup")}
          value={pickup || t("catalog.locationNotSet")}
          muted={!pickup}
        />
        <DetailRow
          label={t("catalog.bookingDetailsReturn")}
          value={dropoff || t("catalog.locationNotSet")}
          muted={!dropoff}
        />
        <DetailRow
          label={t("catalog.bookingDetailsDates")}
          value={
            dateLabel ||
            (deliveryHint
              ? t("catalog.locationNotSet")
              : t("catalog.bookingDetailsDatesEmpty"))
          }
          muted={!dateLabel}
        />
        {timeLabel ? (
          <DetailRow
            label={t("catalog.bookingDetailsTimes")}
            value={timeLabel}
          />
        ) : null}
        {deliveryHint || deliveryNote ? (
          <DetailRow
            label={t("catalog.bookingDetailsDelivery")}
            value={deliveryHint || deliveryNote}
            muted
            stacked
          />
        ) : null}
      </Box>

      {hasFilters ? (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, mb: 0.5, textAlign: "left" }}
          >
            {t("catalog.bookingDetailsFilters")}
          </Typography>
          <Box sx={{ m: 0 }}>
            {classValue ? (
              <DetailRow
                label={t("catalog.bookingDetailsClass")}
                value={classValue}
              />
            ) : null}
            {transmissionValue ? (
              <DetailRow
                label={t("catalog.bookingDetailsTransmission")}
                value={transmissionValue}
              />
            ) : null}
            {seatsValue ? (
              <DetailRow
                label={t("catalog.bookingDetailsSeats")}
                value={seatsValue}
              />
            ) : null}
            {searchQuery ? (
              <DetailRow
                label={t("catalog.bookingDetailsSearch")}
                value={searchQuery}
              />
            ) : null}
          </Box>
        </>
      ) : null}
    </DialogLayout>
  );
}
