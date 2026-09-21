import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { ROLE } from "@models/user";
import { getSiteCountryCode } from "@config/siteCountry";
import { buildSiteCountryCompanyFilter } from "@/domain/platform/companyCountryScope";
import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
  isNataliCarsCompany,
} from "@/domain/vouchers/companyStamp";
import { getVoucherMarketLocales } from "@/domain/vouchers/transferVoucher";
import {
  getEffectiveOwnerId,
  isAdminViewAsActive,
} from "@/domain/owners/ownerScope";

function serializeCompany(doc) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    name: doc.name || "",
    tel: doc.tel || "",
    address: doc.address || "",
    country: String(doc.country || "").toUpperCase() || "",
    voucherStampSrc: getCompanyVoucherStampSrc(doc),
  };
}

function defaultsForCompany(doc) {
  if (!doc) return null;
  const primary = getVoucherMarketLocales(doc.country).primary;
  return buildCompanyVoucherDefaults(doc, primary);
}

export async function loadVoucherHubData(session) {
  await connectToDB();

  const role = Number(session?.user?.role);
  const isSuperadmin = role === ROLE.SUPERADMIN;
  const showSuperAdminTabs =
    isSuperadmin && !isAdminViewAsActive(session?.user);
  const scopedOwnerId = getEffectiveOwnerId(session?.user);
  const ownerId = scopedOwnerId || session?.user?.ownerId;

  let voucherCompany = null;
  let initialDefaults = null;
  let companies = [];

  if (isSuperadmin && scopedOwnerId) {
    const owned = await Company.findById(scopedOwnerId).lean();
    if (owned) {
      voucherCompany = serializeCompany(owned);
      initialDefaults = defaultsForCompany(owned);
      companies = [voucherCompany];
    }
  } else if (isSuperadmin) {
    const all = await Company.find(
      buildSiteCountryCompanyFilter(getSiteCountryCode())
    )
      .sort({ name: 1 })
      .lean();
    companies = (all || []).map(serializeCompany).filter(Boolean);
    const natali = (all || []).find((c) => isNataliCarsCompany(c));
    const pick = natali || all?.[0] || null;
    if (pick) {
      voucherCompany = serializeCompany(pick);
      initialDefaults = defaultsForCompany(pick);
    }
  } else if (ownerId) {
    const owned = await Company.findById(ownerId).lean();
    if (owned) {
      voucherCompany = serializeCompany(owned);
      initialDefaults = defaultsForCompany(owned);
      companies = [voucherCompany];
    }
  }

  return {
    company: voucherCompany,
    companies,
    canPickCompany: isSuperadmin && !scopedOwnerId && companies.length > 1,
    initialDefaults,
    showSuperAdminTabs,
  };
}
