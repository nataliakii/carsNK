import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import { getSiteCountryConfig } from "@config/siteCountry";
import { ALL_UI_LOCALES, normalizeEnabledLocales } from "@/domain/platform/uiLocales";
import {
  getOrCreatePlatformSettings,
  toPublicPlatformPayload,
} from "@/domain/platform/platformSettingsService";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const settings = await getOrCreatePlatformSettings();
  return json({
    success: true,
    availableLocales: ALL_UI_LOCALES,
    country: getSiteCountryConfig(),
    settings: toPublicPlatformPayload(settings),
  });
}

export async function PATCH(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  await connectToDB();
  const settings = await getOrCreatePlatformSettings();
  if (body?.enabledLocales) {
    settings.enabledLocales = normalizeEnabledLocales(body.enabledLocales);
  }
  await settings.save();
  return json({
    success: true,
    availableLocales: ALL_UI_LOCALES,
    country: getSiteCountryConfig(),
    settings: toPublicPlatformPayload(settings),
  });
}
