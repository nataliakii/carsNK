/**
 * Scoped access tokens — passwordless links limited to explicit scopes.
 * Example scope: vouchers.transfer (company transfer voucher page only).
 */

export const ACCESS_SCOPE = {
  VOUCHERS_TRANSFER: "vouchers.transfer",
};

export const ACCESS_SCOPE_LABELS = {
  [ACCESS_SCOPE.VOUCHERS_TRANSFER]: "Transfer vouchers only",
};

export const ALL_ACCESS_SCOPES = Object.values(ACCESS_SCOPE);

export function isValidAccessScope(scope) {
  return ALL_ACCESS_SCOPES.includes(String(scope || ""));
}
