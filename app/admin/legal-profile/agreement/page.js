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

import PartnerAgreementSection from "./PartnerAgreementSection";

/**
 * /admin/legal-profile/agreement — read and sign the Master Partner
 * Agreement. Same company scoping as the legal profile screen.
 */
export default async function PartnerAgreementPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const viewAsOwnerId = getEffectiveOwnerId(session?.user);
  if (Number(session.user.role) === ROLE.SUPERADMIN && !viewAsOwnerId) {
    redirect("/admin/owners");
  }

  const companyId =
    viewAsOwnerId ||
    (session.user.ownerId ? String(session.user.ownerId) : COMPANY_ID);

  const [company, cars, orders] = await Promise.all([
    getCompany(companyId),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  return (
    <Feed
      cars={JSON.parse(JSON.stringify(cars || []))}
      orders={JSON.parse(JSON.stringify(orders || []))}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <PartnerAgreementSection />
    </Feed>
  );
}
