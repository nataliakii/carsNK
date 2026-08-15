/**
 * Resolve per-company voucher stamp path.
 */

const DEFAULT_STAMP = "/vouchers/natali-cars-stamp.png";

export function getCompanyVoucherStampSrc(company) {
  const custom = String(company?.voucherStampSrc || "").trim();
  if (custom) return custom;

  const name = String(company?.name || "").toLowerCase();
  if (name.includes("natali")) {
    return "/vouchers/natali-cars-stamp.png";
  }
  // Placeholder until other companies upload their stamp
  return DEFAULT_STAMP;
}

export function buildCompanyVoucherDefaults(company) {
  const stampSrc = getCompanyVoucherStampSrc(company);
  const name = company?.name || "Company";
  const tel = company?.tel || "";
  const address = company?.address || "";
  const lines = [name];
  if (address) lines.push(address);
  if (tel) lines.push(`ΤΗΛ. ${tel}`);
  return {
    companyHeaderTitle: name,
    companyInfo: lines.join("\n"),
    stampSrc,
  };
}
