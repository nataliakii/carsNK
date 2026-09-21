"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Divider, Grow, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import DialogLayout from "@/app/components/ui/modals/DialogLayout";
import FilterLocationAutocomplete from "@/app/components/ui/inputs/FilterLocationAutocomplete";
import SelectedFieldClass from "@/app/components/ui/inputs/SelectedFieldClass";
import BookingTimeField from "@/app/components/ui/inputs/BookingTimeField";
import { useMainContext } from "../Context";
import { useCompanyBookingLocations } from "@/app/hooks/useCompanyBookingLocations";
import { getSiteCountryCode } from "@config/siteCountry";
import {
  isSpainBookingSite,
  resolveCatalogPlaceOptions,
} from "@/domain/orders/catalogPlaceOptions";
import { normalizeBookingTimeHm } from "@/domain/orders/locationOptions";

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

const fieldSx = {
  width: "100%",
  "& .MuiInputBase-root": {
    height: 40,
    borderRadius: "10px",
  },
};

function formatFilterValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultBookingTime(stored, companyValue, fallback) {
  return (
    normalizeBookingTimeHm(stored) ||
    normalizeBookingTimeHm(companyValue) ||
    fallback
  );
}

function CatalogPlaceField({
  name,
  label,
  options,
  value,
  onChange,
  spainSite,
  emptyOptionLabel,
}) {
  if (spainSite) {
    return (
      <FilterLocationAutocomplete
        name={name}
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        emptyOptionLabel={emptyOptionLabel}
        variant="light"
      />
    );
  }
  return (
    <SelectedFieldClass
      name={name}
      label={label}
      options={options}
      value={value}
      handleChange={onChange}
      includeAllOption={false}
      emptyOptionLabel={emptyOptionLabel}
      formatMenuItemLabel={(opt) => opt}
      variant="light"
    />
  );
}

