import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { getSiteCountryConfig } from "@config/siteCountry";
import { getOrCreatePlatformSettings, toPublicPlatformPayload } from "@/domain/platform/platformSettingsService";
import { listActiveCitiesForCountry } from "@/domain/platform/companyBookingCities";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDB();
    const country = getSiteCountryConfig();
    const settings = await getOrCreatePlatformSettings();
    const cities = await listActiveCitiesForCountry(country.country);
    return NextResponse.json({
      success: true,
      ...toPublicPlatformPayload(settings),
      cities,
    });
  } catch (error) {
    const country = getSiteCountryConfig();
    return NextResponse.json({
      success: true,
      ...toPublicPlatformPayload(null),
      cities: [],
      warning: error.message,
    });
  }
}
