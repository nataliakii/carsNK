import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { ROLE } from "@models/user";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { isAdminViewAsActive } from "@/domain/owners/ownerScope";

import LegalHubSection from "./LegalHubSection";

/**
 * /admin/legal — superadmin legal and compliance hub.
 *
 * Superadmin only, and unavailable while impersonating a company: the panel
 * exposes the operator's own configuration status, which a partner view must
 * never see.
 */
export default async function AdminLegalPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const isSuperadmin = Number(session.user?.role) === ROLE.SUPERADMIN;
  if (!isSuperadmin || isAdminViewAsActive(session.user)) {
    redirect("/admin");
  }

  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  return (
    <Feed
      cars={cars ? JSON.parse(JSON.stringify(cars)) : cars}
      orders={orders ? JSON.parse(JSON.stringify(orders)) : orders}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <LegalHubSection />
    </Feed>
  );
}
