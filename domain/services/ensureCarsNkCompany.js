import { COMPANY_ID } from "@config/company";
import { seasons } from "@utils/companyData";
import mongoose from "mongoose";

/**
 * Default CarsNK company document for empty / new databases.
 * Uses fixed COMPANY_ID so config stays stable.
 */
export function getCarsNkCompanyDefaults() {
  return {
    name: "CarsNK",
    tel: "+380 68 100 3771",
    tel2: "+353 85 270 96 05",
    email: "admin@bbqr.site",
    address: "Antonioy Kelesi 12, Nea Kallikratia 630 80",
    slogan: "Car rental aggregator in Greece",
    coords: { lat: "40.311273589340836", lon: "23.06426516796098" },
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
    locations: [
      { name: "Nea Kallikratia", coords: { lat: "40.31", lon: "23.06" } },
      { name: "Thessaloniki Airport", coords: { lat: "40.52", lon: "22.97" } },
    ],
    notSendIP1: "",
    notSendIP2: "",
    notSendIP3: "",
    notSendIP4: "",
    minRentalDuration: 1,
    workingHours: { start: "08:00", end: "22:00" },
    deliveryPricePerKm: 1,
  };
}

/**
 * Ensure company with COMPANY_ID exists. Creates it if missing.
 * @param {import("mongoose").Model} CompanyModel
 * @returns {Promise<object>} lean company document
 */
export async function ensureCarsNkCompany(CompanyModel) {
  const existing = await CompanyModel.findById(COMPANY_ID).lean();
  if (existing) return existing;

  const defaults = getCarsNkCompanyDefaults();
  const created = await CompanyModel.create({
    _id: new mongoose.Types.ObjectId(COMPANY_ID),
    ...defaults,
  });
  return created.toObject ? created.toObject() : created;
}

export default ensureCarsNkCompany;
