/**
 * Car service — direct DB access for server and API routes.
 * Use from server components and API routes; do not call internal API via fetch.
 */

import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import { ROLE } from "@models/user";
import { applyVisibilityToOrders } from "@/domain/orders/orderVisibility";

/**
 * Build filter for car list: exclude testingCar unless superadmin.
 * @param {Object} [session] - getServerSession() result
 * @returns {Object} MongoDB filter
 */
function getCarsFilter(session) {
  const isSuperadmin =
    session?.user?.isAdmin === true && session?.user?.role === ROLE.SUPERADMIN;
  if (isSuperadmin) return {};
  return {
    $or: [
      { testingCar: { $ne: true } },
      { testingCar: { $exists: false } },
    ],
  };
}

/**
 * Get all cars (optionally filtered by session for testingCar).
 * @param {{ session?: Object }} [options] - session from getServerSession() for superadmin testing cars
 * @returns {Promise<Array>} Cars (plain objects)
 */
export async function getCars(options = {}) {
  await connectToDB();
  const session = options?.session ?? null;
  const filter = getCarsFilter(session);
  const cars = await Car.find(filter).lean();
  return cars ?? [];
}

/**
 * Get one car by ID with orders populated; applies order visibility when session provided.
 * @param {string} id - Car _id
 * @param {{ session?: Object }} [options]
 * @returns {Promise<Object|null>} Car or null
 */
export async function getCarById(id, options = {}) {
  await connectToDB();
  const car = await Car.findById(id).populate("orders").lean();
  if (!car) return null;
  const user = options?.session?.user ?? null;
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
  if (car.orders && Array.isArray(car.orders)) {
    car.orders = applyVisibilityToOrders(car.orders, user);
  }
  return car;
}
