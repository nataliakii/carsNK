import { unstable_noStore } from "next/cache";
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
import TransferVouchersSection from "./TransferVouchersSection";

function serializeCompany(doc) {
  if (!doc) return null;
  return {
    _id: String(doc._id),
    name: doc.name || "",
    tel: doc.tel || "",
    address: doc.address || "",
    voucherStampSrc: getCompanyVoucherStampSrc(doc),
  };
}

export default async function VouchersPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  await connectToDB();

  const role = Number(session?.user?.role);
  const isSuperadmin = role === ROLE.SUPERADMIN;
  const ownerId = session?.user?.ownerId;

  let voucherCompany = null;
  let initialDefaults = null;
  let companies = [];

  if (isSuperadmin) {
    const all = await Company.find({}).sort({ name: 1 }).lean();
    companies = (all || []).map(serializeCompany).filter(Boolean);
    const natali = (all || []).find((c) => isNataliCarsCompany(c));
    const pick = natali || all?.[0] || null;
    if (pick) {
      voucherCompany = serializeCompany(pick);
      initialDefaults = buildCompanyVoucherDefaults(pick);
    }
  } else if (ownerId) {
    const owned = await Company.findById(ownerId).lean();
    if (owned) {
      voucherCompany = serializeCompany(owned);
      initialDefaults = buildCompanyVoucherDefaults(owned);
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
      <TransferVouchersSection
        company={voucherCompany}
        companies={companies}
        canPickCompany={isSuperadmin && companies.length > 1}
        initialDefaults={initialDefaults}
      />
    </Feed>
  );
}
