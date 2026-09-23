import { NextResponse } from "next/server";

import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { getCloudinaryPlaceholderPublicId } from "@config/cloudinary";
import { revalidatePath, revalidateTag } from "next/cache";
import { generateSlugBase, ensureUniqueSlug } from "@utils/slugCar";
import { requireAdmin } from "@lib/adminAuth";
import { resolveOwnerIdForCreate, isSuperAdminUser } from "@/domain/owners/ownerScope";
import { uploadCarImageFile } from "@/domain/cars/uploadCarImage";
import { photosForSave, MAX_CAR_PHOTOS } from "@/domain/cars/carPhotos";
import { normalizeCarOffices } from "@/domain/orders/carOffices";
import { syncCarOfficeIds } from "@/domain/company/officeRecord";
import { CAR_OFFICE_SCOPE } from "@/domain/company/officeConstants";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import {
  assertMarketplaceCarPublish,
  auditPartnerComplianceBlock,
  partnerComplianceJson,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

dayjs.extend(isBetween);

// Main handler function
export async function POST(req) {
  try {
    const { session, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const cfg = ensureCloudinaryConfigured();
    if (!cfg.ok) {
      return NextResponse.json(
        { success: false, message: cfg.message },
        { status: 500 }
      );
    }

    // Ensure DB connection for all operations
    await connectToDB();

    const formData = await req.formData();
    const carData = extractCarData(formData);
    const requestedOwnerId = formData.get("ownerId");
    carData.ownerId = resolveOwnerIdForCreate(
      session.user,
      requestedOwnerId
    );

    const Company = (await import("@models/company")).default;
    const ownerCompany = carData.ownerId
      ? await Company.findById(carData.ownerId)
          .select("_id country bookingMode listedOnMarketplace offices")
          .lean()
      : null;
    const { ipAddress, userAgent } = extractAuditContext(req);
    const publishGate = await assertMarketplaceCarPublish(carData.ownerId, {
      car: carData,
      company: ownerCompany,
      overrideReason: isSuperAdminUser(session.user)
        ? String(formData.get("complianceOverrideReason") || "")
        : "",
      overrideByRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
      overrideByEmail: session.user?.email || "",
      audit: { ipAddress, userAgent, carId: "" },
    });
    if (!publishGate.allowed) {
      await auditPartnerComplianceBlock({
        purpose: PARTNER_OPERATION_PURPOSE.CAR_PUBLISH,
        result: publishGate,
        actorEmail: session.user?.email || "",
        actorRole: isSuperAdminUser(session.user) ? "superadmin" : "admin",
        ipAddress,
        userAgent,
      });
      return NextResponse.json(partnerComplianceJson(publishGate), {
        status: 403,
      });
    }

    // Generate carNumber by fetching the highest current car number and incrementing it
    carData.carNumber = await generateCarNumber();

    await validateRequiredFields(carData);

    const files = collectImageFiles(formData);
    if (files.length) {
      const ids = [];
      for (const file of files.slice(0, MAX_CAR_PHOTOS)) {
        ids.push(await uploadCarImageFile(file));
      }
      Object.assign(carData, photosForSave(ids));
    } else {
      carData.photoUrl = getCloudinaryPlaceholderPublicId();
      carData.photos = [];
    }

    carData.dateAddCar = dayjs().toDate();

    if (carData.ownerId) {
      const synced = syncCarOfficeIds({
        offices: carData.offices,
        officeIds: carData.officeIds,
        officeScope: carData.officeScope,
        company: ownerCompany,
      });
      carData.officeIds = synced.officeIds;
      carData.officeScope = synced.officeScope;
    }

    // Auto-generate SEO slug from model + transmission
    const slugBase = generateSlugBase(carData);
    carData.slug = await ensureUniqueSlug(slugBase, async (slug) => {
      const existing = await Car.findOne({ slug: slug.trim().toLowerCase() }).lean();
      return !!existing;
    });

    // Create and save the car
    const newCar = new Car(carData);

    await newCar.save();

    // Инвалидируем кеш по машинам после добавления
    revalidateTag("cars");
    revalidatePath("/api/car/all");
    revalidatePath("/api/car/models");

    return NextResponse.json(
      {
        success: true,
        message: `Машина ${newCar.model} добавлена`,
        data: newCar,
        status: 200,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleError(error);
  }
}

async function generateCarNumber() {
  // Fetch all car numbers and map them to integers
  const cars = await Car.find().select("carNumber");
  const carNumbers = cars
    .map((car) => parseInt(car.carNumber, 10))
    .filter((num) => !isNaN(num));

  // Find the highest car number
  const maxCarNumber = carNumbers.length > 0 ? Math.max(...carNumbers) : 0;
  const newCarNumber = maxCarNumber + 1;

  // Return as a zero-padded string (e.g., four digits)
  return newCarNumber.toString().padStart(4, "0");
}
function collectImageFiles(formData) {
  const fromImages = formData.getAll("images");
  const fromImage = formData.getAll("image");
  return [...fromImages, ...fromImage].filter(
    (file) => file && typeof file === "object" && typeof file.arrayBuffer === "function"
  );
}

// Function to extract data from the form
function extractCarData(formData) {
  console.log("[addOne] Incoming formData keys:", Array.from(formData.keys()));

  // Normalize and coerce types from FormData (string | Blob) to schema types
  const toNumber = (val, fallback = undefined) => {
    if (val === null || val === undefined || val === "") return fallback;
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };
  const toBoolean = (val, fallback = false) => {
    if (typeof val === "boolean") return val;
    if (val === null || val === undefined) return fallback;
    const s = String(val).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
    return fallback;
  };

  return {
    model: formData.get("model"),
    class: formData.get("class"),
    transmission: formData.get("transmission"),
    seats: toNumber(formData.get("seats")),
    numberOfDoors: toNumber(formData.get("numberOfDoors")),
    airConditioning: toBoolean(formData.get("airConditioning"), false),
    isActive: toBoolean(formData.get("isActive"), true),
    enginePower: toNumber(formData.get("enginePower")),
    pricingTiers: parsePricingTiers(formData.get("pricingTiers")),
    regNumber: formData.get("regNumber"),
    color: formData.get("color"),
    engine: String(formData.get("engine") || ""),
    fueltype: formData.get("fueltype"),
    registration: toNumber(formData.get("registration")),
    deposit: toNumber(formData.get("deposit"), 0),
    PriceChildSeats: toNumber(formData.get("PriceChildSeats")),
    PriceKacko: toNumber(formData.get("PriceKacko")),
    franchise: toNumber(formData.get("franchise")),
    offices: normalizeCarOffices(
      (() => {
        const raw = formData.get("offices");
        if (raw == null || raw === "") return [];
        try {
          return JSON.parse(String(raw));
        } catch {
          return String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      })()
    ),
    officeIds: (() => {
      const raw = formData.get("officeIds");
      if (raw == null || raw === "") return [];
      try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return String(raw)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    })(),
    officeScope: String(formData.get("officeScope") || CAR_OFFICE_SCOPE.ALL),
  };
}

// Function to validate required fields
function validateRequiredFields(carData) {
  const requiredFields = [
    "carNumber",
    "model",
    "class",
    "transmission",
    "seats",
    "numberOfDoors",
    "airConditioning",
    "enginePower",
    "pricingTiers",
    "fueltype",
  ];
  for (const field of requiredFields) {
    if (!carData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  validatePricingTiers(carData.pricingTiers);
  validateNumberOfDoors(carData.numberOfDoors);
}

function parsePricingTiers(pricingTiersString) {
  try {
    return pricingTiersString
      ? JSON.parse(pricingTiersString)
      : createEmptyPricingTiers();
  } catch (error) {
    throw new Error("Invalid pricing tiers format");
  }
}

function createEmptyPricingTiers() {
  return {
    NoSeason: { days: {} },
    LowSeason: { days: {} },
    LowUpSeason: { days: {} },
    MiddleSeason: { days: {} },
    HighSeason: { days: {} },
  };
}

function validatePricingTiers(pricingTiers) {
  const seasons = [
    "NoSeason",
    "LowSeason",
    "LowUpSeason",
    "MiddleSeason",
    "HighSeason",
  ];
  for (const season of seasons) {
    if (
      !pricingTiers[season]?.days ||
      Object.keys(pricingTiers[season].days).length === 0
    ) {
      throw new Error(`Missing pricing information for ${season}`);
    }
  }
}

function validateNumberOfDoors(numberOfDoors) {
  if (numberOfDoors < 2 || numberOfDoors > 10) {
    throw new Error("Number of doors must be between 2 and 10");
  }
}

function handleError(error) {
  console.error("Error:", error);
  const status = error.code === 11000 ? 409 : 500;
  const message =
    error.code === 11000
      ? "A car with this car number already exists"
      : "Failed to add car";
  return NextResponse.json(
    { success: false, message, details: error.message },
    { status }
  );
}
