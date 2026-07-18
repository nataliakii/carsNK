import { DataLoader } from "@/app/admin/features/shared";

/**
 * /admin/orders - страница таблицы заказов (canonical route)
 * 
 * Таблица всех заказов с фильтрами:
 * - По машине
 * - По дате (pickup/return overlap)
 * - По статусу (confirmed/pending)
 * - По источнику (my_order true/false)
 * - Поиск по тексту
 */
export default function PageOrders() {
  return <DataLoader viewType="table" />;
}
