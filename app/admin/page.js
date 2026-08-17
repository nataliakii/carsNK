import { DataLoader } from "@/app/admin/features/shared";

/**
 * /admin — entry; calendar is the default admin home (same as navbar logo).
 */
export default function AdminPage() {
  return <DataLoader viewType="calendar" />;
}
