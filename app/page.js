import { redirect } from "next/navigation";
import { getDefaultLocale } from "@domain/locationSeo/locationSeoService";

export default function HomePageRedirect() {
  const locale = getDefaultLocale();
  redirect(`/${locale}`);
}
