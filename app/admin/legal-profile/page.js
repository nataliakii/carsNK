import { redirect } from "next/navigation";

import { legacyLegalProfileRedirect } from "@/domain/legal/companyLegalPage";

/**
 * Older partner legal URL. Company admins belong on /admin/company/legal.
 */
export default function PartnerLegalProfilePage() {
  redirect(legacyLegalProfileRedirect("/admin/legal-profile"));
}
