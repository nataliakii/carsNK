import { NextResponse } from "next/server";
import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import {
  AGGREGATOR_CAR_SELECT,
  isAggregatorRequestAuthorized,
  mapCarToAggregatorDto,
} from "@/domain/aggregator/mapCarToAggregatorDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REAL_CARS_FILTER = {
  $or: [{ testingCar: false }, { testingCar: { $exists: false } }],
};

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowList = String(process.env.AGGREGATOR_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    allowList.length === 0
      ? "*"
      : allowList.includes(origin)
        ? origin
        : allowList[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, request) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    },
  });
}

export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

/**
 * GET /api/v1/aggregator/cars
 * Query:
 *   include=pricing  — include full pricingTiers
 *   class=economy    — filter by class
 *   limit=100        — max items (1–200, default 100)
 */
export async function GET(request) {
  if (!isAggregatorRequestAuthorized(request)) {
    return json(
      {
        success: false,
        error: "Unauthorized",
        message:
          "Provide a valid X-API-Key or Authorization: Bearer <AGGREGATOR_API_KEY>",
      },
      401,
      request
    );
  }

  const { searchParams } = new URL(request.url);
  const includePricing = String(searchParams.get("include") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes("pricing");
  const classFilter = String(searchParams.get("class") || "")
    .trim()
    .toLowerCase();
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
    : 100;

  try {
    await connectToDB();
    const filter = { ...REAL_CARS_FILTER };
    if (classFilter) {
      filter.class = classFilter;
    }

    const cars = await Car.find(filter)
      .select(AGGREGATOR_CAR_SELECT)
      .sort({ sort: 1, model: 1 })
      .limit(limit)
      .lean();

    const data = (cars || []).map((doc) =>
      mapCarToAggregatorDto(doc, { includePricing })
    );

    return json(
      {
        success: true,
        meta: {
          count: data.length,
          limit,
          currency: "EUR",
          generatedAt: new Date().toISOString(),
        },
        data,
      },
      200,
      request
    );
  } catch (err) {
    console.error("[aggregator/cars]", err);
    return json(
      { success: false, error: "Server error", message: err.message },
      500,
      request
    );
  }
}
