import { NextResponse } from "next/server";
import { fetchPlaceAutocomplete, normalizePlaceAutocompleteTypes } from "@/domain/geo/googlePlaces";

export const dynamic = "force-dynamic";

/**
 * Intentionally not rate-limited via RateLimiterMongo.
 * That limiter requires a live mongoose connection and can hang with no
 * timeout when the client is stale — which left the booking address field
 * spinning on "Loading..." forever. Places deny/errors are fail-fast here;
 * the field falls back to a normal text input.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const typesRaw = body.types;
  const result = await fetchPlaceAutocomplete({
    input: body.input,
    country: body.country,
    language: body.language,
    sessionToken: body.sessionToken,
    types:
      typesRaw === undefined || typesRaw === null || typesRaw === ""
        ? ""
        : normalizePlaceAutocompleteTypes(typesRaw),
  });

  if (!result.configured || result.unavailable) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        unavailable: true,
        predictions: [],
        message: result.message || "Places API not configured",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    success: result.ok,
    configured: true,
    unavailable: false,
    predictions: result.predictions || [],
    message: result.ok ? undefined : result.message,
  });
}
