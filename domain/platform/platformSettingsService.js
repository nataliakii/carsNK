/**
 * PlatformSettings helpers: locales, marketplace fee default, business profile.
 */

import PlatformSettings from "@models/platformSettings";
import Company from "@models/company";
import { getSiteCountryConfig } from "@config/siteCountry";
import { getEnvBusinessProfileDefaults } from "@config/legalEntity";
import {
  filterLocalesForCountry,
  normalizeEnabledLocales,
} from "@/domain/platform/uiLocales";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  parseMarketplaceBookingFeeBps,
  formatMarketplaceFeePercent,
} from "@/domain/orders/marketplaceBookingFee";

export async function getPlatformMarketplaceFeeSettings() {
  try {
    const doc = await PlatformSettings.findOne({ key: "platform" })
      .select("marketplaceBookingFeeBps")
      .lean();
    return doc || null;
  } catch {
    return null;
  }
}

export async function getOrCreatePlatformSettings() {
  const country = getSiteCountryConfig();
  let doc = await PlatformSettings.findOne({ key: "platform" });
  if (!doc) {
    doc = await PlatformSettings.create({
      key: "platform",
      enabledLocales: normalizeEnabledLocales(country.defaultLocales),
    });
  }
  return doc;
}

/**
 * Editable Rovaro/operator contact + registration fields stored on
 * PlatformSettings.legal.businessProfile. Immutable identity (sole-trader
 * name, structure, brand) stays in config/legalEntity.js.
 */
export function sanitizeBusinessProfile(raw = {}) {
  const str = (v, max = 300) =>
    v == null || v === "" ? "" : String(v).trim().slice(0, max);
  const out = {
    businessAddress: str(raw.businessAddress, 500),
    country: str(raw.country, 80),
    businessNameNumber: str(raw.businessNameNumber, 80),
    taxRegistrationNumber: str(raw.taxRegistrationNumber, 80),
    vatNumber: str(raw.vatNumber, 80),
    vatRegistered:
      raw.vatRegistered === true ||
      String(raw.vatRegistered || "").toLowerCase() === "true",
    businessEmail: str(raw.businessEmail, 160),
    supportEmail: str(raw.supportEmail, 160),
    telephone: str(raw.telephone, 60),
    website: str(raw.website, 200),
    governingJurisdiction: str(raw.governingJurisdiction, 80),
    stripeStatementName: str(raw.stripeStatementName, 80),
    proprietorName: str(raw.proprietorName, 160),
  };
  return out;
}

export function readBusinessProfile(settingsDoc) {
  const envDefaults = getEnvBusinessProfileDefaults();
  const raw = settingsDoc?.legal?.businessProfile;
  const stored =
    raw && typeof raw === "object" ? sanitizeBusinessProfile(raw) : null;
  if (!stored) return sanitizeBusinessProfile(envDefaults);

  // DB overrides win when set; otherwise keep LEGAL_* env defaults.
  const merged = { ...envDefaults };
  for (const [key, value] of Object.entries(stored)) {
    if (key === "vatRegistered") {
      if (raw && Object.prototype.hasOwnProperty.call(raw, "vatRegistered")) {
        merged.vatRegistered = Boolean(value);
      }
      continue;
    }
    if (value !== "" && value != null) merged[key] = value;
  }
  return sanitizeBusinessProfile(merged);
}

export function toPublicPlatformPayload(settingsDoc) {
  const country = getSiteCountryConfig();
  // ES: drop bg/sr even if an older platform_settings doc still lists them.
  const enabledLocales = filterLocalesForCountry(
    normalizeEnabledLocales(
      [...(settingsDoc?.enabledLocales || []), ...country.defaultLocales],
      country.defaultLocales
    ),
    country.country
  );
  const feeBps =
    settingsDoc?.marketplaceBookingFeeBps == null
      ? null
      : Number(settingsDoc.marketplaceBookingFeeBps);
  return {
    country: country.country,
    countryName: country.countryName,
    timezone: country.timezone,
    currency: country.currency,
    currencySymbol: country.currencySymbol,
    callingCode: country.callingCode,
    showLegacySeoLocations: country.showLegacySeoLocations,
    enabledLocales,
    marketplaceBookingFeeBps: Number.isFinite(feeBps) ? feeBps : null,
    defaultMarketplaceBookingFeeBps: DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
    defaultMarketplaceBookingFeePercent: formatMarketplaceFeePercent(
      feeBps == null ? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS : feeBps
    ),
    businessProfile: readBusinessProfile(settingsDoc),
  };
}

/**
 * Spain marketplace partners: how many use platform default vs override.
 */
export async function getMarketplaceFeePartnerStats() {
  try {
    const [customOverrideCount, spainTotal] = await Promise.all([
      Company.countDocuments({
        country: { $in: ["ES", "es", "Spain"] },
        marketplaceBookingFeeBps: { $ne: null, $exists: true },
      }),
      Company.countDocuments({
        country: { $in: ["ES", "es", "Spain"] },
      }),
    ]);
    return {
      customOverrideCount,
      platformDefaultCount: Math.max(0, spainTotal - customOverrideCount),
      spainPartnerCount: spainTotal,
    };
  } catch {
    return {
      customOverrideCount: 0,
      platformDefaultCount: 0,
      spainPartnerCount: 0,
    };
  }
}

/**
 * @param {unknown} bps
 * @returns {{ ok: true, bps: number } | { ok: false, error: string }}
 */
export function parsePlatformMarketplaceFeePatch(bps) {
  return parseMarketplaceBookingFeeBps(bps);
}
