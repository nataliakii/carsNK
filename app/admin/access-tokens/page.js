import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { ROLE } from "@models/user";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";
import { platformSettingsHref } from "@/domain/admin/platformSettingsNav";

/** Old access-tokens bookmarks → Settings Access (platform only). */
export default async function AccessTokensPage() {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const hasCompanyContext = Boolean(
    getEffectiveOwnerId(session?.user) ||
      (Number(session.user.role) !== ROLE.SUPERADMIN && session.user.ownerId)
  );

  if (!hasCompanyContext && Number(session.user.role) === ROLE.SUPERADMIN) {
    redirect(platformSettingsHref("access"));
  }
  redirect("/admin/company");
}
