import { connectToDB } from "@lib/database";
import {
  consumePublicPostOrError,
  rentalQuoteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  jsonResponse,
  quotePublicRentalCar,
} from "../quotePublicRentalCar";
import { hasCompleteRange } from "@/domain/booking/publicBookingMode";
import { normalizeCatalogCarIds } from "@/domain/booking/catalogQuoteBatch";

export async function POST(request) {
  try {
    const limited = await consumePublicPostOrError(
      request,
      rentalQuoteRateLimitOptions()
    );
    if (limited) {
      return jsonResponse({ status: limited.status, body: limited.body });
    }

    const body = await request.json();
    const startDate = body?.rentalStartDate;
    const endDate = body?.rentalEndDate;
    const carIds = normalizeCatalogCarIds(body?.carIds);

    if (!hasCompleteRange(startDate, endDate) || carIds.length === 0) {
      return jsonResponse({
        status: 400,
        body: { message: "Missing parameters" },
      });
    }

    await connectToDB();

    const quotes = {};
    for (const carId of carIds) {
      try {
        const result = await quotePublicRentalCar({
          ...body,
          carId,
          kacko: undefined,
          rentalStartDate: startDate,
          rentalEndDate: endDate,
        });
        quotes[carId] =
          result.status === 200
            ? { ok: true, ...result.body }
            : { ok: false, available: false, totalPrice: 0, days: 0 };
      } catch {
        quotes[carId] = { ok: false, available: false, totalPrice: 0, days: 0 };
      }
    }

    return jsonResponse({
      status: 200,
      body: { ok: true, quotes },
    });
  } catch (error) {
    return jsonResponse({
      status: 500,
      body: { message: error.message },
    });
  }
}
