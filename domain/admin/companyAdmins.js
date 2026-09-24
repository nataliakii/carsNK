/**
 * Partner detail tabs and the superadmin "Admins" surface.
 *
 * Status, action availability, invite validation and the optimistic row live
 * here so the React table, the API routes and the tests share one rule set.
 * Nothing in this module touches Mongo or the network.
 */

import { ROLE } from "@models/user";
import { isSuperAdminUser } from "@/domain/owners/ownerScope";
import { ALL_UI_LOCALE_CODES } from "@/domain/platform/uiLocales";

export const PARTNER_TAB = {
  OVERVIEW: "overview",
  ADMINS: "admins",
  CARS: "cars",
  LEGAL: "legal",
  COVERAGE: "coverage",
};

export const PARTNER_TAB_IDS = [
  PARTNER_TAB.OVERVIEW,
  PARTNER_TAB.ADMINS,
  PARTNER_TAB.CARS,
  PARTNER_TAB.LEGAL,
  PARTNER_TAB.COVERAGE,
];

/** Superadmin password-reset: 3 sends per target per 10 minutes. */
export const ADMIN_PASSWORD_RESET_RATE_LIMIT = {
  points: 3,
  duration: 600,
};

export function adminPasswordResetRateLimitKey({ actorId, targetUserId }) {
  return `admin-reset:${String(actorId || "anon")}:${String(targetUserId || "")}`;
}

export function adminPasswordResetRateLimitOptions() {
  return {
    tableName: "adminPasswordResetRateLimit",
    keyPrefix: "admin_password_reset",
    points: ADMIN_PASSWORD_RESET_RATE_LIMIT.points,
    duration: ADMIN_PASSWORD_RESET_RATE_LIMIT.duration,
  };
}

/**
 * Only superadmins see the Admins tab. A deep link into it from a stale URL
 * falls back to Overview instead of rendering an empty surface.
 */
export function normalizePartnerTab(raw, { canManageAdmins = true } = {}) {
  const id = String(raw || "").trim().toLowerCase();
  if (!PARTNER_TAB_IDS.includes(id)) return PARTNER_TAB.OVERVIEW;
  if (id === PARTNER_TAB.ADMINS && !canManageAdmins) return PARTNER_TAB.OVERVIEW;
  return id;
}

export function visiblePartnerTabIds({ canManageAdmins = true } = {}) {
  return PARTNER_TAB_IDS.filter(
    (id) => id !== PARTNER_TAB.ADMINS || canManageAdmins
  );
}

export const ADMIN_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  DISABLED: "disabled",
};

/**
 * Partner companies only hold company admins. Platform superadmins have no
 * ownerId and are managed outside this tab.
 */
export const PARTNER_ADMIN_ROLE_OPTIONS = [ROLE.ADMIN];

export function resolvePartnerAdminRole(raw) {
  return Number(raw) === ROLE.SUPERADMIN ? ROLE.SUPERADMIN : ROLE.ADMIN;
}

/** Role a company-scoped invite may create — never a platform superadmin. */
export function resolveInviteRole({ role, ownerId }) {
  const requested = resolvePartnerAdminRole(role);
  if (ownerId) return ROLE.ADMIN;
  return requested;
}

/** Superadmin gate shared by the tab, the row actions and the API routes. */
export function canManageCompanyAdmins(user) {
  return isSuperAdminUser(user);
}

/**
 * Partner-company admin — never a platform superadmin, always scoped to a
 * company. Mutations on this surface refuse anyone else (404, not 403) so a
 * forged id cannot be used to probe or edit platform accounts.
 */
export function isCompanyScopedAdmin(user) {
  if (!user?.isAdmin) return false;
  if (Number(user.role) === ROLE.SUPERADMIN) return false;
  return Boolean(user.ownerId);
}

export function belongsToCompany(user, ownerId) {
  if (!ownerId) return Boolean(user?.ownerId);
  return String(user?.ownerId || "") === String(ownerId);
}

/**
 * True when disable/remove of `targetUserId` would leave the company with no
 * remaining usable admin (Active or Invitation pending). Already-disabled
 * rows are not the last usable admin.
 */
