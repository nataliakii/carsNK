import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { ROLE } from "@models/user";
import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
  isNataliCarsCompany,
} from "@/domain/vouchers/companyStamp";
import { getVoucherMarketLocales } from "@/domain/vouchers/transferVoucher";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import {
  getEffectiveOwnerId,
  isAdminViewAsActive,
} from "@/domain/owners/ownerScope";
import VouchersHubSection from "./VouchersHubSection";

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

export default async function VouchersPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");
  const scopedOwnerId = getEffectiveOwnerId(session?.user);
  const feedCompanyId = scopedOwnerId || COMPANY_ID;

  const [company, cars, orders] = await Promise.all([
    getCompany(feedCompanyId),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  await connectToDB();

  const role = Number(session?.user?.role);
  const isSuperadmin = role === ROLE.SUPERADMIN;
  /** Access links + Platform tabs stay superadmin-only and are dropped while viewing as a company. */
  const showSuperAdminTabs =
    isSuperadmin && !isAdminViewAsActive(session?.user);
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
    const all = await Company.find({}).sort({ name: 1 }).lean();
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

  const safeCompany = company ? JSON.parse(JSON.stringify(company)) : company;
  const safeCars = cars ? JSON.parse(JSON.stringify(cars)) : cars;
  const safeOrders = orders ? JSON.parse(JSON.stringify(orders)) : orders;

  return (
    <Feed
      cars={safeCars}
      orders={safeOrders}
      company={safeCompany}
      isAdmin
      isMain={false}
    >
      <VouchersHubSection
        company={voucherCompany}
        companies={companies}
        canPickCompany={isSuperadmin && !scopedOwnerId && companies.length > 1}
        initialDefaults={initialDefaults}
        showSuperAdminTabs={showSuperAdminTabs}
      />
    </Feed>
  );
}
