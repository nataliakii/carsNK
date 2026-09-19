import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { loadCompanyBookingCities, toPublicCompanyStorefront } from "@/domain/platform/companyBookingCities";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const slug = String(params?.slug || "").trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ success: false, message: "slug required" }, { status: 400 });
  }

  try {
    await connectToDB();
    const company = await Company.findOne({
      slug,
      storefrontEnabled: { $ne: false },
    }).lean();
    if (!company || !isCompanyInSiteCountry(company)) {
      return NextResponse.json({ success: false, message: "Storefront not found" }, { status: 404 });
    }
    const cities = await loadCompanyBookingCities(company);
    return NextResponse.json({
      success: true,
      company: toPublicCompanyStorefront(company, cities),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load storefront" },
      { status: 500 }
    );
  }
}
