import { COMPANY_ID } from "@config/company";
import { seasons } from "@utils/companyData";
import mongoose from "mongoose";
import { getActiveBrand } from "@config/brand";
import { getSiteCountryConfig } from "@config/siteCountry";

/**
 * Default platform company document for empty / new databases.
 * Uses fixed COMPANY_ID so config stays stable.
 * Country/coords follow the deployment (NEXT_PUBLIC_SITE_COUNTRY).
 */
export function getCarsNkCompanyDefaults() {
  const brand = getActiveBrand();
  const country = getSiteCountryConfig();
  return {
    name: brand.name,
    tel: country.defaultTel || "+380 68 100 3771",
    tel2: "",
    email: "admin@bbqr.site",
    address:
      country.country === "GR"
        ? "Antonioy Kelesi 12, Nea Kallikratia 630 80"
        : country.defaultAddress,
    slogan: brand.tagline,
    coords: country.defaultCoords,
    hoursDiffForStart: 1,
    hoursDiffForEnd: -1,
    bufferTime: 2,
    defaultStart: "14:00",
    defaultEnd: "12:00",
    seasons,
    useSeasons: true,
    langAdmin: "en",
    langSuperadmin: "en",
    useEmail: true,
    locations:
      country.country === "GR"
        ? [
            { name: "Nea Kallikratia", coords: { lat: "40.31", lon: "23.06" } },
            {
              name: "Thessaloniki Airport",
              coords: { lat: "40.52", lon: "22.97" },
            },
          ]
        : [],
    notSendIP1: "",
    notSendIP2: "",
    notSendIP3: "",
    notSendIP4: "",
    minRentalDuration: 1,
    workingHours: { start: "08:00", end: "22:00" },
    deliveryPricePerKm: 1,
    slug: brand.id === "rovaro" ? "rovaro" : "carsnk",
    country: country.country,
    storefrontEnabled: true,
    listedOnMarketplace: true,
    meetingContactPhone:
      String(process.env.ORDER_CONFIRMATION_MEETING_CONTACT_PHONE || "").trim() ||
      "",
    meetingContactName:
      String(process.env.ORDER_CONFIRMATION_MEETING_CONTACT_NAME || "").trim() ||
      "",
    meetingContactChannel:
      String(process.env.ORDER_CONFIRMATION_MEETING_CONTACT_CHANNEL || "").trim() ||
      "WhatsApp",
  };
}

/**
 * Ensure company with COMPANY_ID exists. Creates it if missing.
 * @param {import("mongoose").Model} CompanyModel
 * @returns {Promise<object>} lean company document
 */
export async function ensureCarsNkCompany(CompanyModel) {
  const existing = await CompanyModel.findById(COMPANY_ID).lean();
  if (existing) {
    // Backfill country if an old doc has none
    if (!existing.country) {
      const country = getSiteCountryConfig().country;
      await CompanyModel.updateOne(
        { _id: COMPANY_ID },
        { $set: { country } }
      );
      return { ...existing, country };
    }
    return existing;
  }

  const defaults = getCarsNkCompanyDefaults();
  const created = await CompanyModel.create({
    _id: new mongoose.Types.ObjectId(COMPANY_ID),
    ...defaults,
  });
  return created.toObject ? created.toObject() : created;
}

export default ensureCarsNkCompany;
