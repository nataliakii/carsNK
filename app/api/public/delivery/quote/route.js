import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import Company from "@models/company";
import {
  consumePublicPostOrError,
  rentalQuoteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  LocationQuoteError,
  quoteAuthoritativeLocations,
} from "@/domain/orders/authoritativeLocationQuote";
import { publicOfficeView } from "@/domain/company/officeRecord";
import {
  isMarketplaceOperatingCompany,
  isPublicMarketplaceCarAllowed,
} from "@/domain/legal/partnerOperatingPolicy";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const limited = await consumePublicPostOrError(
    request,
    rentalQuoteRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const carId = String(body.carId || "").trim();
  if (!carId) {
    return NextResponse.json(
      { success: false, message: "carId is required" },
      { status: 400 }
    );
  }

  try {
    await connectToDB();
    const car = await Car.findById(carId).lean();
    if (!car) {
      return NextResponse.json(
        { success: false, message: "Car not found" },
        { status: 404 }
      );
    }
    const company = await Company.findById(car.ownerId).lean();
    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found" },
        { status: 404 }
      );
    }
    if (
      isMarketplaceOperatingCompany(company) &&
      !(await isPublicMarketplaceCarAllowed({ car, company }))
    ) {
      return NextResponse.json(
        { success: false, message: "Car not found" },
        { status: 404 }
      );
    }

    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: body.pickup,
      dropoff: body.return || body.dropoff,
      language: body.language,
      sessionToken: body.sessionToken,
    });

    return NextResponse.json({
      success: true,
      snapshot: quote.snapshot,
      deliveryIn: quote.delivery.deliveryIn,
      deliveryOut: quote.delivery.deliveryOut,
      deliveryTotal: quote.delivery.deliveryTotal,
      offices: quote.eligibleOffices
        .map((row) => publicOfficeView(row, { companyPhone: company.tel }))
        .filter(Boolean),
    });
  } catch (err) {
    if (err instanceof LocationQuoteError) {
      return NextResponse.json(
        { success: false, code: err.code, message: err.message },
        { status: err.code === "PLACES_UNAVAILABLE" ? 503 : 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Quote failed" },
      { status: 500 }
    );
  }
}
