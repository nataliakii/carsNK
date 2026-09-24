import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import {
  PLATFORM_SETTINGS_PATH,
  platformSettingsAccess,
  resolvePlatformSettingsTab,
} from "@/domain/admin/platformSettingsNav";
import { loadVoucherHubData } from "@/app/admin/vouchers/loadVoucherHubData";
import PlatformSettingsSection from "./PlatformSettingsSection";

/**
 * /admin/settings — superadmin platform Settings (header → tabs → content).
 */
export default async function PlatformSettingsPage({ searchParams }) {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const access = platformSettingsAccess(session.user);
  if (!access.allow) redirect(access.redirectTo);

  const requested = searchParams?.tab;
  const tab = resolvePlatformSettingsTab(requested);
  if (requested !== tab) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (searchParams?.section) params.set("section", String(searchParams.section));
    redirect(`${PLATFORM_SETTINGS_PATH}?${params.toString()}`);
  }

  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  let voucherHub = null;
  try {
    voucherHub = await loadVoucherHubData(session);
  } catch (err) {
    console.error("[settings] voucher hub data", err);
  }

  return (
    <Feed
      cars={JSON.parse(JSON.stringify(cars || []))}
      orders={JSON.parse(JSON.stringify(orders || []))}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <PlatformSettingsSection voucherHub={voucherHub} />
    </Feed>
  );
}
