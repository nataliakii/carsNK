import { ROLE } from "@models/user";

/** Replaces the old wide navbar buttons. Stays inside a 64px bar. */
export const ACCOUNT_TRIGGER_PX = 32;

export const RETIRED_ACCOUNT_LABEL = "Email me a password reset";

export const ACCOUNT_LOGOUT_CALLBACK = "/";

export function isAuthenticatedUser(session) {
  return Boolean(session?.user);
}

/**
 * SUPERADMIN, ADMIN, and any other signed-in account (shown as staff).
 * @returns {"superadmin"|"admin"|"staff"|null}
 */
export function accountRoleKind(user) {
  if (!user) return null;
  const role = Number(user.role);
  if (role === ROLE.SUPERADMIN) return "superadmin";
  if (user.isAdmin || role === ROLE.ADMIN) return "admin";
  return "staff";
}

export function accountInitials(user) {
  const email = String(user?.email || "").trim();
  const name = String(user?.username || user?.name || "").trim();
  const source = name || email;
  if (!source) return "?";
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]);
  return letters.join("").toUpperCase() || source.slice(0, 1).toUpperCase();
}

/** Shows the signed-in mailbox without printing the whole local part. */
export function maskEmail(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 0) return value;
  return `${value.slice(0, 1)}***@${value.slice(at + 1)}`;
}

export function buildAccountMenuView(session, companyName = "") {
  if (!isAuthenticatedUser(session)) return null;
  const user = session.user;
  return {
    email: String(user.email || ""),
    role: accountRoleKind(user),
    initials: accountInitials(user),
    companyName: String(companyName || "").trim(),
    actions: ["resetPassword", "logOut"],
    retiredLabel: RETIRED_ACCOUNT_LABEL,
  };
}

export function accountTriggerFits(viewportWidth) {
  return ACCOUNT_TRIGGER_PX <= 40 && Number(viewportWidth) >= ACCOUNT_TRIGGER_PX;
}

/** Labels that stay in the desktop bar at md and up. */
export const DESKTOP_NAV_LABELS = [
  "Orders",
  "Partners",
  "Partner reviews",
  "Platform settings",
  "Emails",
];

function desktopLinkPx(label) {
  return Math.ceil(String(label).length * 7.4) + 16;
}

/** Approximate width of the desktop admin bar with the compact account trigger. */
export function desktopNavbarUsedPx() {
  const links = DESKTOP_NAV_LABELS.reduce(
    (sum, label) => sum + desktopLinkPx(label),
    0
  );
  return 48 + 148 + links + 64 + ACCOUNT_TRIGGER_PX + 40;
}

export function desktopNavbarFits(viewportWidth) {
  return desktopNavbarUsedPx() <= Number(viewportWidth);
}

export function accountPlacement(placement) {
  return placement === "drawer"
    ? { surface: "drawer", compact: true }
    : { surface: "navbar", compact: true };
}

export function accountMenuClosesOnKey(key) {
  return key === "Escape";
}

/** A second click while the request is in flight is ignored. */
export function beginPasswordReset(state) {
  if (state?.pending) return { ...state, started: false };
  return { pending: true, error: "", started: true };
}

/**
 * Posts to the existing session-scoped reset route.
 * No email is sent from the browser.
 */
export async function requestOwnPasswordReset(fetchImpl = fetch) {
  const res = await fetchImpl("/api/admin/account/send-password-reset", {
    method: "POST",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.message || "Could not send reset email");
  }
  return body;
}
