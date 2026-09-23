import { NextResponse } from "next/server";
import { fetchPlaceAutocomplete, normalizePlaceAutocompleteTypes } from "@/domain/geo/googlePlaces";
import {
  consumePublicPostOrError,
  placesAutocompleteRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const dynamic = "force-dynamic";

const MIN_INPUT_LENGTH = 3;

/**
 * Public Places autocomplete proxy. Never exposes the Maps key to the browser.
 * Short queries skip the provider and do not consume rate-limit points.
 * Rate limiting reuses the same publicPostRateLimit helper as other public POSTs.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = String(body.input || "").trim();
  if (input.length < MIN_INPUT_LENGTH) {
    return NextResponse.json({
      success: true,
      configured: true,
      unavailable: false,
      predictions: [],
      shortQuery: true,
    });
  }

  const limited = await consumePublicPostOrError(
    request,
    placesAutocompleteRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(
      {
        ...limited.body,
        configured: true,
        unavailable: limited.body?.code === "SERVICE_UNAVAILABLE",
        predictions: [],
      },
      { status: limited.status }
    );
  }

  const typesRaw = body.types;
  const result = await fetchPlaceAutocomplete({
    input,
    country: body.country,
    language: body.language,
    sessionToken: body.sessionToken,
    types:
      typesRaw === undefined || typesRaw === null || typesRaw === ""
        ? ""
        : normalizePlaceAutocompleteTypes(typesRaw),
  });

  if (!result.configured) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        unavailable: true,
        reason: result.reason || "not_configured",
        predictions: [],
        message: result.message || "Places API not configured",
      },
      { status: 200 }
    );
  }

  if (result.unavailable || result.ok === false) {
    return NextResponse.json(
      {
        success: false,
        configured: true,
        unavailable: true,
        reason: result.reason || undefined,
        predictions: [],
        message: result.message || "Places autocomplete failed",
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
