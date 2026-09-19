"use client";

import Image from "next/image";
import { Box } from "@mui/material";
import { getActiveBrand, isGreeceSite } from "@config/brand";

/**
 * Country-aware site logo.
 * GR → CarsNK PNGs from /brand/carsnk/
 * ES (etc.) → rovaro PNGs from /brand/rovaro/ (ova magenta ligature)
 *
 * variant: light | dark | footer
 */
export function SiteLogo({
  variant = "light",
  showTagline = false,
  height = 28,
  priority = false,
  sx,
}) {
  const brand = getActiveBrand();
  const greece = isGreeceSite();
  const withTagline = Boolean(showTagline || variant === "footer");

  let src;
  if (greece) {
    if (variant === "footer") {
      src = brand.logos.wordmarkFooter || brand.logos.wordmarkOnDark;
    } else if (variant === "dark") {
      src =
        brand.logos.wordmarkOnDarkCompact ||
        brand.logos.wordmarkOnDark ||
        brand.logos.wordmarkDark;
    } else {
      src = brand.logos.wordmarkLight;
    }
  } else if (variant === "footer" || withTagline) {
    src =
      variant === "light"
        ? brand.logos.wordmarkLightFull || brand.logos.wordmarkLight
        : brand.logos.wordmarkFooter || brand.logos.wordmarkOnDark;
  } else if (variant === "dark") {
    src =
      brand.logos.wordmarkOnDarkCompact || brand.logos.wordmarkOnDark;
  } else {
    src =
      brand.logos.wordmarkLightCompact || brand.logos.wordmarkLight;
  }

  const aspect = greece
    ? variant === "footer"
      ? { w: 320, h: 214 }
      : { w: 1127, h: 286 }
    : withTagline
      ? { w: 1100, h: 355 }
      : { w: 1100, h: 250 };

  const displayHeight =
    withTagline && !greece ? Math.round(height * 1.55) : height;
  const displayWidth = Math.round((displayHeight * aspect.w) / aspect.h);

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 0,
        flexShrink: 0,
        ...sx,
      }}
    >
      <Image
        src={src}
        alt={brand.name}
        width={aspect.w}
        height={aspect.h}
        priority={priority}
        style={{
          width: displayWidth,
          height: displayHeight,
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "left center",
        }}
      />
    </Box>
  );
}

/** App / preloader mark */
export function SiteMark({ size = 36, sx }) {
  const brand = getActiveBrand();

  return (
    <Box
      sx={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...sx,
      }}
    >
      <Image
        src={brand.logos.mark}
        alt={brand.name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </Box>
  );
}

/** @deprecated use SiteLogo */
export function RovaroWordmark(props) {
  return <SiteLogo {...props} />;
}

/** @deprecated use SiteMark */
export function RovaroMark(props) {
  return <SiteMark {...props} />;
}

export default function RovaroLogo(props) {
  return <SiteLogo {...props} />;
}
