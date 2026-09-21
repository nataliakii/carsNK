"use client";

import React from "react";
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { googleMapsSearchUrl } from "@/domain/orders/carOffices";

export default function BookingOfficeDeliveryChoice({
  method,
  onMethodChange,
  offices = [],
  selectedOfficeName,
  onSelectOffice,
  officeLabel,
  deliveryLabel,
  disabled = false,
}) {
  const { t } = useTranslation();
  if (!offices.length) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {offices.map((office) => {
        const mapsUrl = googleMapsSearchUrl(office);
        const selected =
          method === "office" &&
          String(office.name) === String(selectedOfficeName || offices[0].name);
        return (
          <Box
            key={office.name}
            sx={{
              border: "1px solid",
              borderColor: selected ? "success.main" : "divider",
              borderRadius: 1.5,
              px: 1.25,
              py: 1,
              bgcolor: selected ? "rgba(46, 125, 50, 0.06)" : "background.paper",
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.3 }}
            >
              {office.name}
            </Typography>
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
            {mapsUrl && !office.addressUnset ? (
              <MuiLink
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
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
          if (next === "office" && onSelectOffice) {
            const match =
              offices.find((o) => o.name === selectedOfficeName) || offices[0];
            onSelectOffice(match);
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
          disabled={disabled}
          control={<Radio size="small" />}
          label={
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
              {deliveryLabel}
            </Typography>
          }
          sx={{ m: 0, alignItems: "center" }}
        />
      </RadioGroup>
    </Box>
  );
}