export function wouldLeaveZeroActiveAdmins(rows, targetUserId) {
  const id = String(targetUserId || "");
  const target = (rows || []).find((row) => String(row?._id || "") === id);
  if (!target || target.status === ADMIN_STATUS.DISABLED) return false;
  return !(rows || []).some(
    (row) =>
      String(row?._id || "") !== id && row.status !== ADMIN_STATUS.DISABLED
  );
}

/**
 * Status from real user fields:
 * - disabledAt set              → Disabled
 * - never logged in + invited   → Invitation pending
 * - otherwise                   → Active
 *
 * `hasPassword` is a server-derived boolean. The hash itself never leaves the
 * API, so a legacy row without invitedAt is still read as pending when it has
 * no password and has never signed in.
 */
export function deriveAdminStatus(user) {
  if (!user) return ADMIN_STATUS.DISABLED;
  if (user.disabledAt) return ADMIN_STATUS.DISABLED;
  const neverLoggedIn = !user.lastLoginAt;
  if (neverLoggedIn && (user.invitedAt || user.hasPassword === false)) {
    return ADMIN_STATUS.PENDING;
  }
  return ADMIN_STATUS.ACTIVE;
}

/** True while a reset link the admin has not used yet is still valid. */
export function isResetPending(user, now = new Date()) {
  const expires = user?.resetPasswordExpires;
  if (!expires) return false;
  const at = new Date(expires).getTime();
  return Number.isFinite(at) && at > new Date(now).getTime();
}

/** Disabled admins keep their row but may not sign in. */
export function isAdminSignInDisabled(user) {
  return Boolean(user?.disabledAt);
}

export function adminDisplayName(user) {
  const name = String(user?.name || "").trim();
  if (name) return name;
  const username = String(user?.username || "").trim();
  if (username) return username;
  const email = String(user?.email || "");
  return email.split("@")[0] || "";
}

/**
 * Row shape returned by the API and rendered by the table.
 * Deliberately excludes password, reset token hash and ownerId internals.
 */
export function toCompanyAdminRow(user, now = new Date()) {
  const status = deriveAdminStatus(user);
  return {
    _id: String(user?._id || ""),
    name: adminDisplayName(user),
    email: String(user?.email || ""),
    username: String(user?.username || ""),
    role: resolvePartnerAdminRole(user?.role),
    ownerId: user?.ownerId ? String(user.ownerId) : null,
    status,
    lastLoginAt: user?.lastLoginAt || null,
    invitedAt: user?.invitedAt || null,
    disabledAt: user?.disabledAt || null,
    notificationLanguage: normalizeNotificationLanguage(
      user?.notificationLanguage
    ),
    invitePending: status === ADMIN_STATUS.PENDING,
    resetPending: isResetPending(user, now),
    createdAt: user?.createdAt || null,
  };
}

/** Pending invitations first, then disabled, then by name. */
export function sortCompanyAdmins(rows) {
  const rank = (row) => {
    if (row.status === ADMIN_STATUS.PENDING) return 0;
    if (row.status === ADMIN_STATUS.DISABLED) return 2;
    return 1;
  };
  return [...(rows || [])].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      String(a.name || a.email).localeCompare(String(b.name || b.email))
  );
}

/**
 * Which controls a row offers. Pending invitations get "Resend invite" instead
 * of "Send password reset" — the same mail would otherwise appear twice.
 * A superadmin can never disable or remove their own account.
 */
export function adminRowActions(
  row,
  { currentUserId = null, lastUsableAdmin = false } = {}
) {
  const status = row?.status || deriveAdminStatus(row);
  const isSelf =
    currentUserId != null && String(row?._id || "") === String(currentUserId);
  const blockLast =
    lastUsableAdmin && status !== ADMIN_STATUS.DISABLED;
  return {
    changeEmail: true,
    sendPasswordReset: status !== ADMIN_STATUS.PENDING,
    resendInvite: status === ADMIN_STATUS.PENDING,
    disableAccess: status !== ADMIN_STATUS.DISABLED && !isSelf && !blockLast,
    enableAccess: status === ADMIN_STATUS.DISABLED,
    removeAccess: !isSelf && !blockLast,
  };
}

