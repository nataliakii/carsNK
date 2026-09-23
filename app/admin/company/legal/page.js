import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import {
  companyLegalPageAccess,
  selectedCompanyForLegalPage,
} from "@/domain/legal/companyLegalPage";

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

  const access = companyLegalPageAccess(session.user);
  if (!access.allow) redirect(access.redirectTo);

  const companyId = selectedCompanyForLegalPage(session.user);
  if (!companyId) redirect("/admin");

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
