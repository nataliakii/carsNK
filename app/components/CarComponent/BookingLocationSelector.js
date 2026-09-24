"use client";

import React from "react";
import {
  Box,
  Checkbox,
  FormControlLabel,
  Radio,
  Typography,
  Link as MuiLink,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { googleMapsSearchUrl } from "@/domain/orders/carOffices";
import { canonicalOfficeId } from "@/domain/orders/bookingLocationSelection";
import { BookingAddressPlacesField, BookingLocationAutocomplete } from "@/app/components/ui/inputs";

const TYPE_KEYS = {
  office: "order.officeTypeOffice",
  airport: "order.officeTypeAirport",
  train_station: "order.officeTypeStation",
  port: "order.officeTypePort",
  hotel: "order.officeTypeHotel",
  other: "order.officeTypeOther",
};

const ACCENT = "var(--color-text-accent, #c2185b)";
const ACCENT_BG = "rgba(194, 24, 91, 0.06)";

function MethodSegment({ selected, disabled, title, subtitle, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        flex: 1,
        minWidth: 0,
        textAlign: "left",
        border: "1.5px solid",
        borderColor: selected ? ACCENT : "divider",
        bgcolor: selected ? ACCENT_BG : "background.paper",
        borderRadius: 1.5,
        px: 1.25,
        py: 1.1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        m: 0,
        font: "inherit",
        color: "inherit",
      }}
    >
      <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, lineHeight: 1.3 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

function OfficeCard({ office, selected, onSelect, freeLabel }) {
  const { t } = useTranslation();
  const mapsUrl = googleMapsSearchUrl(office);
  const typeLabel = t(TYPE_KEYS[office.locationType] || TYPE_KEYS.office);
  return (
    <Box
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "flex-start",
        border: "1.5px solid",
        borderColor: selected ? ACCENT : "divider",
        bgcolor: selected ? ACCENT_BG : "background.paper",
        borderRadius: 1.5,
        px: 1.25,
        py: 1,
        cursor: "pointer",
      }}
    >
      <Radio
        checked={selected}
        size="small"
        tabIndex={-1}
        sx={{ p: 0.25, mt: 0.1, color: selected ? ACCENT : undefined }}
        inputProps={{ "aria-hidden": true }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.3 }}>
            {office.name}
          </Typography>
          <Chip size="small" label={typeLabel} sx={{ height: 18, fontSize: "0.62rem" }} />
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "success.main" }}>
            {freeLabel}
          </Typography>
        </Box>
        {office.address ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.35 }}>
            {office.address}
          </Typography>
        ) : null}
        {mapsUrl && !office.addressUnset ? (
          <MuiLink
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{ fontSize: "0.72rem", fontWeight: 600, display: "inline-block", mt: 0.4 }}
          >
            View map
          </MuiLink>
        ) : null}
      </Box>
    </Box>
  );
}

/**
 * Shared pick-up / return location block used twice in the booking modal.
 */
export default function BookingLocationSelector({
  mode = "pickup",
  heading,
  dateField,
  timeField,
  method,
  onMethodChange,
  offices = [],
  selectedOfficeId,
  onSelectOffice,
  deliveryUnavailable = false,
  deliveryUnavailableMessage = "",
  cityOptions = [],
  cityValue = "",
  onCityChange,
  cityReadOnly = false,
  locationDividerBefore,
  addressValue = "",
  onAddressChange,
  onAddressResolved,
  addressCountry,
  addressLanguage,
  companyId,
  carId,
  requireVerifiedPlace = false,
  addressError = "",
  officeError = "",
  cityError = "",
  sameReturnLocation = false,
  onSameReturnChange,
  sameReturnSummary = "",
  showSameReturnCheckbox = false,
  fieldRef = null,
  extraDeliveryFields = null,
}) {
  const { t } = useTranslation();
  const isPickup = mode === "pickup";
  const officeTitle = isPickup
    ? "Pick up at an office — Free"
    : "Return at an office — Free";
  const deliveryTitle = isPickup
    ? "Deliver to an address"
    : "Collect from an address";
  const selectedId = String(selectedOfficeId || "");
  const hideLocationControls = showSameReturnCheckbox && sameReturnLocation;

  return (
    <Box
      ref={fieldRef}
      data-testid={`booking-location-${mode}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        minWidth: 0,
        width: "100%",
      }}
    >
      {dateField}
      {timeField}
      {showSameReturnCheckbox ? (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={sameReturnLocation}
              onChange={(e) => onSameReturnChange?.(e.target.checked)}
            />
          }
          label={
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
              Return to the same location
            </Typography>
          }
          sx={{ m: 0 }}
        />
      ) : null}
      {hideLocationControls ? (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            px: 1.25,
            py: 1,
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
            Return location
          </Typography>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.35 }}>
            {sameReturnSummary || "Same as pick-up"}
          </Typography>
        </Box>
      ) : (
        <>
          {heading ? (
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.35 }}>
              {heading}
            </Typography>
          ) : null}
          <Box sx={{ display: "flex", gap: 1, width: "100%" }} role="group">
            <MethodSegment
              selected={method === "office"}
              disabled={!offices.length}
              title={officeTitle}
              onClick={() => onMethodChange?.("office")}
            />
            <MethodSegment
              selected={method === "delivery"}
              disabled={deliveryUnavailable}
              title={deliveryTitle}
              subtitle={deliveryUnavailable ? deliveryUnavailableMessage : ""}
              onClick={() => {
                if (!deliveryUnavailable) onMethodChange?.("delivery");
              }}
            />
          </Box>
          {method === "office" ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }} role="radiogroup">
              {offices.map((office) => {
                const officeId = canonicalOfficeId(office);
                return (
                  <OfficeCard
                    key={officeId || office.name}
                    office={office}
                    selected={Boolean(selectedId) && officeId === selectedId}
                    onSelect={() => onSelectOffice?.(office)}
                    freeLabel="Free"
                  />
                );
              })}
              {officeError ? (
                <Typography variant="caption" color="error">
                  {officeError}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {method === "delivery" && !deliveryUnavailable ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <BookingLocationAutocomplete
                label={isPickup ? t("order.pickupLocation") : t("order.returnLocation")}
                options={cityOptions}
                freeSolo={false}
                readOnly={cityReadOnly}
                dividerBeforeOption={locationDividerBefore}
                value={cityValue}
                onChange={(_, newValue) => onCityChange?.(newValue)}
                error={Boolean(cityError)}
                helperText={cityError || ""}
                sx={{ width: "100%", minWidth: 0 }}
              />
              {cityValue ? (
                <BookingAddressPlacesField
                  label={t("order.hotelOrAddress", { defaultValue: "Hotel or street address" })}
                  value={addressValue}
                  country={addressCountry}
                  language={addressLanguage}
                  cityBias={cityValue}
                  companyId={companyId}
                  carId={carId}
                  requireVerifiedPlace={requireVerifiedPlace}
                  onChange={onAddressChange}
                  onResolved={onAddressResolved}
                  error={Boolean(addressError)}
                  helperText={addressError || ""}
                />
              ) : null}
              {extraDeliveryFields}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
