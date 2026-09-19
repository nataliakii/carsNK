import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { loadCompanyBookingCities } from "@/domain/platform/companyBookingCities";
import { COMPANY_ID } from "@config/company";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  const id =
    companyId && mongoose.Types.ObjectId.isValid(companyId)
      ? companyId
      : COMPANY_ID;

  try {
    await connectToDB();
    const company = await Company.findById(id)
      .select("name cityIds locations coords orderRadiusKm country")
      .lean();
    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found" },
        { status: 404 }
      );
    }
    const cities = await loadCompanyBookingCities(company);
    return NextResponse.json({
      success: true,
      companyId: String(company._id),
      orderRadiusKm:
        company.orderRadiusKm == null || company.orderRadiusKm === ""
          ? null
          : Number(company.orderRadiusKm),
      coords: company.coords || null,
      names: cities.map((city) => city.name),
      cities,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load locations" },
      { status: 500 }
    );
  }
}
