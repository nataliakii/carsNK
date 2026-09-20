import { NextResponse } from "next/server";
import {
  consumePublicPostOrError,
  rentalQuoteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import {
  fetchPlaceAutocomplete,
  normalizePlaceAutocompleteTypes,
} from "@/domain/geo/googlePlaces";

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

  const result = await fetchPlaceAutocomplete({
    input: body.input,
    country: body.country,
    language: body.language,
    sessionToken: body.sessionToken,
    types: normalizePlaceAutocompleteTypes(body.types),
  });

  if (!result.configured) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        predictions: [],
        message: result.message || "Places API not configured",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    success: result.ok,
    configured: true,
    predictions: result.predictions || [],
    message: result.ok ? undefined : result.message,
  });
}
