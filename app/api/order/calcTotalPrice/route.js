import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { toBusinessDateTime } from "@/domain/orders/numberOfDays";
import { toBooleanField } from "@/domain/orders/fieldUtils";
import { resolveRentalBookingContext } from "@/domain/booking/resolveRentalContext";
import {
  calculateAuthoritativeRentalPrice,
  RentalPricingError,
} from "@/domain/orders/rentalPricingService";
import {
  consumePublicPostOrError,
  rentalQuoteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import { getSiteCountryCode } from "@config/siteCountry";

export async function POST(request) {
  let debugBody;
  try {
    const limited = await consumePublicPostOrError(
      request,
      rentalQuoteRateLimitOptions()
    );
    if (limited) {
      return new Response(JSON.stringify(limited.body), {
        status: limited.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDB();
    debugBody = await request.json();
    const {
      carId,
      carNumber,
      regNumber,
      rentalStartDate,
      rentalEndDate,
      timeIn,
      timeOut,
      kacko = "TPL",
      childSeats = 0,
      secondDriver = false,
      placeIn,
      placeOut,
      promoCode,
      placeInDetail,
      placeOutDetail,
      placeInLat,
      placeInLon,
      placeOutLat,
      placeOutLon,
      placeInLocality,
      placeOutLocality,
    } = debugBody;
    const calculationStartSource = timeIn ?? rentalStartDate;
    const calculationEndSource = timeOut ?? rentalEndDate;
    const normalizedSecondDriver = toBooleanField(secondDriver, false);
    const normalizedCarId = carId != null ? String(carId).trim() : "";
    const normalizedCarNumber =
      typeof carNumber === "string" ? carNumber.trim() : "";
    const normalizedRegNumber =
      typeof regNumber === "string" ? regNumber.trim() : "";
    if (!normalizedCarId && !normalizedRegNumber && !normalizedCarNumber) {
      return new Response(JSON.stringify({ message: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let car = null;
    if (normalizedCarId && mongoose.Types.ObjectId.isValid(normalizedCarId)) {
      car = await Car.findById(normalizedCarId);
    }
    if (!car && normalizedCarNumber) {
      car = await Car.findOne({ carNumber: normalizedCarNumber });
    }
    if (!car && normalizedRegNumber) {
      car = await Car.findOne({ regNumber: normalizedRegNumber });
    }

    if (!car) {
      return new Response(JSON.stringify({ message: "Car not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const company = car.ownerId
      ? await Company.findById(car.ownerId).lean()
      : await Company.findById(COMPANY_ID).lean();

    const rentalContext = resolveRentalBookingContext({
      company,
      countryCode: company?.country || getSiteCountryCode(),
      forNewOrder: true,
    });

    const startDate = toBusinessDateTime(
      calculationStartSource,
      rentalContext.timezone
    );
    const endDate = toBusinessDateTime(
      calculationEndSource,
      rentalContext.timezone
    );
    if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
      return new Response(JSON.stringify({ message: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const quote = await calculateAuthoritativeRentalPrice({
      car,
      pickupAtUtc: startDate.utc().toDate(),
      returnAtUtc: endDate.utc().toDate(),
      timezone: rentalContext.timezone,
      insurance: kacko,
      childSeats,
      secondDriver: normalizedSecondDriver,
      placeIn,
      placeOut,
      placeInDetail,
      placeOutDetail,
      placeInLat,
      placeInLon,
      placeOutLat,
      placeOutLon,
      placeInLocality,
      placeOutLocality,
      company,
      bookingMode: rentalContext.bookingMode,
      promoCode,
    });

    return new Response(
      JSON.stringify({
        totalPrice: quote.compatibility.totalPrice,
        days: quote.rentalDays,
        currency: quote.currency,
        timezone: rentalContext.timezone,
        bookingMode: rentalContext.bookingMode,
        grossMinor: quote.grossMinor,
        breakdown: quote.compatibility.breakdown,
        authoritativePrice: {
          currency: quote.currency,
          rentalDays: quote.rentalDays,
          baseRentalMinor: quote.baseRentalMinor,
          discountMinor: quote.discountMinor,
          insuranceMinor: quote.insuranceMinor,
          extrasMinor: quote.extrasMinor,
          pickupFeeMinor: quote.pickupFeeMinor,
          returnFeeMinor: quote.returnFeeMinor,
          grossMinor: quote.grossMinor,
          prepaymentPercent: quote.prepaymentPercent,
          prepaymentMinor: quote.prepaymentMinor,
          balanceMinor: quote.balanceMinor,
          pricingVersion: quote.pricingVersion,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    if (error instanceof RentalPricingError) {
      return new Response(
        JSON.stringify({ message: error.message, code: error.code }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
