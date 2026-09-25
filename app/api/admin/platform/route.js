import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { getSiteCountryConfig } from "@config/siteCountry";
import {
  filterLocalesForCountry,
  getAvailableUiLocales,
  normalizeEnabledLocales,
} from "@/domain/platform/uiLocales";
import {
  getOrCreatePlatformSettings,
  toPublicPlatformPayload,
  getMarketplaceFeePartnerStats,
  parsePlatformMarketplaceFeePatch,
  sanitizeBusinessProfile,
  readBusinessProfile,
} from "@/domain/platform/platformSettingsService";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  marketplaceBookingFeeAuditMetadata,
} from "@/domain/orders/marketplaceBookingFee";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const settings = await getOrCreatePlatformSettings();
  const payload = toPublicPlatformPayload(settings);
  const url = new URL(request.url);
  const includeFee = url.searchParams.get("includeFee") === "1";

  const siteCountry = getSiteCountryConfig();
  const body = {
    success: true,
    availableLocales: getAvailableUiLocales(siteCountry.country),
    country: siteCountry,
    settings: payload,
    marketplaceBookingFeeBps:
      payload.marketplaceBookingFeeBps ?? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  };

  if (includeFee) {
    body.feeStats = await getMarketplaceFeePartnerStats();
  }

  return json(body);
}

export async function PATCH(request) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  await connectToDB();
  const settings = await getOrCreatePlatformSettings();
  const { ipAddress, userAgent } = extractAuditContext(request);
  const actorEmail = session?.user?.email || "";
  const actorUserId = session?.user?.id || session?.user?._id || "";

  if (body?.enabledLocales) {
    const siteCountry = getSiteCountryConfig();
    settings.enabledLocales = filterLocalesForCountry(
      normalizeEnabledLocales(body.enabledLocales),
      siteCountry.country
    );
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, "marketplaceBookingFeeBps")) {
    const parsed = parsePlatformMarketplaceFeePatch(body.marketplaceBookingFeeBps);
    if (!parsed.ok) {
      return json({ success: false, message: parsed.error }, 400);
    }
    const previousBps = settings.marketplaceBookingFeeBps ?? null;
    settings.marketplaceBookingFeeBps = parsed.bps;
    await recordAuditEvent({
      action: "MARKETPLACE_BOOKING_FEE_CHANGED",
      userRole: "superadmin",
      userId: actorUserId || undefined,
      userEmail: actorEmail,
      severity: "high",
      ipAddress,
      userAgent,
      reason: String(body?.marketplaceBookingFeeReason || "Platform default booking fee").slice(
        0,
        500
      ),
      metadata: marketplaceBookingFeeAuditMetadata({
        companyId: "",
        previousBps,
        newBps: parsed.bps,
        actorEmail,
        actorUserId,
        reason: "platform_default",
      }),
    });
  }

  if (body?.businessProfile && typeof body.businessProfile === "object") {
    const legal =
      settings.legal && typeof settings.legal === "object" ? { ...settings.legal } : {};
    const previous = readBusinessProfile(settings);
    const next = sanitizeBusinessProfile({
      ...previous,
      ...body.businessProfile,
    });
    legal.businessProfile = next;
    settings.legal = legal;
    settings.markModified("legal");
    await recordAuditEvent({
      action: "LEGAL_SETTINGS_UPDATED",
      userRole: "superadmin",
      userId: actorUserId || undefined,
      userEmail: actorEmail,
      severity: "high",
      ipAddress,
      userAgent,
      reason: "business_profile",
      metadata: {
        patchKeys: Object.keys(body.businessProfile),
        scope: "businessProfile",
      },
    });
  }

  await settings.save();
  const payload = toPublicPlatformPayload(settings);
  const siteCountry = getSiteCountryConfig();
  return json({
    success: true,
    availableLocales: getAvailableUiLocales(siteCountry.country),
    country: siteCountry,
    settings: payload,
    marketplaceBookingFeeBps:
      payload.marketplaceBookingFeeBps ?? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  });
}
