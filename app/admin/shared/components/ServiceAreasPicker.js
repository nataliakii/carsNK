"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  communitiesWithVisibleProvinces,
  isCommunityFullySelected,
  isProvinceCovered,
  provincesForCommunity,
  spainCommunities,
  toggleCommunitySelection,
  toggleProvinceSelection,
} from "@/domain/geo/spainAdminDivisions";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";

const MAGENTA = "#E9004F";

function chipSx(selected) {
  return {
    textTransform: "none",
    height: "auto",
    minHeight: 32,
    py: 0.5,
    maxWidth: "none",
    borderRadius: 1.5,
    borderColor: selected ? MAGENTA : "divider",
    bgcolor: selected ? MAGENTA : "#fff",
    color: selected ? "#fff" : "text.primary",
    fontWeight: selected ? 700 : 600,
    "& .MuiChip-label": {
      display: "block",
      overflow: "visible",
      textOverflow: "clip",
      whiteSpace: "normal",
      lineHeight: 1.25,
      px: 1,
    },
    "&:focus-visible": {
      outline: `2px solid ${MAGENTA}`,
      outlineOffset: 2,
    },
    ...adminReadableTextSx,
  };
}

export default function ServiceAreasPicker({
  country,
  value = { communityCodes: [], provinceCodes: [] },
  onChange,
  disabled = false,
}) {
  const { t } = useTranslation();
  const cc = String(country || "")
    .trim()
    .toUpperCase();
  if (cc && cc !== "ES") return null;

  const areas = {
    communityCodes: value?.communityCodes || [],
    provinceCodes: value?.provinceCodes || [],
  };
  const communities = spainCommunities();
  const provinceGroups = communitiesWithVisibleProvinces(areas);

  const emit = (next) => {
    if (disabled) return;
    onChange?.(next);
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        fontWeight={700}
        sx={{ mb: 1, ...adminReadableTextSx }}
      >
        {t("companyProfile.coverageRegionsTitle")}
      </Typography>
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
        {communities.map((community) => {
          const selected = isCommunityFullySelected(areas, community.code);
          return (
            <Chip
              key={community.code}
              clickable={!disabled}
              disabled={disabled}
              label={community.name}
              onClick={() => emit(toggleCommunitySelection(areas, community.code))}
              variant={selected ? "filled" : "outlined"}
              sx={chipSx(selected)}
            />
          );
        })}
      </Stack>

      {provinceGroups.length ? (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ mb: 1, ...adminReadableTextSx }}
          >
            {t("companyProfile.serviceAreasProvinces")}
          </Typography>
          {provinceGroups.map((community) => (
            <Stack
              key={community.code}
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={0.75}
              sx={{ mb: 1 }}
            >
              {provincesForCommunity(community.code).map((province) => {
                const selected = isProvinceCovered(areas, province.code);
                return (
                  <Chip
                    key={province.code}
                    clickable={!disabled}
                    disabled={disabled}
                    label={province.name}
                    onClick={() =>
                      emit(toggleProvinceSelection(areas, province.code))
                    }
                    variant={selected ? "filled" : "outlined"}
                    sx={chipSx(selected)}
                  />
                );
              })}
            </Stack>
          ))}
        </Box>
      ) : null}

      {!areas.communityCodes.length && !areas.provinceCodes.length ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, ...adminReadableTextSx }}
        >
          {t("companyProfile.serviceAreasNone")}
        </Typography>
      ) : null}
    </Box>
  );
}
