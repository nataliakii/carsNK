"use client";

import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { buildCarSpecGroups, CAR_SPEC_GROUPS } from "@/domain/cars/carSpecs";
import CarSpecSection, { CarSpecGrid } from "./CarSpecList";

/**
 * Specification panel for the catalog card's left column.
 *
 * "At a glance" sits in a tinted panel directly under the photo (primary);
 * the remaining groups follow as captioned two-column blocks. All rows come
 * from buildCarSpecGroups so this and CarDetailsModal stay in sync.
 *
 * `sections` lets the card render the summary alone under the photo
 * while the full list lives in CarDetailsModal:
 *   "highlights" → at-a-glance panel only (always visible on the card)
 *   "details"    → vehicle + insurance groups
 *   "all"        → both
 */
const CarDetails = ({ car, sections = "all" }) => {
  const { t } = useTranslation();

  const groups = useMemo(() => buildCarSpecGroups(car, t), [car, t]);
  const highlights =
    sections === "details"
      ? null
      : groups.find((g) => g.id === CAR_SPEC_GROUPS.HIGHLIGHTS);
  const rest =
    sections === "highlights"
      ? []
      : groups.filter((g) => g.id !== CAR_SPEC_GROUPS.HIGHLIGHTS);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: { xs: 1.25, sm: 1.5 },
        width: "100%",
        minWidth: 0,
        textAlign: "left",
      }}
    >
      {highlights ? (
        <Box
          sx={{
            px: { xs: 1, sm: 1.5 },
            py: { xs: 0.75, sm: 1 },
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
            minWidth: 0,
          }}
        >
          <CarSpecGrid items={highlights.items} columns={2} dense />
        </Box>
      ) : null}

      {rest.map((group) => (
        <CarSpecSection
          key={group.id}
          title={group.title}
          items={group.items}
          columns={2}
        />
      ))}
    </Box>
  );
};

export default CarDetails;
