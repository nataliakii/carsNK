"use client";

import React from "react";
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Link as MuiLink,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { googleMapsSearchUrl } from "@/domain/orders/carOffices";
import { canonicalOfficeId } from "@/domain/orders/bookingLocationSelection";

const TYPE_KEYS = {
  office: "order.officeTypeOffice",
  airport: "order.officeTypeAirport",
  train_station: "order.officeTypeStation",
  port: "order.officeTypePort",
  hotel: "order.officeTypeHotel",
  other: "order.officeTypeOther",
};

export default function BookingOfficeDeliveryChoice({
  method,
  onMethodChange,
  offices = [],
  selectedOfficeId,
  onSelectOffice,
  officeLabel,
  deliveryLabel,
  disabled = false,
  deliveryDisabled = false,
  deliveryDisabledMessage = "",
  error = "",
  fieldRef = null,
}) {
  const { t } = useTranslation();
  if (!offices.length) return null;

  const selectedId = String(selectedOfficeId || "");

  return (
    <Box ref={fieldRef} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {offices.map((office) => {
        const mapsUrl = googleMapsSearchUrl(office);
        const officeId = canonicalOfficeId(office);
        const selected = method === "office" && Boolean(selectedId) && officeId === selectedId;
        const typeLabel = t(TYPE_KEYS[office.locationType] || TYPE_KEYS.office);
        const instructions =
          office.collectionInstructions || office.returnInstructions || "";
        return (
          <Box
            key={officeId}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (disabled) return;
              onMethodChange?.("office");
              onSelectOffice?.(office);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onMethodChange?.("office");
                onSelectOffice?.(office);
              }
            }}
            sx={{
              border: "1px solid",
              borderColor: selected ? "success.main" : "divider",
              borderRadius: 1.5,
              px: 1.25,
              py: 1,
              bgcolor: selected ? "rgba(46, 125, 50, 0.06)" : "background.paper",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.3 }}
              >
                {office.name}
              </Typography>
              <Chip
                size="small"
                label={typeLabel}
                sx={{ height: 20, fontSize: "0.65rem" }}
              />
              <Chip
                size="small"
                color="success"
                label={t("order.officeFreeBadge")}
                sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
              />
            </Box>
            {office.address ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", lineHeight: 1.35, mt: 0.25 }}
              >
                {office.address}
              </Typography>
            ) : null}
            {office.addressUnset ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", lineHeight: 1.35, mt: 0.25 }}
              >
                {t("order.officeAddressNotSet")}
              </Typography>
            ) : null}
            {instructions ? (
              <Typography
                variant="caption"
                sx={{ display: "block", lineHeight: 1.35, mt: 0.35 }}
              >
                {instructions}
              </Typography>
            ) : null}
            {mapsUrl && !office.addressUnset ? (
              <MuiLink
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                sx={{ fontSize: "0.72rem", fontWeight: 600, display: "inline-block", mt: 0.5 }}
              >
                {t("order.openInGoogleMaps")}
              </MuiLink>
            ) : null}
          </Box>
        );
      })}

      <RadioGroup
        value={method}
        onChange={(e) => {
          const next = e.target.value;
          onMethodChange(next);
          if (next === "office" && offices.length === 1 && onSelectOffice) {
            onSelectOffice(offices[0]);
          }
        }}
      >
        <FormControlLabel
          value="office"
          disabled={disabled}
          control={<Radio size="small" />}
          label={
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
              {officeLabel}
            </Typography>
          }
          sx={{ m: 0, alignItems: "center" }}
        />
        <FormControlLabel
          value="delivery"
          disabled={disabled || deliveryDisabled}
          control={<Radio size="small" />}
          label={
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
              {deliveryLabel}
            </Typography>
          }
          sx={{ m: 0, alignItems: "center" }}
        />
      </RadioGroup>
      {error ? (
        <Typography variant="caption" color="error" sx={{ lineHeight: 1.35 }}>
          {error}
        </Typography>
      ) : null}
      {deliveryDisabled && deliveryDisabledMessage ? (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
          {deliveryDisabledMessage}
        </Typography>
      ) : null}
    </Box>
  );
}
