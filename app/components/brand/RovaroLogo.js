"use client";

import Image from "next/image";
import { Box } from "@mui/material";
import { getActiveBrand, isGreeceSite } from "@config/brand";

/**
 * Country-aware site logo.
 * GR → CarsNK PNGs from /brand/carsnk/
 * ES → approved Rovaro PNG wordmarks only
 *     (rovaro-white-background / wordmark-compact / rovaro-transparent)
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

  let src;
  if (variant === "footer") {
    src =
      brand.logos.wordmarkFooter ||
      brand.logos.wordmarkTransparent ||
      brand.logos.wordmarkOnDark;
  } else if (variant === "dark") {
    src =
      brand.logos.wordmarkOnDarkCompact ||
      brand.logos.wordmarkOnDark ||
      brand.logos.wordmarkDark;
  } else {
    src = brand.logos.wordmarkLight;
  }

  const aspect = greece
    ? variant === "footer"
      ? { w: 320, h: 214 }
      : { w: 1127, h: 286 }
    : variant === "dark" || variant === "footer"
      ? { w: 788, h: 207 }
      : { w: 2048, h: 682 };

  const displayHeight = height;
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

/** App / preloader mark — restored mark PNG via brand config */
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
