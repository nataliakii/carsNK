import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { loadCompanyBookingCities } from "@/domain/platform/companyBookingCities";
import {
  buildSiteCountryCompanyFilter,
  isCompanyInSiteCountry,
} from "@/domain/platform/companyCountryScope";
import { getSiteCountryCode } from "@config/siteCountry";
import { normalizeBookingLocationKey } from "@/domain/platform/bookingLocations";
import { ownerIdsHiddenFromPublicMarketplace } from "@/domain/legal/partnerOperatingPolicy";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/marketplace-regions
 * Regions / pickup areas served by marketplace companies on this site.
 * Used by the catalog Region filter.
 */
export async function GET() {
  try {
    await connectToDB();
    const siteCountry = getSiteCountryCode();
    const companies = await Company.find({
      ...buildSiteCountryCompanyFilter(siteCountry),
      listedOnMarketplace: { $ne: false },
    })
      .select("name cityIds locations coords orderRadiusKm country listedOnMarketplace bookingMode")
      .lean();

    const byKey = new Map();

    const listed = (companies || []).filter((company) =>
      isCompanyInSiteCountry(company, siteCountry)
    );
    const hidden = new Set(
      (await ownerIdsHiddenFromPublicMarketplace(listed)).map((id) => String(id))
    );

    for (const company of listed) {
      if (hidden.has(String(company._id))) continue;
      const ownerId = String(company._id);
      const cities = await loadCompanyBookingCities(company);
      for (const city of cities || []) {
        const name = String(city?.name || "").trim();
        if (!name) continue;
        const key = normalizeBookingLocationKey(name);
        if (!key) continue;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.ownerIds.includes(ownerId)) {
            existing.ownerIds.push(ownerId);
          }
          if (city.kind === "region") existing.kind = "region";
        } else {
          byKey.set(key, {
            name,
            kind: city.kind || "city",
            ownerIds: [ownerId],
          });
        }
      }
    }

    // Prefer kind=region first (Kassandra/Sithonia), then cities/airports A–Z.
    // Spain often has no platform "region" rows — cities still populate the list.
    const regions = [...byKey.values()].sort((a, b) => {
      const ak = a.kind === "region" ? 0 : 1;
      const bk = b.kind === "region" ? 0 : 1;
      if (ak !== bk) return ak - bk;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    const ownerIdsByRegion = {};
    for (const region of regions) {
      ownerIdsByRegion[region.name] = region.ownerIds;
    }

    return NextResponse.json({
      success: true,
      country: siteCountry,
      names: regions.map((r) => r.name),
      regions,
      ownerIdsByRegion,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load regions" },
      { status: 500 }
    );
  }
}
