import { unstable_noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { ROLE } from "@models/user";
import Feed from "@app/components/Feed";
import { getCars, getCompany, getAllOrders } from "@/domain/services";
import { COMPANY_ID } from "@/config/company";
import AccessTokensSection from "./AccessTokensSection";

export default async function AccessTokensPage() {
  unstable_noStore();
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) redirect("/login");
  if (Number(session.user.role) !== ROLE.SUPERADMIN) {
    redirect("/admin/cars");
  }

  const [company, cars, orders] = await Promise.all([
    getCompany(COMPANY_ID),
    getCars({ session }),
    getAllOrders({ session }),
  ]);

  return (
    <Feed
      cars={cars ? JSON.parse(JSON.stringify(cars)) : cars}
      orders={orders ? JSON.parse(JSON.stringify(orders)) : orders}
      company={company ? JSON.parse(JSON.stringify(company)) : company}
      isAdmin
      isMain={false}
    >
      <AccessTokensSection />
    </Feed>
  );
}
