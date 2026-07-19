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
 * GET /api/v1/aggregator/cars/[idOrSlug]
 */
export async function GET(request, { params }) {
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

  const idOrSlug = String(params?.idOrSlug || "").trim();
  if (!idOrSlug) {
    return json(
      { success: false, error: "Bad request", message: "id or slug required" },
      400,
      request
    );
  }

  const { searchParams } = new URL(request.url);
  const includePricing = String(searchParams.get("include") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes("pricing");

  try {
    await connectToDB();
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
    const filter = {
      ...REAL_CARS_FILTER,
      ...(isObjectId
        ? { _id: idOrSlug }
        : { slug: idOrSlug.toLowerCase() }),
    };

    const doc = await Car.findOne(filter).select(AGGREGATOR_CAR_SELECT).lean();
    if (!doc) {
      return json(
        { success: false, error: "Not found", message: "Car not found" },
        404,
        request
      );
    }

    return json(
      {
        success: true,
        data: mapCarToAggregatorDto(doc, { includePricing }),
      },
      200,
      request
    );
  } catch (err) {
    console.error("[aggregator/cars/:id]", err);
    return json(
      { success: false, error: "Server error", message: err.message },
      500,
      request
    );
  }
}
