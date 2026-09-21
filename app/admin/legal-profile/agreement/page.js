import { redirect } from "next/navigation";

/** Merged into Legal tabs — Profile | Agreement. */
export default function PartnerAgreementPage() {
  redirect("/admin/legal-profile?tab=agreement");
}
