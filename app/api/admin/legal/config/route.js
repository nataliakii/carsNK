import { NextResponse } from "next/server";

import { requirePlatformAdmin, requireSuperAdmin } from "@lib/adminAuth";
import {
  getLegalConfigStatus,
  getServerLegalEntity,
} from "@config/legalEntity";
import {
  getLegalSettingsStatus,
  updateLegalSettings,
} from "@/domain/legal/legalSettingsService";
import { getDocumentStatusOverview } from "@/domain/legal/documentService";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { ALL_ESIGN_MODES } from "@/domain/legal/esign";
import { connectToDB } from "@lib/database";
import {
  getOrCreatePlatformSettings,
  readBusinessProfile,
} from "@/domain/platform/platformSettingsService";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  formatMarketplaceFeePercent,
} from "@/domain/orders/marketplaceBookingFee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin Legal Configuration Status.
 *
 * This is the ONLY surface that reports missing legal values. Customers and
 * partners never see a "Missing" marker — unconfigured sections are simply
 * omitted from their view.
 *
 * Tax identifiers are returned here as booleans plus masked tails, not as raw
 * values, so a superadmin can verify they are set without the numbers being
 * copied into a browser cache or a screenshot.
 */
function maskTail(value) {
  const str = String(value || "");
  if (!str) return "";
  return str.length <= 4 ? "••••" : `••••${str.slice(-4)}`;
}

export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const entity = getServerLegalEntity();
  const entityStatus = getLegalConfigStatus();
  const settingsStatus = await getLegalSettingsStatus();
  const documents = await getDocumentStatusOverview();

  await connectToDB();
  const platform = await getOrCreatePlatformSettings();
  const profile = readBusinessProfile(platform);
  const feeBps =
    platform.marketplaceBookingFeeBps == null
      ? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS
      : platform.marketplaceBookingFeeBps;

  const businessAddress =
    profile.businessAddress || entity.businessAddress || "";
  const businessNameNumber =
    profile.businessNameNumber || entity.businessNameNumber || "";
  const vatNumber = profile.vatNumber || entity.vatNumber || "";
  const taxReferenceNumber =
    profile.taxRegistrationNumber || entity.taxReferenceNumber || "";

  const fields = entityStatus.fields.map((field) => {
    if (field.key === "businessAddress") {
      return { ...field, status: businessAddress ? "ok" : "missing" };
    }
    if (field.key === "businessNameNumber") {
      return { ...field, status: businessNameNumber ? "ok" : "missing" };
    }
    if (field.key === "vatNumber") {
      return { ...field, status: vatNumber ? "ok" : "missing" };
    }
    if (field.key === "taxReferenceNumber") {
      return { ...field, status: taxReferenceNumber ? "ok" : "missing" };
    }
    return field;
  });

  const missingRequired = fields
    .filter((f) => f.status === "missing" && f.severity === "required")
    .map((f) => f.key);
  const missingRecommended = fields
    .filter((f) => f.status === "missing" && f.severity === "recommended")
    .map((f) => f.key);
  const warningParts = [];
  if (missingRequired.length) {
    warningParts.push(`missing required: ${missingRequired.join(", ")}`);
  }
  if (missingRecommended.length) {
    warningParts.push(`missing recommended: ${missingRecommended.join(", ")}`);
  }
  const warning = warningParts.length
    ? `Legal configuration incomplete — ${warningParts.join("; ")}.`
    : "";

  return NextResponse.json({
    success: true,
    warning,
    operator: {
      ownerLegalName: entity.ownerLegalName,
      legalStructure: entity.legalStructure,
      countryOfEstablishment: profile.country || entity.countryOfEstablishment,
      tradingName: entity.tradingName,
      platformBrand: entity.platformBrand,
      legalEmail: profile.businessEmail || entity.legalEmail,
      primaryDomain: entity.primaryDomain,
      spanishDomain: entity.spanishDomain,
      businessAddress,
      businessNameNumber,
      vatRegistered: Boolean(profile.vatRegistered || entity.vatRegistered),
      vatNumberSet: Boolean(vatNumber),
      vatNumberMasked: maskTail(vatNumber),
      taxReferenceNumberSet: Boolean(taxReferenceNumber),
      taxReferenceNumberMasked: maskTail(taxReferenceNumber),
      supportEmail: profile.supportEmail || "",
      telephone: profile.telephone || "",
      website: profile.website || "",
      governingJurisdiction: profile.governingJurisdiction || "",
      stripeStatementName: profile.stripeStatementName || "",
    },
    entityStatus: {
      ...entityStatus,
      ok: missingRequired.length === 0 && missingRecommended.length === 0,
      hasBlockingIssues: missingRequired.length > 0,
      missingRequired,
      missingRecommended,
      fields,
    },
    settings: settingsStatus.settings,
    settingsDefaults: settingsStatus.defaults,
    missingCommercial: settingsStatus.missingCommercial,
    esignModes: ALL_ESIGN_MODES,
    documents,
    marketplaceBookingFee: {
      bps: feeBps,
      percentLabel: formatMarketplaceFeePercent(feeBps),
    },
  });
}

/** Platform legal configuration. Not editable from inside a company. */
export async function PATCH(request) {
  const { session, errorResponse } = await requirePlatformAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const settings = await updateLegalSettings(body || {});

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "LEGAL_SETTINGS_UPDATED",
    userRole: "superadmin",
    userEmail: session.user?.email || "",
    severity: "high",
    ipAddress,
    userAgent,
    metadata: { patchKeys: Object.keys(body || {}) },
  });

  return NextResponse.json({ success: true, settings });
}
