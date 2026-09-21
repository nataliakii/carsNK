"use client";

import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  googleMapsSearchUrl,
} from "@/domain/orders/carOffices";
import { emptyCompanyOffice } from "@/domain/company/companyOffices";
import AddressPlacesAutocomplete from "@/app/components/ui/inputs/AddressPlacesAutocomplete";
import {
  adminFieldSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";

export default function CompanyOfficesEditor({
  offices = [],
  onChange,
  country,
  disabled = false,
}) {
  const { t } = useTranslation();
  const list = Array.isArray(offices) && offices.length ? offices : [emptyCompanyOffice()];

  const updateAt = (index, patch) => {
    const next = list.map((office, i) =>
      i === index ? { ...office, ...patch } : office
    );
    onChange?.(next);
  };

  const addOffice = () => {
    onChange?.([...list, emptyCompanyOffice()]);
  };

  const removeOffice = (index) => {
    if (list.length <= 1) {
      onChange?.([emptyCompanyOffice()]);
      return;
    }
    onChange?.(list.filter((_, i) => i !== index));
  };

  return (
    <Stack gap={2}>
      {list.map((office, index) => {
        const mapsUrl = googleMapsSearchUrl(office);
        return (
          <Box
            key={`${office.name || "office"}-${index}`}
            sx={{
              p: 1.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "grey.50",
              overflow: "visible",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1.5}
              alignItems={{ sm: "flex-start" }}
            >
              <TextField
                size="small"
                label={t("companyProfile.officeName")}
                value={office.name || ""}
                onChange={(e) => updateAt(index, { name: e.target.value })}
                disabled={disabled}
                sx={adminFieldSx}
              />
              {list.length > 1 || office.address || office.lat ? (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => removeOffice(index)}
                  disabled={disabled}
                  sx={{
                    textTransform: "none",
                    mt: { sm: 0.5 },
                    ...adminReadableTextSx,
                  }}
                >
                  {t("companyProfile.removeOffice")}
                </Button>
              ) : null}
            </Stack>

            <Box sx={{ mt: 1.5 }}>
              <AddressPlacesAutocomplete
                value={office.address || ""}
                country={country}
                disabled={disabled}
                label={t("companyProfile.officeAddress")}
                placeholder={t("companyProfile.officeAddressPlaceholder")}
                onChange={(address) => updateAt(index, { address })}
                onResolved={({ address, lat, lon }) =>
                  updateAt(index, {
                    address,
                    lat: lat || office.lat,
                    lon: lon || office.lon,
                  })
                }
              />
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 1.25,
                mb: 0.75,
                ...adminReadableTextSx,
              }}
            >
              {t("companyProfile.officeCoordsFallback")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label={t("companyProfile.officeLat")}
                value={office.lat || ""}
                onChange={(e) => updateAt(index, { lat: e.target.value })}
                disabled={disabled}
                sx={adminFieldSx}
              />
              <TextField
                size="small"
                label={t("companyProfile.officeLng")}
                value={office.lon || office.lng || ""}
                onChange={(e) => updateAt(index, { lon: e.target.value })}
                disabled={disabled}
                sx={adminFieldSx}
              />
            </Box>

            {mapsUrl ? (
              <Chip
                component="a"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                clickable
                size="small"
                label={t("order.openInGoogleMaps")}
                sx={{ mt: 1.5, textTransform: "none" }}
              />
            ) : null}
          </Box>
        );
      })}

      <Button
        size="small"
        variant="outlined"
        onClick={addOffice}
        disabled={disabled}
        sx={{ alignSelf: "flex-start", textTransform: "none", ...adminReadableTextSx }}
      >
        {t("companyProfile.addOffice")}
      </Button>
    </Stack>
  );
}
