/**
 * Multi-tenant owner scope.
 * ownerId on User / Car / Order = Company._id of the partner firm.
 * SUPERADMIN has no ownerId and sees everything.
 */

import mongoose from "mongoose";
import { ROLE } from "@models/user";
import { COMPANY_ID } from "@config/company";

export function isSuperAdminUser(user) {
  return user?.isAdmin === true && Number(user.role) === ROLE.SUPERADMIN;
}

export function isAdminUser(user) {
  return user?.isAdmin === true && Number(user.role) === ROLE.ADMIN;
}

/** Normalize to string ObjectId or null. */
export function normalizeOwnerId(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value._id) {
    return String(value._id);
  }
  const s = String(value).trim();
  if (!s || !mongoose.Types.ObjectId.isValid(s)) return null;
  return s;
}

/** Session / user ownerId as string, or null. */
export function getSessionOwnerId(user) {
  return normalizeOwnerId(user?.ownerId);
}

/**
 * Default owner for bootstrap / legacy rows without ownerId.
 */
export function getDefaultOwnerId() {
  return COMPANY_ID;
}

/**
 * Mongo filter for cars list.
 * - Public (no admin session): hide testingCar only
 * - Superadmin: all cars
 * - Admin: own fleet only (ownerId) + hide testingCar
 */
export function buildCarsOwnerFilter(session) {
  const user = session?.user ?? null;
  if (isSuperAdminUser(user)) return {};

  const testingGate = {
    $or: [{ testingCar: { $ne: true } }, { testingCar: { $exists: false } }],
  };

  if (isAdminUser(user)) {
    const ownerId = getSessionOwnerId(user);
    if (!ownerId) {
      // Misconfigured admin — see nothing rather than everything
      return { _id: null };
    }
    return {
      $and: [testingGate, { ownerId: new mongoose.Types.ObjectId(ownerId) }],
    };
  }

  return testingGate;
}

/**
 * Mongo filter for orders list (admin calendar / tables).
 * - Superadmin: no owner filter
 * - Admin: ownerId match
 * - Public/no session: no owner filter (caller should still gate admin routes)
 */
export function buildOrdersOwnerFilter(session) {
  const user = session?.user ?? null;
  if (isSuperAdminUser(user)) return {};
  if (isAdminUser(user)) {
    const ownerId = getSessionOwnerId(user);
    if (!ownerId) return { _id: null };
    return { ownerId: new mongoose.Types.ObjectId(ownerId) };
  }
  return {};
}

/** True if admin may access this car document. */
export function canAccessOwnedDoc(user, doc) {
  if (!user?.isAdmin) return false;
  if (isSuperAdminUser(user)) return true;
  const sessionOwner = getSessionOwnerId(user);
  const docOwner = normalizeOwnerId(doc?.ownerId);
  if (!sessionOwner || !docOwner) return false;
  return sessionOwner === docOwner;
}

/**
 * Resolve ownerId when creating a car.
 * Admin → always session.ownerId.
 * Superadmin → body/form ownerId or default COMPANY_ID.
 */
export function resolveOwnerIdForCreate(user, requestedOwnerId) {
  if (isAdminUser(user)) {
    return getSessionOwnerId(user) || getDefaultOwnerId();
  }
  if (isSuperAdminUser(user)) {
    return (
      normalizeOwnerId(requestedOwnerId) ||
      getSessionOwnerId(user) ||
      getDefaultOwnerId()
    );
  }
  return getDefaultOwnerId();
}
