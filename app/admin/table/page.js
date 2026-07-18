import { DataLoader } from "@/app/admin/features/shared";

/**
 * /admin/table - страница таблицы заказов (альтернативный путь)
 */
export default function PageTable() {
  return <DataLoader viewType="orders-table" />;
}
