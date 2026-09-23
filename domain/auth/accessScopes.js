/**
 * Scoped access tokens — passwordless links limited to explicit scopes.
 * Example scope: vouchers.transfer (company transfer voucher page only).
 * admin.console is a 7-day company-admin login (not a voucher page).
 */

export const ACCESS_SCOPE = {
  VOUCHERS_TRANSFER: "vouchers.transfer",
  ADMIN_CONSOLE: "admin.console",
};

export const ACCESS_SCOPE_LABELS = {
  [ACCESS_SCOPE.VOUCHERS_TRANSFER]: "Transfer vouchers only",
  [ACCESS_SCOPE.ADMIN_CONSOLE]: "Company admin login (7 days)",
};

export const ALL_ACCESS_SCOPES = Object.values(ACCESS_SCOPE);

export const ADMIN_ACCESS_TTL_DAYS = 7;
export const ADMIN_ACCESS_TTL_MS = ADMIN_ACCESS_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isValidAccessScope(scope) {
  return ALL_ACCESS_SCOPES.includes(String(scope || ""));
}

export function isAdminConsoleScope(scopes) {
  return (Array.isArray(scopes) ? scopes : []).includes(
    ACCESS_SCOPE.ADMIN_CONSOLE
  );
}

export function adminAccessExpiresAt(fromMs = Date.now()) {
  return new Date(fromMs + ADMIN_ACCESS_TTL_MS);
}
