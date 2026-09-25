import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { previewTransferQuote } from "@/domain/transfers/createTransferOrder";
import { resolveMarketCountry } from "@/domain/platform/marketCountry";
import {
  QUOTE_TIMEOUT_MS,
  validatePublicQuoteRequest,
} from "@/domain/transfers/validatePublicQuoteRequest";
import {
  sanitizeProviderErrorMessage,
  redactSecretsForLog,
} from "@/domain/transfers/sanitizeProviderError";
import {
  consumePublicPostOrError,
  quoteRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("QUOTE_TIMEOUT");
      err.code = "QUOTE_TIMEOUT";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Server-side transfer quote preview.
 * Never trusts browser distance/price. Rate-limited; no API keys in responses.
 */
export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const marketCountry = resolveMarketCountry(request);
  const validated = validatePublicQuoteRequest(payload, { marketCountry });
  if (!validated.ok) {
    return json(
      { success: false, message: validated.message, code: validated.code },
      400
    );
  }

  try {
    await connectToDB();
    const limited = await consumePublicPostOrError(
      request,
      quoteRateLimitOptions()
    );
    if (limited) return json(limited.body, limited.status);

    const result = await withTimeout(
      previewTransferQuote(validated.payload, { marketCountry }),
      QUOTE_TIMEOUT_MS
    );
    if (!result.ok) {
      return json(
        {
          success: false,
          message: sanitizeProviderErrorMessage(result.message),
          code: result.code,
        },
        result.code === "capacity" ? 422 : 400
      );
    }
    return json({
      success: true,
      quote: result.quote,
      route: result.route,
      vehicleCategory: result.vehicleCategory,
    });
  } catch (error) {
    console.error(
      "[transfer quote] failed",
      error?.code || error?.name,
      redactSecretsForLog(error?.message)
    );
    const timedOut = error?.code === "QUOTE_TIMEOUT";
    return json(
      {
        success: false,
        message: timedOut
          ? "Distance provider unavailable"
          : "Quote failed",
      },
      timedOut ? 504 : 502
    );
  }
}
