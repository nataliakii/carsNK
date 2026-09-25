import { unstable_noStore } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import Feed from "@app/components/Feed";
import PublicBookingDetails from "@app/components/sections/PublicBookingDetails";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import Company from "@models/company";
import { loadPublicBookingPage } from "@/domain/booking/publicBookingView";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export const metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function clientIp(headerList) {
  const forwarded = headerList.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim();
  return first || headerList.get("x-real-ip") || "unknown";
}

export default async function PublicBookingPage({ params, searchParams }) {
  unstable_noStore();
  const { locale: rawLocale, publicReference } = await params;
  const query = await searchParams;
  if (!isRoutableLocale(rawLocale)) notFound();
  const locale = normalizeRoutableLocale(rawLocale);
  const accessToken = typeof query?.access === "string" ? query.access : "";
  const headerList = await headers();

  await connectToDB();
  const view = await loadPublicBookingPage({
    publicReference,
    accessToken,
    locale,
    ip: clientIp(headerList),
    findOrder: (reference) =>
      Order.findOne({ publicReference: reference }).lean(),
    findCompany: (order) =>
      order?.ownerId
        ? Company.findById(order.ownerId)
            .select("name email meetingContactPhone meetingContacts customerRentalTerms")
            .lean()
        : null,
  });

  if (!view) notFound();

  return (
    <Feed locale={locale}>
      <PublicBookingDetails view={view} />
    </Feed>
  );
}
