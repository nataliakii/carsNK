import { DataLoader } from "@/app/admin/features/shared";

/**
 * /admin/orders-calendar - страница большого календаря заказов
 */
export default function PageOrdersCalendar() {
  return <DataLoader viewType="calendar" />;
}
