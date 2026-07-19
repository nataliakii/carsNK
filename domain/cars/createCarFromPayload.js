/**
 * Create a car document from a plain JSON payload (bulk / programmatic).
 */

import dayjs from "dayjs";
import { Car } from "@models/car";
import { defaultPrices } from "@models/enums";
import { getCloudinaryPlaceholderPublicId } from "@config/cloudinary";
import { generateSlugBase, ensureUniqueSlug } from "@utils/slugCar";
import { resolveOwnerIdForCreate } from "@/domain/owners/ownerScope";

async function nextCarNumber() {
  const cars = await Car.find().select("carNumber").lean();
  const carNumbers = cars
    .map((car) => parseInt(car.carNumber, 10))
    .filter((num) => !Number.isNaN(num));
  const maxCarNumber = carNumbers.length > 0 ? Math.max(...carNumbers) : 0;
  return String(maxCarNumber + 1).padStart(4, "0");
}

function normalizePricingTiers(raw) {
  if (raw && typeof raw === "object") return raw;
  return defaultPrices;
}

/**
 * @param {object} payload
 * @param {{ user: object, requestedOwnerId?: string }} ctx
 * @returns {Promise<{ ok: true, car: object } | { ok: false, error: string }>}
 */
export async function createCarFromPayload(payload, ctx) {
  try {
    const model = String(payload?.model || "").trim();
    const carClass = String(payload?.class || "").trim().toLowerCase();
    const transmission = String(payload?.transmission || "")
      .trim()
      .toLowerCase();
    const fueltype = String(payload?.fueltype || "").trim().toLowerCase();
    const seats = Number(payload?.seats);
    const numberOfDoors = Number(payload?.numberOfDoors);
    const enginePower = Number(payload?.enginePower);

    if (!model) return { ok: false, error: "model is required" };
    if (!carClass) return { ok: false, error: "class is required" };
    if (!transmission) return { ok: false, error: "transmission is required" };
    if (!fueltype) return { ok: false, error: "fueltype is required" };
    if (!Number.isFinite(seats) || seats < 1) {
      return { ok: false, error: "seats is required" };
    }
    if (!Number.isFinite(numberOfDoors) || numberOfDoors < 2 || numberOfDoors > 10) {
      return { ok: false, error: "numberOfDoors must be 2–10" };
    }
    if (!Number.isFinite(enginePower)) {
      return { ok: false, error: "enginePower is required" };
    }

    const carNumber = await nextCarNumber();
    const pricingTiers = normalizePricingTiers(payload?.pricingTiers);
    const ownerId = resolveOwnerIdForCreate(
      ctx.user,
      payload?.ownerId ?? ctx.requestedOwnerId
    );

    const data = {
      carNumber,
      model,
      class: carClass,
      transmission,
      fueltype,
      seats,
      numberOfDoors,
      airConditioning:
        payload?.airConditioning === undefined
          ? true
          : Boolean(payload.airConditioning),
      enginePower,
      engine: String(payload?.engine || ""),
      color: String(payload?.color || "white").toLowerCase(),
      registration: Number(payload?.registration) || new Date().getFullYear() - 5,
      regNumber: String(payload?.regNumber || "").trim() || `TMP-${carNumber}`,
      deposit: Number(payload?.deposit) || 0,
      franchise: Number(payload?.franchise) || 300,
      PriceChildSeats: Number(payload?.PriceChildSeats) || 3,
      PriceKacko: Number(payload?.PriceKacko) || 5,
      pricingTiers,
      photoUrl:
        (typeof payload?.photoUrl === "string" && payload.photoUrl.trim()) ||
        getCloudinaryPlaceholderPublicId(),
      dateAddCar: dayjs().toDate(),
      ownerId,
      sort: Number(payload?.sort) || 999,
      testingCar: Boolean(payload?.testingCar),
    };

    const slugBase = generateSlugBase(data);
    data.slug = await ensureUniqueSlug(slugBase, async (slug) => {
      const existing = await Car.findOne({
        slug: slug.trim().toLowerCase(),
      }).lean();
      return !!existing;
    });

    const car = await Car.create(data);
    return { ok: true, car: car.toObject ? car.toObject() : car };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to create car",
    };
  }
}