function FilterRow({ label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "flex-start", sm: "baseline" },
        justifyContent: "space-between",
        gap: { xs: 0.25, sm: 2 },
        py: 0.75,
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
        sx={{ fontWeight: 700, textAlign: { xs: "left", sm: "right" } }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Catalog booking-context editor: pickup/return place, dates, and times.
 * Apply writes the same context + storage as the Navbar / BookingModal.
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
    setBookingPlaceIn,
    bookingPlaceOut,
    setBookingPlaceOut,
    bookingTimeIn,
    setBookingTimeIn,
    bookingTimeOut,
    setBookingTimeOut,
    searchDates,
    setSearchDates,
    clearSearchDates,
    company,
  } = useMainContext();

  const { names: companyBookingLocationOptions } = useCompanyBookingLocations(
    company?._id
  );
  const spainSite = isSpainBookingSite(getSiteCountryCode());
  const bookingLocationOptions = useMemo(
    () =>
      resolveCatalogPlaceOptions(
        companyBookingLocationOptions,
        getSiteCountryCode()
      ),
    [companyBookingLocationOptions]
  );

  const [draftPickup, setDraftPickup] = useState("");
  const [draftReturn, setDraftReturn] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [draftPickupTime, setDraftPickupTime] = useState("10:00");
  const [draftReturnTime, setDraftReturnTime] = useState("10:00");

  useEffect(() => {
    if (!open) return;
    setDraftPickup(bookingPlaceIn?.trim() || "");
    setDraftReturn(bookingPlaceOut?.trim() || "");
    setDraftStart(searchDates?.start || "");
    setDraftEnd(searchDates?.end || "");
    setDraftPickupTime(
      defaultBookingTime(bookingTimeIn, company?.defaultStart, "10:00")
    );
    setDraftReturnTime(
      defaultBookingTime(bookingTimeOut, company?.defaultEnd, "10:00")
    );
  }, [open]); // snapshot when the dialog opens

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
  const hasFilters = Boolean(
    classValue || transmissionValue || seatsValue || searchQuery
  );

  const datesIncomplete = Boolean(draftStart) !== Boolean(draftEnd);
  const datesOutOfOrder = Boolean(
    draftStart && draftEnd && draftEnd < draftStart
  );
  const applyDisabled = datesIncomplete || datesOutOfOrder;

  const handlePlaceChange = (setter) => (eventOrValue) => {
    const next =
      eventOrValue && typeof eventOrValue === "object" && eventOrValue.target
        ? eventOrValue.target.value
        : eventOrValue;
    setter(next ?? "");
  };

  const handleApply = () => {
    if (applyDisabled) return;
    setBookingPlaceIn(draftPickup);
    setBookingPlaceOut(draftReturn);
    setBookingTimeIn(draftPickupTime);
    setBookingTimeOut(draftReturnTime);
    if (draftStart && draftEnd) {
      setSearchDates({ start: draftStart, end: draftEnd });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      }
    } else {
      clearSearchDates();
    }
    onClose();
  };

  const handleCancel = (event, reason) => {
    onClose(event, reason);
  };

  const emptyLocationLabel = t("header.locationNotSet");
  const minStart = todayDateKey();

  return (
    <DialogLayout
      open={open}
      onClose={handleCancel}
      title={t("catalog.bookingDetailsTitle")}
      maxWidth="sm"
      closeOnBackdropClick
      closeOnEscape
      TransitionComponent={BookingContextDialogTransition}
      transitionDuration={BOOKING_CONTEXT_DIALOG_TRANSITION}
      TransitionProps={{
        easing: {
          enter: "cubic-bezier(0, 0, 0.2, 1)",
          exit: "cubic-bezier(0.4, 0, 1, 1)",
        },
        style: { transformOrigin: "center center" },
      }}
      contentSx={{ px: { xs: 2, sm: 3 }, pt: 1, pb: 1 }}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: 2,
          m: { xs: 1, sm: 2 },
          width: { xs: "calc(100% - 16px)", sm: "auto" },
          maxHeight: { xs: "95vh", sm: "90vh" },
        },
      }}
      actions={
        <>
          <Button
            variant="outlined"
            onClick={handleCancel}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "10px",
              px: 2,
            }}
          >
            {t("catalog.bookingDetailsCancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={applyDisabled}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "10px",
              px: 2.25,
              boxShadow: "none",
            }}
          >
            {t("catalog.bookingDetailsApply")}
          </Button>
        </>
      }
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          handleApply();
        }}
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          m: 0,
        }}
      >
        {bookingLocationOptions.length > 0 ? (
          <>
            <CatalogPlaceField
              name="pickupLocation"
              label={t("catalog.bookingDetailsPickup")}
              options={bookingLocationOptions}
              value={draftPickup}
              onChange={handlePlaceChange(setDraftPickup)}
              spainSite={spainSite}
              emptyOptionLabel={emptyLocationLabel}
            />
            <CatalogPlaceField
              name="returnLocation"
              label={t("catalog.bookingDetailsReturn")}
              options={bookingLocationOptions}
              value={draftReturn}
              onChange={handlePlaceChange(setDraftReturn)}
              spainSite={spainSite}
              emptyOptionLabel={emptyLocationLabel}
            />
          </>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 1.5,
          }}
        >
          <TextField
            size="small"
            type="date"
            name="searchStart"
            label={t("header.searchFrom")}
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: minStart,
              "aria-label": t("header.searchFrom"),
            }}
            error={datesOutOfOrder}
            sx={fieldSx}
          />
          <TextField
            size="small"
            type="date"
            name="searchEnd"
            label={t("header.searchTo")}
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{
              min: draftStart || minStart,
              "aria-label": t("header.searchTo"),
            }}
            error={datesOutOfOrder}
            sx={fieldSx}
          />
          <BookingTimeField
            label={t("order.pickupTime")}
            value={draftPickupTime}
            onChange={(e) =>
              setDraftPickupTime(
                normalizeBookingTimeHm(e.target.value) || draftPickupTime
              )
            }
            sx={fieldSx}
            fullWidth
          />
          <BookingTimeField
            label={t("order.returnTime")}
            value={draftReturnTime}
            onChange={(e) =>
              setDraftReturnTime(
                normalizeBookingTimeHm(e.target.value) || draftReturnTime
              )
            }
            sx={fieldSx}
            fullWidth
          />
        </Box>

        {draftStart || draftEnd ? (
          <Button
            type="button"
            size="small"
            onClick={() => {
              setDraftStart("");
              setDraftEnd("");
            }}
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              fontWeight: 600,
              px: 0,
              minWidth: 0,
            }}
          >
            {t("header.clearSearchDates")}
          </Button>
        ) : null}

        {deliveryHint || deliveryNote ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "left", lineHeight: 1.45 }}
          >
            {deliveryHint || deliveryNote}
          </Typography>
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
              <FilterRow
                label={t("catalog.bookingDetailsClass")}
                value={classValue}
              />
            ) : null}
            {transmissionValue ? (
              <FilterRow
                label={t("catalog.bookingDetailsTransmission")}
                value={transmissionValue}
              />
            ) : null}
            {seatsValue ? (
              <FilterRow
                label={t("catalog.bookingDetailsSeats")}
                value={seatsValue}
              />
            ) : null}
            {searchQuery ? (
              <FilterRow
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
