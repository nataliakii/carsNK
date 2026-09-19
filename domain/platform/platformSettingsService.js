import PlatformSettings from "@models/platformSettings";
import { getSiteCountryConfig } from "@config/siteCountry";
import { normalizeEnabledLocales } from "@/domain/platform/uiLocales";

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

export function toPublicPlatformPayload(settingsDoc) {
  const country = getSiteCountryConfig();
  const enabledLocales = normalizeEnabledLocales(
    settingsDoc?.enabledLocales,
    country.defaultLocales
  );
  return {
    country: country.country,
    countryName: country.countryName,
    timezone: country.timezone,
    currency: country.currency,
    currencySymbol: country.currencySymbol,
    callingCode: country.callingCode,
    showLegacySeoLocations: country.showLegacySeoLocations,
    enabledLocales,
  };
}
