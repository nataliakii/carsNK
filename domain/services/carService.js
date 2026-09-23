/**
 * Car service — direct DB access for server and API routes.
 * Use from server components and API routes; do not call internal API via fetch.
 */

import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import Company from "@models/company";
import mongoose from "mongoose";
import { applyVisibilityToOrders } from "@/domain/orders/orderVisibility";
import {
  buildCarsOwnerFilter,
  canAccessOwnedDoc,
  isAnyAdminUser,
  isPublicCar,
} from "@/domain/owners/ownerScope";
import { getSiteCountryCode } from "@config/siteCountry";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";
import {
  isMarketplaceOperatingCompany,
  isPublicMarketplaceCarAllowed,
  ownerIdsHiddenFromPublicMarketplace,
} from "@/domain/legal/partnerOperatingPolicy";
import { resolveMarketplaceBookingFeeBps } from "@/domain/orders/marketplaceBookingFee";
import { getPlatformMarketplaceFeeSettings } from "@/domain/platform/platformSettingsService";

/**
 * Get all cars (optionally filtered by session for testingCar + ownerId).
 * @param {{ session?: Object, ownerId?: string, marketplaceOnly?: boolean }} [options]
 */
export async function getCars(options = {}) {
  await connectToDB();
  const session = options?.session ?? null;
  const filter = buildCarsOwnerFilter(session);

  const ownerId = options.ownerId ? String(options.ownerId).trim() : "";
  if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
    const ownerClause = { ownerId: new mongoose.Types.ObjectId(ownerId) };
    if (filter.$and) {
      filter.$and.push(ownerClause);
    } else if (Object.keys(filter).length) {
      Object.assign(filter, ownerClause);
    } else {
      Object.assign(filter, ownerClause);
    }
  } else if (options.marketplaceOnly) {
    const siteCountry = getSiteCountryCode();
    const companies = await Company.find({})
      .select("_id listedOnMarketplace country bookingMode marketplaceBookingFeeBps")
      .lean();
    const countryHideIds = (companies || [])
      .filter((doc) => !isCompanyInSiteCountry(doc, siteCountry))
      .map((doc) => doc._id);
    let complianceHideIds = [];
    try {
      complianceHideIds = await ownerIdsHiddenFromPublicMarketplace(
        companies
      );
    } catch (err) {
      console.error("[getCars] marketplace compliance filter failed", err);
      complianceHideIds = (companies || [])
        .filter(
          (doc) =>
            doc.listedOnMarketplace === false ||
            isMarketplaceOperatingCompany(doc)
        )
        .map((doc) => doc._id);
    }
    const hideIds = [...countryHideIds, ...complianceHideIds];
    if (hideIds.length) {
      const unique = [...new Set(hideIds.map((id) => String(id)))];
      const hideClause = {
        ownerId: {
          $nin: unique.map((id) => new mongoose.Types.ObjectId(id)),
        },
      };
      if (filter.$and) filter.$and.push(hideClause);
      else Object.assign(filter, hideClause);
    }
  }

  const cars = await Car.find(filter).lean();
  const ownerIds = [
    ...new Set(
      (cars || [])
        .map((car) => (car?.ownerId != null ? String(car.ownerId) : ""))
        .filter(Boolean)
    ),
  ];
  const feeCompanies =
    ownerIds.length > 0
      ? await Company.find({ _id: { $in: ownerIds } })
          .select("marketplaceBookingFeeBps")
          .lean()
      : [];
  const platformFeeSettings = await getPlatformMarketplaceFeeSettings();
  const feeByOwner = new Map(
    feeCompanies.map((doc) => [
      String(doc._id),
      resolveMarketplaceBookingFeeBps(doc, platformFeeSettings).bps,
    ])
  );
  return (cars ?? []).map((car) => ({
    ...car,
    marketplaceBookingFeeBps: feeByOwner.get(String(car.ownerId)),
  }));
}

async function isPublicCarVisibleToCustomers(car) {
  if (!isPublicCar(car)) return false;
  if (!car.ownerId) return false;
  const company = await Company.findById(car.ownerId)
    .select("_id listedOnMarketplace country bookingMode")
    .lean();
  if (!company) return false;
  const siteCountry = getSiteCountryCode();
  if (!isCompanyInSiteCountry(company, siteCountry)) return false;
  return isPublicMarketplaceCarAllowed({ car, company });
}

async function attachMarketplaceFee(car) {
  if (!car) return car;
  if (!car.ownerId) return car;
  const company = await Company.findById(car.ownerId)
    .select("marketplaceBookingFeeBps")
    .lean();
  const platformFeeSettings = await getPlatformMarketplaceFeeSettings();
  return {
    ...car,
    marketplaceBookingFeeBps: resolveMarketplaceBookingFeeBps(
      company,
      platformFeeSettings
    ).bps,
  };
}

async function applyCarReadAccess(car, user) {
  if (!car) return null;
  if (isAnyAdminUser(user)) {
    if (!canAccessOwnedDoc(user, car)) return null;
  } else if (!(await isPublicCarVisibleToCustomers(car))) {
    return null;
  }
  if (car.orders && Array.isArray(car.orders)) {
    car.orders = applyVisibilityToOrders(car.orders, user);
  }
  return car;
}

/**
 * Get one car by ID with orders populated; applies order visibility when session provided.
 * Admin without scope gets null. Public callers get 404-equivalent null
 * for inactive, off-market or non-compliant marketplace cars.
 * @param {string} id - Car _id
 * @param {{ session?: Object }} [options]
 * @returns {Promise<Object|null>} Car or null
 */
export async function getCarById(id, options = {}) {
  const raw = id != null ? String(id).trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return null;
  }
  await connectToDB();
  const car = await Car.findById(raw).populate("orders").lean();
  const visible = await applyCarReadAccess(car, options?.session?.user ?? null);
  return attachMarketplaceFee(visible);
}

/**
 * Get one car by slug with orders populated; applies order visibility when session provided.
 * @param {string} slug - Car slug
 * @param {{ session?: Object }} [options]
 * @returns {Promise<Object|null>} Car or null
 */
export async function getCarBySlug(slug, options = {}) {
  await connectToDB();
  const normalized = String(slug).trim().toLowerCase();
  const car = await Car.findOne({ slug: normalized }).populate("orders").lean();
  const visible = await applyCarReadAccess(car, options?.session?.user ?? null);
  return attachMarketplaceFee(visible);
}
