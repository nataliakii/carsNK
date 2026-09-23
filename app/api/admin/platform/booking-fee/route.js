import { NextResponse } from "next/server";
import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import {
  getPlatformMarketplaceFeeSettings,
} from "@/domain/platform/platformSettingsService";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  formatMarketplaceFeePercent,
} from "@/domain/orders/marketplaceBookingFee";

/**
 * Read-only platform default booking fee for admin UIs (incl. partner ADMIN).
 * Writing the default remains SUPERADMIN-only on PATCH /api/admin/platform.
 */
export async function GET(request) {
  const { errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const doc = await getPlatformMarketplaceFeeSettings();
  const bps =
    doc?.marketplaceBookingFeeBps == null
      ? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS
      : doc.marketplaceBookingFeeBps;

  return NextResponse.json({
    success: true,
    marketplaceBookingFeeBps: bps,
    percentLabel: formatMarketplaceFeePercent(bps),
  });
}
