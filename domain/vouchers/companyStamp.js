/**
 * Resolve per-company voucher branding (stamp + header).
 * Never reuse another company's stamp as a fallback.
 */

import { COMPANY_STAMP_TEXT } from "@/domain/vouchers/transferVoucher";

export const NATALI_CARS_STAMP_SRC = "/vouchers/natali-cars-stamp.png";

export function isNataliCarsCompany(company) {
  const name = String(company?.name || "").toLowerCase();
  return name.includes("natali");
}

/**
 * @param {object|null|undefined} company
 * @returns {string} public path/URL, or "" when this company has no stamp
 */
export function getCompanyVoucherStampSrc(company) {
  if (!company) return "";

  const custom = String(company?.voucherStampSrc || "").trim();
  if (custom) {
    // Never let a non-Natali company keep a natali stamp path by mistake
    if (
      !isNataliCarsCompany(company) &&
      custom.toLowerCase().includes("natali-cars-stamp")
    ) {
      return "";
    }
    return custom;
  }

  if (isNataliCarsCompany(company)) {
    return NATALI_CARS_STAMP_SRC;
  }

  return "";
}

/**
 * @param {object|null|undefined} company
 * @param {"el"|"en"} [locale]
 */
export function buildCompanyVoucherDefaults(company, locale = "el") {
  const loc = locale === "en" ? "en" : "el";
  const stampSrc = getCompanyVoucherStampSrc(company);

  if (!company) {
    return {
      companyHeaderTitle: "",
      companyInfo: "",
      stampSrc: "",
    };
  }

  if (isNataliCarsCompany(company)) {
    return {
      companyHeaderTitle:
        loc === "en" ? "MAKAROVA NATALIA" : "ΜΑΚΑΡΟΒΑ ΝΑΤΑΛΙΑ",
      companyInfo: COMPANY_STAMP_TEXT[loc] || COMPANY_STAMP_TEXT.el,
      stampSrc,
    };
  }

  const name = company?.name || "Company";
  const tel = company?.tel || "";
  const address = company?.address || "";
  const lines = [name];
  if (address) lines.push(address);
  if (tel) lines.push(loc === "en" ? `Tel. ${tel}` : `ΤΗΛ. ${tel}`);

  return {
    companyHeaderTitle: name,
    companyInfo: lines.join("\n"),
    stampSrc,
  };
}
