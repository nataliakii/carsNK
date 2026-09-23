import { redirect } from "next/navigation";

import { COMPANY_LEGAL_PATH } from "@/domain/legal/companyLegalPage";

export default function PartnerAgreementPage() {
  redirect(`${COMPANY_LEGAL_PATH}?tab=terms`);
}
