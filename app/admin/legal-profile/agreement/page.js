import { redirect } from "next/navigation";

import { companySetupHref } from "@/domain/legal/companySetupReadiness";

export default function PartnerAgreementPage() {
  redirect(companySetupHref("details"));
}
