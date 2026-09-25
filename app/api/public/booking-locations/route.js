import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { resolveCompanyBookingCoverage } from "@/domain/orders/companyBookingCoverage";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";
import { resolveMarketCountry } from "@/domain/platform/marketCountry";
import PlatformCity from "@models/platformCity";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    return NextResponse.json(
      {
        success: true,
        companyId: "",
        names: [],
        cities: [],
        coverage: null,
        queryKey: ["booking-coverage", ""],
      },
      { status: 200 }
    );
  }

  try {
    await connectToDB();
    const company = await Company.findById(companyId)
      .select(
        "name cityIds locations coords orderRadiusKm country offices deliveryPricing serviceAreas updatedAt"
      )
      .lean();
    // A supplier from another market must not publish its pickup points here.
    if (!company || !isCompanyInSiteCountry(company, resolveMarketCountry(request))) {
      return NextResponse.json(
        { success: false, message: "Company not found" },
        { status: 404 }
      );
    }
    const ids = (company.cityIds || []).filter((id) =>
      mongoose.Types.ObjectId.isValid(String(id))
    );
    const catalogCities = ids.length
      ? await PlatformCity.find({
          _id: { $in: ids },
          isActive: { $ne: false },
        }).lean()
      : [];
    const coverage = resolveCompanyBookingCoverage({
      company,
      catalogCities,
    });
    const cities = coverage.deliveryAreas.map((area) => ({
      _id: area.id,
      name: area.name,
      country: area.countryCode,
      kind: area.kind || "city",
      requiresAddressDetail: area.kind !== "airport",
      coords: area.coords,
      provinceCode: area.provinceCode || "",
    }));
    return NextResponse.json({
      success: true,
      companyId: String(company._id),
      orderRadiusKm:
        company.orderRadiusKm == null || company.orderRadiusKm === ""
          ? null
          : Number(company.orderRadiusKm),
      coords: company.coords || null,
      names: coverage.deliveryAreas.map((area) => area.name),
      cities,
      coverage,
      queryKey: coverage.queryKey,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load locations" },
      { status: 500 }
    );
  }
}
