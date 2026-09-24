import { redirect } from "next/navigation";

import { legacyLegalProfileRedirect } from "@/domain/legal/companyLegalPage";

/**
 * Older company legal URL. The setup page is the only company destination.
 */
export default function CompanyLegalPage({ searchParams }) {
  redirect(legacyLegalProfileRedirect("/admin/company/legal", searchParams || {}));
}
