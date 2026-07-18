import { DataLoader } from "@/app/admin/features/shared";

/**
 * /admin - главная страница админки (автомобили)
 * Редирект на /admin/cars
 */
export default function AdminPage() {
  return <DataLoader viewType="orders" />;
}
