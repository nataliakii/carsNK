/**
 * Site brand — switched by NEXT_PUBLIC_SITE_COUNTRY (see config/siteCountry.js).
 *
 *   GR (default) → CarsNK  — assets in /public/brand/carsnk/
 *   ES (etc.)    → rovaro  — assets in /public/brand/rovaro/
 */

import { getSiteCountryCode } from "./siteCountry.js";

/** Legacy Greece / CarsNK palette */
export const CARSNK_BRAND = {
  id: "carsnk",
  name: "CarsNK",
  displayName: "CarsNK",
  tagline: "Car rental in Halkidiki",
  primary: "#00C8D4",
  primaryLight: "#4DDBE4",
  primaryDark: "#009AA3",
  secondary: "#0B1F3A",
  secondaryLight: "#1A3358",
  secondaryDark: "#061222",
  accent: "#E53935",
  accentAlt: "#FFD400",
  black: "#0B1F3A",
  blackSoft: "#061222",
  white: "#FFFFFF",
  gray: "#6B8294",
  /** @deprecated alias used by older code paths */
  pink: "#00C8D4",
  pinkLight: "#4DDBE4",
  pinkDark: "#009AA3",
  logos: {
    wordmarkLight: "/brand/carsnk/wordmark-light.png",
    wordmarkDark: "/brand/carsnk/wordmark-on-dark.png",
    wordmarkOnDark: "/brand/carsnk/wordmark-on-dark.png",
    wordmarkOnDarkCompact: "/brand/carsnk/wordmark-on-dark.png",
    wordmarkFooter: "/brand/carsnk/wordmark-footer.png",
    mark: "/brand/carsnk/mark.png",
    favicon: "/brand/carsnk/mark.png",
    appleIcon: "/brand/carsnk/apple-icon.png",
  },
};

/** rovaro palette (Spain / non-Greece) */
export const ROVARO_BRAND = {
  id: "rovaro",
  name: "rovaro",
  displayName: "rovaro",
  tagline: "Road-ready. Value clear. Roam easy.",
  primary: "#E9004F",
  primaryLight: "#FF4D7A",
  primaryDark: "#B80042",
  secondary: "#0A0A0A",
  secondaryLight: "#2A2A2A",
  secondaryDark: "#000000",
  accent: "#E9004F",
  accentAlt: "#FFC857",
  black: "#0A0A0A",
  blackSoft: "#141414",
  white: "#FFFFFF",
  gray: "#6B6B6B",
  pink: "#E9004F",
  pinkLight: "#FF4D7A",
  pinkDark: "#B80042",
  logos: {
    // Approved raster wordmarks (user assets)
    wordmarkLight: "/brand/rovaro/rovaro-white-background.png",
    wordmarkLightCompact: "/brand/rovaro/rovaro-white-background.png",
    wordmarkLightFull: "/brand/rovaro/rovaro-white-background.png",
    wordmarkDark: "/brand/rovaro/wordmark-compact.png",
    wordmarkOnDark: "/brand/rovaro/wordmark-compact.png",
    wordmarkOnDarkCompact: "/brand/rovaro/wordmark-compact.png",
    wordmarkTransparent: "/brand/rovaro/rovaro-transparent.png",
    // Footer: white ink on transparent (slogan rendered as text)
    wordmarkFooter: "/brand/rovaro/wordmark-compact.png",
    // OVA mark / favicons (same master, all sizes)
    mark: "/brand/rovaro/mark.png",
    favicon: "/brand/rovaro/favicon.png",
    favicon16: "/brand/rovaro/favicon-16.png",
    favicon32: "/brand/rovaro/favicon-32.png",
    faviconIco: "/brand/rovaro/favicon.ico",
    appleIcon: "/brand/rovaro/apple-icon.png",
  },
};

export function isGreeceSite() {
  return getSiteCountryCode() === "GR";
}

/** Active brand for the current deployment country. */
export function getActiveBrand() {
  return isGreeceSite() ? CARSNK_BRAND : ROVARO_BRAND;
}

/** @deprecated use getActiveBrand() — kept for import compatibility */
export const BRAND = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "__esModule") return false;
      const active = getActiveBrand();
      if (prop in active) return active[prop];
      return undefined;
    },
    ownKeys() {
      return Reflect.ownKeys(getActiveBrand());
    },
    getOwnPropertyDescriptor(_t, prop) {
      const active = getActiveBrand();
      if (prop in active) {
        return {
          configurable: true,
          enumerable: true,
          value: active[prop],
        };
      }
      return undefined;
    },
  }
);

export function getBrandName() {
  return getActiveBrand().name;
}

export function getBrandTagline() {
  return getActiveBrand().tagline;
}
