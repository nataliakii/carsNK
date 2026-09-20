"use client";

import React, { useMemo, useState } from "react";
import { Box, Typography, Chip, Stack, Collapse, ButtonBase } from "@mui/material";
import { useTranslation } from "react-i18next";
import { buildDeliveryRuleSummary } from "@/domain/delivery/cityDeliveryPricing";
import {
  resolveCarOffices,
  resolveCarOperatingZones,
} from "@/domain/cars/carOperatingZones";
import { CarSpecCaption } from "./CarSpecList";

/**
 * Delivery conditions + operating zones — a subordinate block under the
 * specification panel on the catalog card. Long zone lists stay collapsed
 * behind a "show all" toggle so they never dominate the card.
 */
const COLLAPSED_ZONE_COUNT = 6;

export default function CarDeliveryInfo({
  car,
  company,
  zoneNames = [],
  compact = false,
}) {
  const { t } = useTranslation();
  const [zonesExpanded, setZonesExpanded] = useState(false);

  const offices = useMemo(
    () => resolveCarOffices(car, company),
    [car, company]
  );

  const rule = useMemo(() => buildDeliveryRuleSummary(company), [company]);

  const zones = useMemo(
    () => resolveCarOperatingZones({ car, company, zoneNames }),
    [car, company, zoneNames]
  );

  const officeLine = offices.length
    ? offices
        .map((o) => (o.address ? `${o.name} (${o.address})` : o.name))
        .join("; ")
    : null;

  const hasZones = zones.length > 0;
  const collapsedCount = compact ? 4 : COLLAPSED_ZONE_COUNT;
  const visibleZones = zones.slice(0, collapsedCount);
  const hiddenZones = zones.slice(collapsedCount);

  const citiesLabel = zones.slice(0, 3).join(", ");

  const chipSx = {
    height: 22,
    fontSize: "0.68rem",
    borderColor: "divider",
    color: "text.secondary",
    bgcolor: "transparent",
    "& .MuiChip-label": { px: 0.75 },
  };

  return (
    <Box sx={{ width: "100%", minWidth: 0, textAlign: "left" }}>
      <CarSpecCaption>{t("car.deliveryConditionsTitle")}</CarSpecCaption>

      <Box
        component="ul"
        sx={{
          m: 0,
          pl: 2.25,
          listStyleType: "disc",
          "& li": {
            fontSize: { xs: "0.72rem", sm: "0.76rem" },
            lineHeight: 1.45,
            color: "text.secondary",
            mb: 0.25,
          },
        }}
      >
        <li>
          {officeLine
            ? t("car.deliveryCondOfficeFreeWithPlaces", {
                places: officeLine,
              })
            : t("car.deliveryCondOfficeFree")}
        </li>
        {rule.strategy === "cities" && citiesLabel ? (
          <li>
            {rule.insideFree
              ? t("car.deliveryCondFreeInCities", { cities: citiesLabel })
              : t("car.deliveryCondFlatInCities", {
                  cities: citiesLabel,
                  fee: rule.insideFixed ?? 0,
                })}
          </li>
        ) : (
          <li>{t("car.deliveryCondInCity")}</li>
        )}
        <li>
          {rule.strategy === "cities" || rule.strategy === "radius"
            ? t("car.deliveryCondOutsidePerKm", { rate: rule.perKm })
            : t("car.deliveryCondOutsideCity")}
        </li>
        {rule.freeRadiusKm != null ? (
          <li>
            {t("car.deliveryCondFreeRadius", { km: rule.freeRadiusKm })}
          </li>
        ) : null}
      </Box>

      <CarSpecCaption sx={{ mt: 1.5 }}>
        {t("car.operatingZonesTitle")}
      </CarSpecCaption>

      {hasZones ? (
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {visibleZones.map((zone) => (
              <Chip
                key={zone}
                label={zone}
                size="small"
                variant="outlined"
                sx={chipSx}
              />
            ))}
          </Stack>

          {hiddenZones.length > 0 ? (
            <>
              <Collapse in={zonesExpanded} unmountOnExit>
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  gap={0.5}
                  sx={{ mt: 0.5 }}
                >
                  {hiddenZones.map((zone) => (
                    <Chip
                      key={zone}
                      label={zone}
                      size="small"
                      variant="outlined"
                      sx={chipSx}
                    />
                  ))}
                </Stack>
              </Collapse>

              <ButtonBase
                onClick={() => setZonesExpanded((prev) => !prev)}
                aria-expanded={zonesExpanded}
                sx={{
                  mt: 0.75,
                  px: 0,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "primary.main",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  borderRadius: 0.5,
                }}
              >
                {zonesExpanded
                  ? t("car.operatingZonesShowLess")
                  : t("car.operatingZonesShowAll", { count: zones.length })}
              </ButtonBase>
            </>
          ) : null}
        </Box>
      ) : (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "text.secondary",
            fontSize: { xs: "0.72rem", sm: "0.76rem" },
            lineHeight: 1.45,
          }}
        >
          {t("car.operatingZonesFallback")}
        </Typography>
      )}
    </Box>
  );
}
