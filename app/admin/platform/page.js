import { redirect } from "next/navigation";

/** Merged into Company tabs — kept so old links and bookmarks keep working. */
export default function PlatformPage() {
  redirect("/admin/company?tab=platform");
}
