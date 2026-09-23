import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { User } from "@models/user";
import { Car } from "@models/car";
import { getSiteCountryConfig, getCountryPreset } from "@config/siteCountry";
import { ensureUniqueCompanySlug } from "@/domain/platform/companySlug";
import { defaultListedOnMarketplaceForCountry } from "@/domain/legal/partnerOperatingPolicy";
import {
  buildAdminCountryCompanyFilter,
  normalizeAdminCountryFilter,
} from "@/domain/platform/adminCountryScope";

export const runtime = "nodejs";

function partnerCompanyDefaults(countryCode) {
  const country = getCountryPreset(countryCode) || getSiteCountryConfig();
  return {
    tel: country.defaultTel || "+00 000 000 0000",
    email: "partner@example.com",
    address: country.defaultAddress || country.countryName || "",
    coords: country.defaultCoords || { lat: "0", lon: "0" },
    hoursDiffForStart: 1,
    hoursDiffForEnd: -1,
    bufferTime: 2,
    defaultStart: "14:00",
    defaultEnd: "12:00",
    seasons: {
      NoSeason: { start: "01/10", end: "24/05" },
      LowSeason: { start: "25/05", end: "30/06" },
      LowUpSeason: { start: "01/09", end: "30/09" },
      MiddleSeason: { start: "01/07", end: "31/07" },
      HighSeason: { start: "01/08", end: "31/08" },
    },
    useSeasons: true,
    langAdmin: "en",
    langSuperadmin: "en",
    useEmail: true,
    minRentalDuration: 1,
    workingHours: { start: "08:00", end: "22:00" },
    deliveryPricePerKm: 1,
    meetingContactPhone: "",
    meetingContactName: "",
    meetingContactChannel: "WhatsApp",
  };
}

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

/** GET: companies + admin users + car counts (superadmin). */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();
  const url = new URL(request.url);
  const countryParam = normalizeAdminCountryFilter(
    url.searchParams.get("country") || getSiteCountryConfig().country
  );
  const countryFilter = buildAdminCountryCompanyFilter(countryParam);
  const [companies, users, carCounts] = await Promise.all([
    Company.find(countryFilter).sort({ name: 1 }).lean(),
    User.find({ isAdmin: true })
      .select("username email role ownerId isAdmin createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    Car.aggregate([{ $group: { _id: "$ownerId", count: { $sum: 1 } } }]),
  ]);

  const countByOwner = {};
  for (const row of carCounts) {
    countByOwner[row._id ? String(row._id) : "null"] = row.count;
  }

  return json({
    success: true,
    country: countryParam,
    siteCountry: getSiteCountryConfig().country,
    companies: (companies || []).map((c) => ({
      ...c,
      carCount: countByOwner[String(c._id)] || 0,
    })),
    users: users || [],
    unassignedCarCount: countByOwner.null || 0,
  });
}

/** POST: create partner company { name, email?, tel?, address? }. */
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
  if (!name) {
    return json({ success: false, message: "name is required" }, 400);
  }

  await connectToDB();
  const requestedCountry = normalizeAdminCountryFilter(
    body?.country || getSiteCountryConfig().country
  );
  const countryCode =
    requestedCountry === "ALL"
      ? getSiteCountryConfig().country
      : requestedCountry;
  const country = getCountryPreset(countryCode);
  const defaults = partnerCompanyDefaults(countryCode);
  const slug = await ensureUniqueCompanySlug(Company, name);
  const company = await Company.create({
    ...defaults,
    name,
    email: String(body?.email || "").trim() || defaults.email,
    tel: String(body?.tel || "").trim() || defaults.tel,
    address: String(body?.address || "").trim() || defaults.address,
    coords: defaults.coords,
    slug,
    country: country.country,
    storefrontEnabled: true,
    listedOnMarketplace: defaultListedOnMarketplaceForCountry(country.country),
  });

  return json({ success: true, company }, 201);
}
