import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { ROLE } from "@models/user";
import TransfersSection from "./TransfersSection";

/** /admin/transfers — superadmin only. */
export default async function TransfersPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/login");
  if (Number(session.user.role) !== ROLE.SUPERADMIN) redirect("/admin/cars");

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
      <TransfersSection />
    </Feed>
  );
}
