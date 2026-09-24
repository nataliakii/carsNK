import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { ROLE } from "@models/user";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";
import { platformSettingsHref } from "@/domain/admin/platformSettingsNav";

/** Old delivery-zones bookmarks → Settings (platform) or Company (partner). */
export default async function DeliveryZonesPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const hasCompanyContext = Boolean(
    getEffectiveOwnerId(session?.user) ||
      (Number(session.user.role) !== ROLE.SUPERADMIN && session.user.ownerId)
  );

  if (!hasCompanyContext && Number(session.user.role) === ROLE.SUPERADMIN) {
    redirect(platformSettingsHref("delivery"));
  }
  redirect("/admin/company?tab=delivery");
}
