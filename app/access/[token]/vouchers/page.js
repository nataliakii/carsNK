import { unstable_noStore } from "next/cache";
import { notFound } from "next/navigation";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { ACCESS_SCOPE } from "@/domain/auth/accessScopes";
import { resolveScopedAccessToken } from "@/domain/auth/scopedAccessToken";
import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
} from "@/domain/vouchers/companyStamp";
import TransferVouchersSection from "@/app/admin/vouchers/TransferVouchersSection";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Transfer voucher",
};

/**
 * Passwordless voucher page:
 * /access/[token]/vouchers
 * Token must include scope vouchers.transfer and binds to one company (stamp).
 */
export default async function AccessVouchersPage({ params }) {
  unstable_noStore();
  const rawToken = decodeURIComponent(String(params?.token || "").trim());
  const access = await resolveScopedAccessToken(
    rawToken,
    ACCESS_SCOPE.VOUCHERS_TRANSFER
  );
  if (!access) notFound();

  await connectToDB();
  const company = await Company.findById(access.ownerId).lean();
  if (!company) notFound();

  const defaults = buildCompanyVoucherDefaults(company);
  const safeCompany = {
    _id: String(company._id),
    name: company.name,
    voucherStampSrc: getCompanyVoucherStampSrc(company),
  };

  return (
    <TransferVouchersSection
      mode="token"
      accessToken={rawToken}
      company={safeCompany}
      initialDefaults={defaults}
      emailApiPath={`/api/access/${encodeURIComponent(rawToken)}/vouchers/email`}
    />
  );
}
