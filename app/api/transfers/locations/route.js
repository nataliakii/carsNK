import { NextResponse } from "next/server";
import { getTransferLocationOptions } from "@/domain/transfers/transferLocations";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    success: true,
    items: getTransferLocationOptions(),
  });
}
