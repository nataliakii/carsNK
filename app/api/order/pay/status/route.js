import { NextResponse } from "next/server";
import { readRentalPaymentStatus } from "@/domain/orders/readRentalPaymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only. session_id is not proof of payment and never mutates the order. */
export async function GET(request) {
  const sessionId = request.nextUrl.searchParams.get("session_id") || "";
  const status = await readRentalPaymentStatus(sessionId);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
