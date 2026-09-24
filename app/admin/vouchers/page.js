import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { ROLE } from "@models/user";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";
import { platformSettingsHref } from "@/domain/admin/platformSettingsNav";

/**
 * Old /admin/vouchers bookmarks.
 * Superadmin platform → Settings vouchers; company context → Company vouchers.
 */
export default async function VouchersPage({ searchParams }) {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const hasCompanyContext = Boolean(
    getEffectiveOwnerId(session?.user) ||
      (Number(session.user.role) !== ROLE.SUPERADMIN && session.user.ownerId)
  );

  const tab = searchParams?.tab;
  if (!hasCompanyContext && Number(session.user.role) === ROLE.SUPERADMIN) {
    if (tab === "access-links") redirect(platformSettingsHref("access"));
    if (tab === "platform") redirect(platformSettingsHref("general"));
    redirect(platformSettingsHref("vouchers"));
  }

  // Company hub no longer hosts platform Access/Catalogue tabs.
  redirect("/admin/company?tab=vouchers");
}
