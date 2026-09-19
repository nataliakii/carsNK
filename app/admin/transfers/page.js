import { redirect } from "next/navigation";

/**
 * Legacy path — transfers live under Orders tabs.
 * /admin/orders?tab=transfers
 */
export default function TransfersPage() {
  redirect("/admin/orders?tab=transfers");
}
