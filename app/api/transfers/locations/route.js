import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { resolveMarketCountry } from "@/domain/platform/marketCountry";
import { listTransferLocationsForMarket } from "@/domain/transfers/transferServiceAreas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const marketCountry = resolveMarketCountry(request);
  try {
    await connectToDB();
    const items = await listTransferLocationsForMarket(marketCountry);
    return NextResponse.json({
      success: true,
      marketCountry,
      items,
      available: items.length > 0,
    });
  } catch (error) {
    console.error("[transfer locations] failed", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        marketCountry,
        items: [],
        available: false,
        message: "Could not load transfer locations",
      },
      { status: 503 }
    );
  }
}
