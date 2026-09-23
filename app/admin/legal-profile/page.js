import { redirect } from "next/navigation";

import { legacyLegalProfileRedirect } from "@/domain/legal/companyLegalPage";

/**
 * Older partner legal URL. Company admins belong on /admin/company/legal.
 */
export default function PartnerLegalProfilePage({ searchParams }) {
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : "";
  redirect(legacyLegalProfileRedirect(tab));
}
