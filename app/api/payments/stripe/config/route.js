import { NextResponse } from "next/server";
import { getStripePublicConfig } from "@config/stripe";

export const runtime = "nodejs";

/** Public Stripe mode + publishable key (no secrets). */
export async function GET() {
  return NextResponse.json({
    success: true,
    stripe: getStripePublicConfig(),
  });
}