export function normalizeAdminEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidAdminEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAdminEmail(email));
}

export function normalizeNotificationLanguage(raw) {
  const code = String(raw || "").trim().toLowerCase().split(/[-_]/)[0];
  return ALL_UI_LOCALE_CODES.includes(code) ? code : "en";
}

/** Username derived from the invite email, kept unique-ish by the API. */
export function usernameFromEmail(email) {
  const local = normalizeAdminEmail(email).split("@")[0] || "admin";
  return local.length >= 3 ? local : `${local}adm`.slice(0, 20);
}

/**
 * Add-admin form. Errors are i18n keys so the dialog renders them translated.
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function validateAddAdminInput(input = {}) {
  const name = String(input.name || "").trim();
  const email = normalizeAdminEmail(input.email);
  const errors = {};

  if (!name) errors.name = "admin.partnerAdmins.errors.nameRequired";
  if (!email) errors.email = "admin.partnerAdmins.errors.emailRequired";
  else if (!isValidAdminEmail(email)) {
    errors.email = "admin.partnerAdmins.errors.emailInvalid";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      email,
      role: resolvePartnerAdminRole(input.role),
      notificationLanguage: normalizeNotificationLanguage(
        input.notificationLanguage
      ),
    },
  };
}

/**
 * Change-email form. Both fields must match so a typo cannot lock an admin out
 * of the console, and the new address must differ from the current one.
 */
export function validateEmailChangeInput({ email, confirmEmail, currentEmail } = {}) {
  const next = normalizeAdminEmail(email);
  const confirm = normalizeAdminEmail(confirmEmail);
  const errors = {};

  if (!next) errors.email = "admin.partnerAdmins.errors.emailRequired";
  else if (!isValidAdminEmail(next)) {
    errors.email = "admin.partnerAdmins.errors.emailInvalid";
  } else if (normalizeAdminEmail(currentEmail) === next) {
    errors.email = "admin.partnerAdmins.errors.emailUnchanged";
  }

  if (!confirm || confirm !== next) {
    errors.confirmEmail = "admin.partnerAdmins.errors.emailMismatch";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { email: next },
  };
}

/**
 * Row shown the moment an invitation is sent, before the list is refetched.
 * Status is "Invitation pending" because the invite has no password yet and
 * the person has never signed in.
 */
export function optimisticInvitedAdmin(input = {}, now = new Date()) {
  const { value } = validateAddAdminInput(input);
  const invitedAt = new Date(now).toISOString();
  return toCompanyAdminRow(
    {
      _id: input._id || `pending-${invitedAt}`,
      name: value.name,
      email: value.email,
      username: input.username || usernameFromEmail(value.email),
      role: value.role,
      ownerId: input.ownerId || null,
      notificationLanguage: value.notificationLanguage,
      invitedAt,
      lastLoginAt: null,
      disabledAt: null,
      hasPassword: false,
      createdAt: invitedAt,
    },
    now
  );
}

/** Insert or replace a row by id, keeping the list sorted. */
export function upsertAdminRow(rows, row) {
  const id = String(row?._id || "");
  const rest = (rows || []).filter((item) => String(item._id) !== id);
  return sortCompanyAdmins([...rest, row]);
}

export function removeAdminRow(rows, userId) {
  const id = String(userId || "");
  return (rows || []).filter((item) => String(item._id) !== id);
}

/** Apply a server patch to one row and re-derive its status. */
export function patchAdminRow(rows, userId, patch, now = new Date()) {
  const id = String(userId || "");
  return sortCompanyAdmins(
    (rows || []).map((item) =>
      String(item._id) === id
        ? toCompanyAdminRow(
            {
              ...item,
              ...patch,
              hasPassword:
                patch?.hasPassword ??
                (item.status === ADMIN_STATUS.PENDING ? false : true),
            },
            now
          )
        : item
    )
  );
}
