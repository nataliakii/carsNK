import { connectToDB } from "@lib/database";
import {
  consumePublicPostOrError,
  rentalQuoteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  jsonResponse,
  quotePublicRentalCar,
} from "./quotePublicRentalCar";

export async function POST(request) {
  try {
    const limited = await consumePublicPostOrError(
      request,
      rentalQuoteRateLimitOptions()
    );
    if (limited) {
      return jsonResponse({ status: limited.status, body: limited.body });
    }

    await connectToDB();
    const debugBody = await request.json();
    const result = await quotePublicRentalCar(debugBody);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({
      status: 500,
      body: { message: error.message },
    });
  }
}
