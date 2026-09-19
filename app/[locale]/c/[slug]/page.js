import { notFound } from "next/navigation";
import Feed from "@app/components/Feed";
import CarGrid from "@app/components/CarGrid";
import { Box, Typography } from "@mui/material";
import {
  isRoutableLocale,
  normalizeRoutableLocale,
} from "@domain/locationSeo/locationSeoService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { getCars, getCompanyBySlug, getActiveOrders } from "@/domain/services";
import { filterPublicCars } from "@/domain/owners/ownerScope";
import { loadCompanyBookingCities } from "@/domain/platform/companyBookingCities";

export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const company = await getCompanyBySlug(params.slug).catch(() => null);
  const name = company?.name || "Car rental";
  return {
    title: `${name} | rovaro`,
    description: company?.slogan || `Rent a car from ${name}`,
    robots: { index: true, follow: true },
  };
}

export default async function CompanyStorefrontPage({ params }) {
  const locale = normalizeRoutableLocale(params.locale);
  if (!isRoutableLocale(params.locale)) notFound();

  const session = await getServerSession(authOptions);
  const company = await getCompanyBySlug(params.slug);
  if (!company) notFound();

  const [carsData, ordersData] = await Promise.all([
    getCars({ session, ownerId: String(company._id) }),
    getActiveOrders({ session }),
  ]);

  const publicCars = filterPublicCars(carsData);
  const cities = await loadCompanyBookingCities(company);
  const cityNames = cities.map((city) => city.name).filter(Boolean);

  return (
    <Feed
      cars={publicCars}
      orders={ordersData}
      isMain
      company={company}
      locale={locale}
    >
      <Box sx={{ px: { xs: 2, md: 4 }, pt: 2, pb: 1, textAlign: "center" }}>
        <Typography variant="h4" fontWeight={700}>
          {company.name}
        </Typography>
        {company.slogan ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {company.slogan}
          </Typography>
        ) : null}
        {cityNames.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {cityNames.join(" · ")}
          </Typography>
        ) : null}
        {company.orderRadiusKm != null &&
        company.orderRadiusKm !== "" &&
        Number.isFinite(Number(company.orderRadiusKm)) ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {`≤ ${Number(company.orderRadiusKm)} km`}
          </Typography>
        ) : null}
      </Box>
      <CarGrid />
    </Feed>
  );
}
