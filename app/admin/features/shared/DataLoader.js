import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import AdminView from "./AdminView";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";

/**
 * DataLoader — Server Component для загрузки данных админки
 *
 * Загрузка происходит на сервере через await Promise.all(),
 * поэтому Suspense здесь не нужен — данные уже готовы.
 *
 * Lazy-loading секций происходит в AdminView через dynamic().
 */
export default async function DataLoader({ viewType }) {
  unstable_noStore(); // Отключаем кеширование для админки

  const session = await getServerSession(authOptions);
  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  // Next/React Server Components contract: only pass plain JSON-serializable objects to Client Components.
  // Mongo ObjectId, Date, Map, etc. may break rendering (e.g. calendar shows no orders).
  const safeCompany = company ? JSON.parse(JSON.stringify(company)) : company;
  const safeCars = cars ? JSON.parse(JSON.stringify(cars)) : cars;
  const safeOrders = orders ? JSON.parse(JSON.stringify(orders)) : orders;

  // Данные уже загружены — передаём в AdminView без Suspense
  return (
    <AdminView
      company={safeCompany}
      cars={safeCars}
      orders={safeOrders}
      viewType={viewType}
    />
  );
}
