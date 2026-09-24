import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";
import { partnersPageAccess, partnersTabHref } from "@/domain/admin/partnersPage";

import PartnersSection from "./PartnersSection";

/**
 * /admin/partners — superadmin partner list and review queue.
 */
export default async function PartnersPage({ searchParams }) {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const access = partnersPageAccess(session.user);
  if (!access.allow) redirect(access.redirectTo);

  const tab = searchParams?.tab === "review" ? "review" : "all";
  if (searchParams?.tab !== tab) {
    redirect(partnersTabHref(tab));
  }

  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
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
        <PartnersSection viewMode={ADMIN_VIEW_MODE.PLATFORM_ADMIN} />
      </Suspense>
    </Feed>
  );
}
