import { notFound, permanentRedirect } from "next/navigation";
import { getCarById } from "@/domain/services";
import { getDefaultLocale, getCarPath } from "@domain/locationSeo/locationSeoService";

const MONGO_ID_REGEX = /^[0-9a-f]{24}$/i;

export async function generateMetadata() {
  return {
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function LegacyCarsSlugRedirectPage({ params }) {
  const raw = params.slug;
  const defaultLocale = getDefaultLocale();

  // If this looks like a MongoDB ObjectId, resolve the real slug and redirect
  if (MONGO_ID_REGEX.test(raw)) {
    const car = await getCarById(raw).catch(() => null);
    if (car?.slug) {
      permanentRedirect(getCarPath(defaultLocale, car.slug));
    }
    notFound();
  }

  permanentRedirect(`/${defaultLocale}/cars/${encodeURIComponent(raw)}`);
}
