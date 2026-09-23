import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { legalAreaDecision } from "@/domain/legal/companyLegalPage";

import LegalHubSection from "./LegalHubSection";

/**
 * /admin/legal — superadmin hub: partner document review + platform publish.
 */
export default async function AdminLegalPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const access = legalAreaDecision(session.user);
  if (!access.allow) redirect(access.redirectTo);

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
      <Suspense fallback={null}>
        <LegalHubSection />
      </Suspense>
    </Feed>
  );
}
