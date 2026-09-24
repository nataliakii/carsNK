import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@lib/authOptions";
import { applyAdminViewAsFromCookies } from "@/domain/owners/adminViewAs";
import { legalAreaDecision } from "@/domain/legal/companyLegalPage";
import { legacyLegalPartnersRedirect } from "@/domain/admin/partnersPage";
import { platformSettingsHref } from "@/domain/admin/platformSettingsNav";

/**
 * /admin/legal — redirects into Settings → Legal documents (or Partners review).
 */
export default async function AdminLegalPage({ searchParams }) {
  unstable_noStore();

  const rawSession = await getServerSession(authOptions);
  const session = await applyAdminViewAsFromCookies(rawSession);
  if (!session?.user?.isAdmin) redirect("/login");

  const access = legalAreaDecision(session.user);
  if (!access.allow) redirect(access.redirectTo);

  const reviewHref = legacyLegalPartnersRedirect(searchParams || {});
  if (reviewHref) redirect(reviewHref);

  const section = String(searchParams?.tab || "").trim();
  const legalSections = new Set(["documents", "settings", "audit"]);
  redirect(
    platformSettingsHref(
      "legal",
      legalSections.has(section) ? { section } : {}
    )
  );
}
