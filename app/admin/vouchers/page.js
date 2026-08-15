import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
} from "@/domain/vouchers/companyStamp";
import TransferVouchersSection from "./TransferVouchersSection";

export default async function VouchersPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  let voucherCompany = null;
  let initialDefaults = null;
  const ownerId = session?.user?.ownerId;
  if (ownerId) {
    await connectToDB();
    const owned = await Company.findById(ownerId).lean();
    if (owned) {
      voucherCompany = {
        _id: String(owned._id),
        name: owned.name,
        voucherStampSrc: getCompanyVoucherStampSrc(owned),
      };
      initialDefaults = buildCompanyVoucherDefaults(owned);
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
        initialDefaults={initialDefaults}
      />
    </Feed>
  );
}
