/**
 * Clickwrap for the two contracts a customer signs at booking:
 * Rovaro platform terms + the supplier's own rental rules.
 *
 * Admin/offline stubs skip this. Public bookings must accept the platform
 * document they were shown (checksum) and, when the company has published
 * English rules, those too (source hash).
 */

export const BOOKING_TERMS_ERROR = Object.freeze({
  PLATFORM_UNAVAILABLE: "platform_terms_unavailable",
  PLATFORM_REQUIRED: "platform_terms_required",
  PLATFORM_STALE: "platform_terms_stale",
  COMPANY_REQUIRED: "company_terms_required",
  COMPANY_STALE: "company_terms_stale",
});

function truthyAccepted(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asSlice(value) {
  return value && typeof value === "object" ? value : {};
}

/**
 * @param {{
 *   skip?: boolean,
 *   payload?: { platform?: object, company?: object },
 *   platform?: { available: boolean, checksum?: string, version?: number, documentType?: string, language?: string },
 *   company?: { available: boolean, sourceHash?: string, language?: string },
 * }} args
 */
export function evaluateBookingTermsAcceptance({
  skip = false,
  payload,
  platform,
  company,
} = {}) {
  if (skip) return { ok: true };

  if (!platform?.available) {
    return {
      ok: false,
      code: BOOKING_TERMS_ERROR.PLATFORM_UNAVAILABLE,
      message: "Platform booking terms are not available",
    };
  }

  const sent = asSlice(payload);
  const sentPlatform = asSlice(sent.platform);
  if (!truthyAccepted(sentPlatform.accepted)) {
    return {
      ok: false,
      code: BOOKING_TERMS_ERROR.PLATFORM_REQUIRED,
      message: "You must read and accept the platform terms",
    };
  }

  const expectedChecksum = String(platform.checksum || "").toLowerCase();
  const sentChecksum = String(sentPlatform.checksum || "").toLowerCase();
  if (!expectedChecksum || sentChecksum !== expectedChecksum) {
    return {
      ok: false,
      code: BOOKING_TERMS_ERROR.PLATFORM_STALE,
      message: "Platform terms have changed. Open them again and accept.",
    };
  }

  if (company?.available) {
    const sentCompany = asSlice(sent.company);
    if (!truthyAccepted(sentCompany.accepted)) {
      return {
        ok: false,
        code: BOOKING_TERMS_ERROR.COMPANY_REQUIRED,
        message: "You must read and accept the company rental rules",
      };
    }
    const expectedHash = String(company.sourceHash || "").toLowerCase();
    const sentHash = String(sentCompany.sourceHash || "").toLowerCase();
    if (!expectedHash || sentHash !== expectedHash) {
      return {
        ok: false,
        code: BOOKING_TERMS_ERROR.COMPANY_STALE,
        message: "Company rental rules have changed. Open them again and accept.",
      };
    }
  }

  return { ok: true };
}

export function buildTermsAcceptanceRecord({
  payload,
  platform,
  company,
  acceptedAt = new Date(),
} = {}) {
  const sent = asSlice(payload);
  const sentPlatform = asSlice(sent.platform);
  const sentCompany = asSlice(sent.company);
  const record = {
    platform: {
      accepted: true,
      acceptedAt,
      documentType: platform?.documentType || "",
      version: Number(platform?.version || sentPlatform.version || 0) || 0,
      checksum: String(platform?.checksum || ""),
      language: String(platform?.language || sentPlatform.language || "en"),
    },
  };
  if (company?.available) {
    record.company = {
      accepted: true,
      acceptedAt,
      sourceHash: String(company.sourceHash || ""),
      language: String(company.language || sentCompany.language || "en"),
    };
  }
  return record;
}
