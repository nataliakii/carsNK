import { redirect } from "next/navigation";

import { PARTNERS_PATH } from "@/domain/admin/partnersPage";

/** Older partner-companies URL. */
export default function OwnersPage() {
  redirect(PARTNERS_PATH);
}
