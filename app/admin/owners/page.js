import { unstable_noStore } from "next/cache";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@lib/authOptions";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import { ROLE } from "@models/user";
import OwnersSection from "./OwnersSection";

export default async function OwnersPage() {
  unstable_noStore();

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/login");
  if (Number(session.user.role) !== ROLE.SUPERADMIN) redirect("/admin/cars");

  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  return (
    <Feed
      cars={JSON.parse(JSON.stringify(cars || []))}
      orders={JSON.parse(JSON.stringify(orders || []))}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <OwnersSection />
    </Feed>
  );
}
