import { Suspense } from "react";
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

import CompanyLegalSection from "./CompanyLegalSection";

/**
 * /admin/company/legal — the signed-in company's legal page.
 * Superadmin without a selected company stays on the superadmin hub.
 */
export default async function CompanyLegalPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  const viewAsOwnerId = getEffectiveOwnerId(session?.user);
  if (isSuperadmin && !viewAsOwnerId) {
    redirect("/admin/legal");
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
      <Suspense fallback={null}>
        <CompanyLegalSection />
      </Suspense>
    </Feed>
  );
}
