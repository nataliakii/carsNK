/**
 * Context injected into AWS legal document templates
 * (privacy / terms / cookies).
 *
 * Override via env — do not commit real personal/legal secrets.
 *
 * NEXT_PUBLIC_LEGAL_COMPANY_LEGAL_NAME
 * NEXT_PUBLIC_LEGAL_COMPANY_TRADING_NAME
 * NEXT_PUBLIC_LEGAL_COMPANY_COUNTRY
 * NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS
 * NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL
 * NEXT_PUBLIC_LEGAL_WEBSITE
 * NEXT_PUBLIC_LEGAL_SERVICE_NAME
 * NEXT_PUBLIC_LEGAL_JUR  (EU | IE | UA) — default IE for Ireland operator
 */

import { getBrandName } from "@config/brand";
import { getBaseUrl } from "@config/domain";

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

/**
 * @returns {{
 *   company: {
 *     legalName: string,
 *     tradingName: string,
 *     country: string,
 *     address: string,
 *     privacyEmail: string,
 *     website: string,
 *   },
 *   service: { name: string },
 * }}
 */
export function getLegalTemplateContext() {
  const tradingName =
    trimEnv("NEXT_PUBLIC_LEGAL_COMPANY_TRADING_NAME") || getBrandName();
  const website =
    trimEnv("NEXT_PUBLIC_LEGAL_WEBSITE") ||
    trimEnv("NEXT_PUBLIC_SITE_URL") ||
    getBaseUrl();

  return {
    company: {
      legalName:
        trimEnv("NEXT_PUBLIC_LEGAL_COMPANY_LEGAL_NAME") || tradingName,
      tradingName,
      country: trimEnv("NEXT_PUBLIC_LEGAL_COMPANY_COUNTRY") || "Ireland",
      address: trimEnv("NEXT_PUBLIC_LEGAL_COMPANY_ADDRESS") || "",
      privacyEmail:
        trimEnv("NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL") ||
        trimEnv("NEXT_PUBLIC_LEGAL_COMPANY_EMAIL") ||
        "",
      website,
    },
    service: {
      name: trimEnv("NEXT_PUBLIC_LEGAL_SERVICE_NAME") || tradingName,
    },
  };
}

/** Default jurisdiction for legal docs (Ireland operator). */
export function getLegalJurisdiction() {
  const raw = trimEnv("NEXT_PUBLIC_LEGAL_JUR").toUpperCase();
  if (raw === "EU" || raw === "IE" || raw === "UA") return raw;
  return "IE";
}
