import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import DeliveryZonesSection from "./DeliveryZonesSection";

/**
 * /admin/delivery-zones — зоны доставки в том же shell, что и календарь/таблица:
 * Feed + Navbar + контекст компании/машин/заказов.
 */
export default async function DeliveryZonesPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  const safeCompany = company ? JSON.parse(JSON.stringify(company)) : company;
  const safeCars = cars ? JSON.parse(JSON.stringify(cars)) : cars;
  const safeOrders = orders ? JSON.parse(JSON.stringify(orders)) : orders;

  return (
    <Feed
      cars={safeCars}
      orders={safeOrders}
      company={safeCompany}
      isAdmin
      isMain={false}
    >
      <DeliveryZonesSection />
    </Feed>
  );
}
