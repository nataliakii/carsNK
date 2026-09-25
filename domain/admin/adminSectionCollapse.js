/**
 * Раскрыта ли сворачиваемая секция админки. Хранится per-browser в localStorage,
 * по умолчанию секция закрыта.
 */

export const ADMIN_SECTION_OPEN_STORAGE_PREFIX = "rovaroAdminSectionOpen:";

export const ADMIN_ORDERS_FINANCIAL_SUMMARY_SECTION = "ordersFinancialSummary";

export function adminSectionOpenStorageKey(sectionId) {
  return `${ADMIN_SECTION_OPEN_STORAGE_PREFIX}${String(sectionId || "")}`;
}

export function getDefaultAdminSectionOpen() {
  return false;
}

export function readAdminSectionOpenFromStorage(sectionId) {
  if (typeof window === "undefined") return getDefaultAdminSectionOpen();
  try {
    return window.localStorage.getItem(adminSectionOpenStorageKey(sectionId)) === "true";
  } catch {
    return getDefaultAdminSectionOpen();
  }
}

export function writeAdminSectionOpenToStorage(sectionId, open) {
  const next = Boolean(open);
  if (typeof window === "undefined") return next;
  try {
    window.localStorage.setItem(adminSectionOpenStorageKey(sectionId), String(next));
  } catch {
    /* quota / private mode — ignore */
  }
  return next;
}
