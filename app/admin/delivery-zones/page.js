import { redirect } from "next/navigation";

/** Merged into Company → Delivery & pricing. */
export default function DeliveryZonesPage() {
  redirect("/admin/company?tab=delivery");
}
