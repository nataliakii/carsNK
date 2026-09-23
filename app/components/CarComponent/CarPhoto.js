"use client";

import React, { useState } from "react";
import { Stack, Typography } from "@mui/material";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import { CldImage } from "next-cloudinary";
import { useTranslation } from "react-i18next";
import { CLOUDINARY_PLACEHOLDER_PUBLIC_ID } from "@config/cloudinary";

/**
 * Car photo that fills its positioned parent and degrades to a muted
 * placeholder instead of a broken-image icon with sprawling alt text.
 * The parent is responsible for the aspect-ratio box and `position: relative`.
 */
export default function CarPhoto({
  photoUrl,
  alt = "",
  priority = false,
  sizes,
  iconSize = 40,
  contentPaddingBottom = 0,
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={0.5}
        sx={{
          position: "absolute",
          inset: 0,
          pb: contentPaddingBottom,
          color: "text.disabled",
        }}
      >
        <DirectionsCarIcon sx={{ fontSize: iconSize }} />
        <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
          {t("car.photoUnavailable")}
        </Typography>
      </Stack>
    );
  }

  return (
    <CldImage
      src={photoUrl || CLOUDINARY_PLACEHOLDER_PUBLIC_ID}
      alt={alt}
      fill
      crop="fill"
      priority={priority}
      sizes={sizes}
      onError={() => setFailed(true)}
      style={{ objectFit: "cover" }}
    />
  );
}
