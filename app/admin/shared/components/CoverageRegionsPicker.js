"use client";

import {
  Box,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  COMUNITAT_VALENCIANA_CITIES,
  addRegionCities,
  coverageRegionsForCountry,
  extrasWithoutHub,
  regionMatchState,
  removeRegionCities,
  toggleRegionCities,
} from "@/domain/geo/spainCoverageRegions";
import { normalizeSpainCitySearchText } from "@/domain/orders/spainCityOptions";
import {
  cityComunaForName,
  comunaMatchState,
  comunaTownsForCity,
  selectedComunaHubs,
  toggleComunaTowns,
} from "@/domain/geo/spainCityComunas";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";

const REGION_COPY = {
  "barcelona-metro": {
    label: "coverageRegionBarcelonaMetro",
  },
  "costa-brava": {
    label: "coverageRegionCostaBrava",
  },
  "comunitat-valenciana": {
    label: "coverageRegionValencianCommunity",
  },
  "alicante-province": {
    label: "coverageRegionAlicanteProvince",
  },
  "comunidad-madrid": {
    label: "coverageRegionMadridCommunity",
  },
  "costa-del-sol": {
    label: "coverageRegionCostaDelSol",
  },
};

function packLabel(t, pack) {
  const copy = REGION_COPY[pack.id] || {};
  return t(`companyProfile.${copy.label}`, { defaultValue: pack.name });
}

function comunaLabel(t, hub) {
  const preset = cityComunaForName(hub);
  if (!preset?.labelKey) {
    return t("companyProfile.comunaLabelGeneric");
  }
  return t(`companyProfile.${preset.labelKey}`);
}

function comunitatState(selected, city) {
  return regionMatchState(
    selected,
    extrasWithoutHub(COMUNITAT_VALENCIANA_CITIES, city)
  );
}

function includeComunitat(selected, city) {
  return addRegionCities(selected, COMUNITAT_VALENCIANA_CITIES);
}

function excludeComunitatKeepingLocal(selected, city) {
  const keep = new Set(
    [city, ...comunaTownsForCity(city)]
      .map((name) => normalizeSpainCitySearchText(name))
      .filter(Boolean)
  );
  const drop = extrasWithoutHub(COMUNITAT_VALENCIANA_CITIES, city).filter(
    (name) => !keep.has(normalizeSpainCitySearchText(name))
  );
  return removeRegionCities(selected, drop);
}

export default function CoverageRegionsPicker({
  country,
  value = [],
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const regions = coverageRegionsForCountry(country);
  const hubs = selectedComunaHubs(value);
  if (!regions.length) return null;

  return (
    <Box>
      <Typography
        variant="subtitle2"
        fontWeight={700}
        sx={{ mb: 0.5, ...adminReadableTextSx }}
      >
        {t("companyProfile.coverageRegionsTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1.5, lineHeight: 1.5, ...adminReadableTextSx }}
      >
        {t("companyProfile.coverageRegionsHelp")}
      </Typography>

      {hubs.length ? (
        <Stack gap={1.25} sx={{ mb: 2 }}>
          {hubs.map((city) => {
            const state = comunaMatchState(value, city);
            const showComunitatExtra = city === "Alicante";
            const comunitat = showComunitatExtra
              ? comunitatState(value, city)
              : "none";
            return (
              <Box
                key={city}
                sx={{
                  px: 1.5,
                  py: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1.5,
                  bgcolor: "grey.50",
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ mb: 0.25, ...adminReadableTextSx }}
                >
                  {city}
                </Typography>
                <FormControlLabel
                  sx={{ m: 0, display: "flex", alignItems: "flex-start" }}
                  control={
                    <Switch
                      size="small"
                      checked={state === "all"}
                      disabled={disabled}
                      onChange={() =>
                        onChange?.(toggleComunaTowns(value, city))
                      }
                    />
                  }
                  label={
                    <Box sx={{ pt: 0.4 }}>
                      <Typography
                        variant="body2"
                        sx={{ ...adminReadableTextSx, lineHeight: 1.35 }}
                      >
                        {t("companyProfile.includeCommunityNamed", {
                          name: comunaLabel(t, city),
                        })}
                        {state === "some"
                          ? ` · ${t("companyProfile.includeCommunityPartial")}`
                          : ""}
                      </Typography>
                    </Box>
                  }
                />
                {showComunitatExtra ? (
                  <FormControlLabel
                    sx={{ m: 0, display: "flex", alignItems: "flex-start" }}
                    control={
                      <Switch
                        size="small"
                        checked={comunitat === "all"}
                        disabled={disabled}
                        onChange={() => {
                          if (comunitat === "all") {
                            onChange?.(
                              excludeComunitatKeepingLocal(value, city)
                            );
                          } else {
                            onChange?.(includeComunitat(value, city));
                          }
                        }}
                      />
                    }
                    label={
                      <Box sx={{ pt: 0.4 }}>
                        <Typography
                          variant="body2"
                          sx={{ ...adminReadableTextSx, lineHeight: 1.35 }}
                        >
                          {t("companyProfile.includeCommunityNamed", {
                            name: t(
                              "companyProfile.coverageRegionValencianCommunity"
                            ),
                          })}
                          {comunitat === "some"
                            ? ` · ${t("companyProfile.includeCommunityPartial")}`
                            : ""}
                        </Typography>
                      </Box>
                    }
                  />
                ) : null}
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5, lineHeight: 1.45, ...adminReadableTextSx }}
        >
          {t("companyProfile.includeCommunityEmpty")}
        </Typography>
      )}

      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ mb: 0.75, ...adminReadableTextSx }}
      >
        {t("companyProfile.coverageShortcutTitle")}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {regions.map((region) => {
          const state = regionMatchState(value, region.cities);
          const selected = state === "all";
          return (
            <Chip
              key={region.id}
              clickable={!disabled}
              color={selected || state === "some" ? "primary" : "default"}
              variant={selected ? "filled" : "outlined"}
              label={packLabel(t, region) + (state === "some" ? " · …" : "")}
              onClick={() => {
                if (disabled) return;
                onChange?.(toggleRegionCities(value, region.cities));
              }}
              sx={{ textTransform: "none", ...adminReadableTextSx }}
            />
          );
        })}
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          mt: 1,
          lineHeight: 1.45,
          ...adminReadableTextSx,
        }}
      >
        {t("companyProfile.coverageRegionCostaBravaHelp")}
      </Typography>
    </Box>
  );
}
