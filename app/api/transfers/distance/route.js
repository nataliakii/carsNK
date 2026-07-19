import { NextResponse } from "next/server";
import { getTransferDistance } from "@/domain/transfers/getTransferDistance";

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

  const result = await getTransferDistance({ from, to });
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
  });
}
