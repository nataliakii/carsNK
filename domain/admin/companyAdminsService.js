/**
 * Mongo access for the superadmin "Admins" tab.
 *
 * Every read here is projected: the password hash and the reset token hash are
 * never selected, so they cannot reach a response by accident.
 */

import { User, ROLE } from "@models/user";
import { connectToDB } from "@lib/database";
import {
  toCompanyAdminRow,
  sortCompanyAdmins,
  normalizeAdminEmail,
  isCompanyScopedAdmin,
  belongsToCompany,
} from "./companyAdmins";

/** Fields safe to read for a list or detail response. */
const ADMIN_PROJECTION =
  "username email name role ownerId isAdmin createdAt invitedAt lastLoginAt disabledAt notificationLanguage resetPasswordExpires";

/** Anchored, case-insensitive — same matching as credentials login. */
export function emailMatchFilter(email) {
  const normalized = normalizeAdminEmail(email);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

/**
 * True when another user already owns this email (case-insensitive).
 * @param {string} email
 * @param {string|null} exceptUserId
 */
export async function isEmailTaken(email, exceptUserId = null) {
  const filter = { email: emailMatchFilter(email) };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  const existing = await User.findOne(filter).select("_id").lean();
  return Boolean(existing);
}

/** True when another user already owns this username (case-insensitive). */
export async function isUsernameTaken(username, exceptUserId = null) {
  const filter = { username: emailMatchFilter(username) };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  const existing = await User.findOne(filter).select("_id").lean();
  return Boolean(existing);
}

/** Append a numeric suffix until the username is free. */
export async function ensureUniqueUsername(base) {
  const root = String(base || "admin").slice(0, 16) || "admin";
  let candidate = root;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await isUsernameTaken(candidate)) {
    suffix += 1;
    candidate = `${root}${suffix}`.slice(0, 20);
  }
  return candidate;
}

/**
 * Company admins for one partner, newest invitations first.
 * @param {string} ownerId
 */
export async function listCompanyAdmins(ownerId) {
  await connectToDB();
  const users = await User.find({
    isAdmin: true,
    role: { $ne: ROLE.SUPERADMIN },
    ownerId,
  })
    .select(`${ADMIN_PROJECTION} password`)
    .sort({ createdAt: -1 })
    .lean();

  return sortCompanyAdmins(
    (users || []).map((user) =>
      toCompanyAdminRow({ ...user, hasPassword: Boolean(user.password) })
    )
  );
}

/**
 * One admin as a client-safe row. Reads the password only to derive the
 * `hasPassword` boolean that backs "Invitation pending".
 * @param {string} userId
 */
export async function getCompanyAdminRow(userId, ownerId = null) {
  await connectToDB();
  const user = await User.findById(userId)
    .select(`${ADMIN_PROJECTION} password`)
    .lean();
  if (!user || !isCompanyScopedAdmin(user)) return null;
  if (ownerId && !belongsToCompany(user, ownerId)) return null;
  return toCompanyAdminRow({ ...user, hasPassword: Boolean(user.password) });
}

/**
 * Live mongoose document for a company-scoped admin. Superadmins and users
 * from another company are treated as missing.
 */
export async function findCompanyAdminDoc(userId, ownerId = null) {
  await connectToDB();
  const user = await User.findById(userId);
  if (!user || !isCompanyScopedAdmin(user)) return null;
  if (ownerId && !belongsToCompany(user, ownerId)) return null;
  return user;
}

/** Non-disabled company admins (Active + Invitation pending). */
export async function countUsableCompanyAdmins(ownerId, exceptUserId = null) {
  if (!ownerId) return 0;
  await connectToDB();
  const filter = {
    isAdmin: true,
    role: { $ne: ROLE.SUPERADMIN },
    ownerId,
    disabledAt: null,
  };
  if (exceptUserId) filter._id = { $ne: exceptUserId };
  return User.countDocuments(filter);
}

/**
 * Block disable/remove when this is the last usable admin of the company.
 * @returns {null | { success: false, message: string, errors: object }}
 */
export async function assertNotLastUsableAdmin(user) {
  if (!user || user.disabledAt || !user.ownerId) return null;
  const remaining = await countUsableCompanyAdmins(user.ownerId, user._id);
  if (remaining > 0) return null;
  return {
    success: false,
    message: "Cannot leave this company with zero active admins",
    errors: { access: "admin.partnerAdmins.errors.lastAdmin" },
  };
}

/** Row built from a live mongoose document after a write. */
export function rowFromDoc(doc) {
  return toCompanyAdminRow({
    _id: doc._id,
    username: doc.username,
    email: doc.email,
    name: doc.name,
    role: doc.role,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    invitedAt: doc.invitedAt,
    lastLoginAt: doc.lastLoginAt,
    disabledAt: doc.disabledAt,
    notificationLanguage: doc.notificationLanguage,
    resetPasswordExpires: doc.resetPasswordExpires,
    hasPassword: Boolean(doc.password),
  });
}
