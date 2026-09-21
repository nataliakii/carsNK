import { redirect } from "next/navigation";

/** Merged into Company tabs — old bookmarks keep working. */
export default function VouchersPage({ searchParams }) {
  const tab = searchParams?.tab;
  if (tab === "access-links") redirect("/admin/company?tab=access-links");
  if (tab === "platform") redirect("/admin/company?tab=platform");
  redirect("/admin/company?tab=vouchers");
}
