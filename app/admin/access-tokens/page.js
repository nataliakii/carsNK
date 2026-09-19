import { redirect } from "next/navigation";

/** Merged into the vouchers hub — kept so old links and bookmarks keep working. */
export default function AccessTokensPage() {
  redirect("/admin/vouchers?tab=access-links");
}
