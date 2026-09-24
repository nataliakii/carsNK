import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { resolveAdminViewMode } from "@/domain/admin/adminViewMode";
import {
  companyLegalPageAccess,
  selectedCompanyForLegalPage,
} from "@/domain/legal/companyLegalPage";

import CompanyLegalSection from "../legal/CompanyLegalSection";

/**
 * Canonical company setup: details, documents, terms.
 */
export default async function CompanySetupPage() {
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
        <CompanyLegalSection viewMode={resolveAdminViewMode(session.user)} />
      </Suspense>
    </Feed>
  );
}
