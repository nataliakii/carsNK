import { getSiteCountryCode } from "@config/siteCountry";

/**
 * Mongo filter: companies that belong to this deployment country.
 * GR keeps legacy docs with missing/empty country.
 */
export function buildSiteCountryCompanyFilter(countryCode = getSiteCountryCode()) {
  const code = String(countryCode || "GR").toUpperCase();
  if (code === "GR") {
    return {
      $or: [
        { country: "GR" },
        { country: { $exists: false } },
        { country: null },
        { country: "" },
      ],
    };
  }
  return { country: code };
}

export function isCompanyInSiteCountry(company, countryCode = getSiteCountryCode()) {
  if (!company) return false;
  const site = String(countryCode || "GR").toUpperCase();
  const cc = String(company.country || "").trim().toUpperCase();
  if (site === "GR") return !cc || cc === "GR";
  return cc === site;
}

/** Force company payload country to the deployment country. */
export function withSiteCountry(fields = {}, countryCode = getSiteCountryCode()) {
  return {
    ...fields,
    country: String(countryCode || "GR").toUpperCase(),
  };
}
