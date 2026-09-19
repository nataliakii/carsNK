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
} from "@/domain/owners/ownerScope";
import { getSiteCountryCode } from "@config/siteCountry";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";

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
      .select("_id listedOnMarketplace country")
      .lean();
    const hideIds = (companies || [])
      .filter((doc) => {
        if (doc.listedOnMarketplace === false) return true;
        return !isCompanyInSiteCountry(doc, siteCountry);
      })
      .map((doc) => doc._id);
    if (hideIds.length) {
      const hideClause = { ownerId: { $nin: hideIds } };
      if (filter.$and) filter.$and.push(hideClause);
      else Object.assign(filter, hideClause);
    }
  }

  const cars = await Car.find(filter).lean();
  return cars ?? [];
}

/**
 * Get one car by ID with orders populated; applies order visibility when session provided.
 * Admin without scope gets null.
 * @param {string} id - Car _id
 * @param {{ session?: Object }} [options]
 * @returns {Promise<Object|null>} Car or null
 */
export async function getCarById(id, options = {}) {
  await connectToDB();
  const car = await Car.findById(id).populate("orders").lean();
  if (!car) return null;
  const user = options?.session?.user ?? null;
  if (user?.isAdmin && !canAccessOwnedDoc(user, car)) {
    return null;
  }
  if (car.orders && Array.isArray(car.orders)) {
    car.orders = applyVisibilityToOrders(car.orders, user);
  }
  return car;
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
  if (!car) return null;
  const user = options?.session?.user ?? null;
  if (user?.isAdmin && !canAccessOwnedDoc(user, car)) {
    return null;
  }
  if (car.orders && Array.isArray(car.orders)) {
    car.orders = applyVisibilityToOrders(car.orders, user);
  }
  return car;
}
