import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import PlatformCity from "@models/platformCity";
import { getSiteCountryConfig } from "@config/siteCountry";
import { slugifyCompanyName } from "@/domain/platform/companySlug";
import { toPublicCity } from "@/domain/platform/companyBookingCities";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("all") === "1";
  const countryParam = String(url.searchParams.get("country") || "")
    .trim()
    .toUpperCase();
  const siteCountry = getSiteCountryConfig().country;
  const filter =
    countryParam === "ALL"
      ? {}
      : { country: countryParam || siteCountry };
  if (!includeInactive) filter.isActive = { $ne: false };

  const cities = await PlatformCity.find(filter).sort({ sort: 1, name: 1 }).lean();
  return json({
    success: true,
    country: countryParam === "ALL" ? "ALL" : filter.country,
    cities: (cities || []).map(toPublicCity),
  });
}

export async function POST(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const name = String(body?.name || "").trim();
  if (!name) return json({ success: false, message: "name is required" }, 400);

  await connectToDB();
  const country = getSiteCountryConfig().country;
  const slug = slugifyCompanyName(body.slug || name);
  const existing = await PlatformCity.findOne({ country, slug }).lean();
  if (existing) {
    return json({ success: false, message: `City "${name}" already exists` }, 409);
  }

  const coords = parseCityCoords(body?.coords);
  if (body?.coords != null && coords === undefined) {
    return json({ success: false, message: "Invalid coords" }, 400);
  }

  const city = await PlatformCity.create({
    name,
    slug,
    country,
    kind: ["city", "airport", "region"].includes(body?.kind) ? body.kind : "city",
    isActive: body?.isActive !== false,
    requiresAddressDetail: Boolean(body?.requiresAddressDetail),
    searchText: String(body?.searchText || "").trim(),
    sort: Number.isFinite(Number(body?.sort)) ? Number(body.sort) : 100,
    ...(coords ? { coords } : {}),
  });

  return json({ success: true, city: toPublicCity(city) }, 201);
}

function parseCityCoords(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object") return undefined;
  const lat = String(raw.lat ?? "").trim();
  const lon = String(raw.lon ?? raw.lng ?? "").trim();
  if (!lat && !lon) return null;
  const latN = Number(lat);
  const lonN = Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return undefined;
  if (latN < -90 || latN > 90 || lonN < -180 || lonN > 180) return undefined;
  return { lat: String(latN), lon: String(lonN) };
}
