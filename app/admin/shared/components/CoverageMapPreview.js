"use client";

import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
} from "@/domain/orders/carOffices";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";

function officeQuery(office) {
  if (!office) return null;
  return {
    name: office.name,
    address: office.address,
    lat: office.lat,
    lon: office.lon ?? office.lng,
  };
}

/**
 * Key-free map preview: Maps embed of the office pin, plus a city list overlay.
 * Radius is shown as copy (embed cannot draw a circle without Maps JS).
 */
export default function CoverageMapPreview({
  offices = [],
  radiusKm = null,
  cities = [],
  compact = false,
}) {
  const { t } = useTranslation();
  const primary =
    (offices || []).find(
      (office) =>
        String(office?.address || "").trim() ||
        (String(office?.lat || "").trim() &&
          String(office?.lon || office?.lng || "").trim())
    ) || offices[0];
  const query = officeQuery(primary);
  const embedSrc = query ? googleMapsEmbedUrl(query) : "";
  const mapsUrl = query ? googleMapsSearchUrl(query) : "";
  const radius =
    radiusKm === "" || radiusKm == null ? null : Number(radiusKm);
  const hasRadius = Number.isFinite(radius) && radius >= 0;
  const cityNames = (cities || []).map((c) => String(c || "").trim()).filter(Boolean);

  if (!embedSrc && !cityNames.length && !mapsUrl) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ ...adminReadableTextSx, lineHeight: 1.45 }}
      >
        {t("companyProfile.coverageMapUnavailable")}
      </Typography>
    );
  }

  return (
    <Box>
      {embedSrc ? (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            pt: compact ? "42%" : "56%",
            borderRadius: 1.5,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "grey.100",
          }}
        >
          <Box
            component="iframe"
            title={t("companyProfile.coverageMapTitle")}
            src={embedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </Box>
      ) : null}

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1}
        alignItems="center"
        sx={{ mt: embedSrc ? 1.25 : 0 }}
      >
        {mapsUrl ? (
          <MuiLink
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontWeight: 600, fontSize: "0.85rem", ...adminReadableTextSx }}
          >
            {t("order.openInGoogleMaps")}
          </MuiLink>
        ) : null}
        {hasRadius ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={adminReadableTextSx}
          >
            {t("companyProfile.coverageMapRadius", { km: radius })}
          </Typography>
        ) : null}
      </Stack>

      {cityNames.length ? (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1.25 }}>
          {cityNames.slice(0, compact ? 8 : 24).map((name) => (
            <Chip
              key={name}
              size="small"
              label={name}
              variant="outlined"
              sx={{ textTransform: "none" }}
            />
          ))}
          {cityNames.length > (compact ? 8 : 24) ? (
            <Chip
              size="small"
              variant="outlined"
              label={`+${cityNames.length - (compact ? 8 : 24)}`}
            />
          ) : null}
        </Stack>
      ) : null}
    </Box>
  );
}
