import { getSiteCountryCode, COUNTRY_CODES } from "@config/siteCountry";
import { buildSiteCountryCompanyFilter } from "@/domain/platform/companyCountryScope";

export const ADMIN_COUNTRY_STORAGE_KEY = "adminCountryFilter";
export const ADMIN_COUNTRY_EVENT = "admin-country-filter-change";

export const ADMIN_COUNTRY_OPTIONS = [
  { code: "ALL", label: "All countries" },
  ...COUNTRY_CODES.map((code) => ({
    code,
    label: code === "GR" ? "Greece (GR)" : code === "ES" ? "Spain (ES)" : code,
  })),
];

export function normalizeAdminCountryFilter(raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (code === "ALL") return "ALL";
  if (COUNTRY_CODES.includes(code)) return code;
  return getSiteCountryCode();
}

export function getDefaultAdminCountryFilter() {
  return getSiteCountryCode();
}

/** Mongo company filter for superadmin country switcher. */
export function buildAdminCountryCompanyFilter(countryCode) {
  const code = normalizeAdminCountryFilter(countryCode);
  if (code === "ALL") return {};
  return buildSiteCountryCompanyFilter(code);
}

export function readAdminCountryFilterFromStorage() {
  if (typeof window === "undefined") return getDefaultAdminCountryFilter();
  try {
    return normalizeAdminCountryFilter(
      window.localStorage.getItem(ADMIN_COUNTRY_STORAGE_KEY)
    );
  } catch {
    return getDefaultAdminCountryFilter();
  }
}

export function writeAdminCountryFilterToStorage(countryCode) {
  const next = normalizeAdminCountryFilter(countryCode);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(ADMIN_COUNTRY_STORAGE_KEY, next);
    window.dispatchEvent(
      new CustomEvent(ADMIN_COUNTRY_EVENT, { detail: { country: next } })
    );
  } catch {
    /* ignore */
  }
  return next;
}
