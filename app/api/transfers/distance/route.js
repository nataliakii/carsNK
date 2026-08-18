import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import {
  getTransferDistance,
  getTransferBaseDistances,
} from "@/domain/transfers/getTransferDistance";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const from = String(payload?.from || "").trim();
  const to = String(payload?.to || "").trim();
  if (!from || !to) {
    return json({ success: false, message: "from and to are required" }, 400);
  }

  await connectToDB();
  const company = await Company.findById(COMPANY_ID).lean();
  const baseCoords = {
    lat: company?.coords?.lat,
    lon: company?.coords?.lon,
  };

  const [result, baseResult] = await Promise.all([
    getTransferDistance({ from, to }),
    getTransferBaseDistances({ baseCoords, from, to }),
  ]);

  if (!result.ok) {
    const status = String(result.message || "").includes("GOOGLE_MAPS_API_KEY")
      ? 503
      : 422;
    return json({ success: false, message: result.message }, status);
  }

  return json({
    success: true,
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    distanceText: result.distanceText,
    durationText: result.durationText,
    approximate: Boolean(result.approximate),
    baseFromDistanceKm: baseResult.baseToFrom.ok
      ? baseResult.baseToFrom.distanceKm
      : null,
    baseFromDurationMinutes: baseResult.baseToFrom.ok
      ? baseResult.baseToFrom.durationMinutes ?? null
      : null,
    baseFromApproximate: Boolean(baseResult.baseToFrom.approximate),
    baseToDistanceKm: baseResult.baseToTo.ok
      ? baseResult.baseToTo.distanceKm
      : null,
    baseToDurationMinutes: baseResult.baseToTo.ok
      ? baseResult.baseToTo.durationMinutes ?? null
      : null,
    baseToApproximate: Boolean(baseResult.baseToTo.approximate),
    baseDistanceError:
      !baseResult.baseToFrom.ok || !baseResult.baseToTo.ok
        ? baseResult.baseToFrom.message || baseResult.baseToTo.message
        : "",
  });
}
