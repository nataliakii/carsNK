import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { ROLE } from "@models/user";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";
import CompanyProfileSection from "./CompanyProfileSection";
import { loadVoucherHubData } from "@/app/admin/vouchers/loadVoucherHubData";

export default async function CompanyProfilePage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const viewAsOwnerId = getEffectiveOwnerId(session?.user);
  const hasCompanyContext = Boolean(
    viewAsOwnerId ||
      (Number(session.user.role) !== ROLE.SUPERADMIN && session.user.ownerId)
  );

  const companyId =
    viewAsOwnerId ||
    (session.user.ownerId ? String(session.user.ownerId) : COMPANY_ID);

  const [company, cars, orders] = await Promise.all([
    getCompany(companyId),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  let voucherHub = null;
  try {
    voucherHub = await loadVoucherHubData(session);
  } catch (err) {
    console.error("[company] voucher hub data", err);
  }

  return (
    <Feed
      cars={JSON.parse(JSON.stringify(cars || []))}
      orders={JSON.parse(JSON.stringify(orders || []))}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <CompanyProfileSection
        companyId={hasCompanyContext ? companyId : ""}
        hasCompanyContext={hasCompanyContext}
        voucherHub={voucherHub}
      />
    </Feed>
  );
}
