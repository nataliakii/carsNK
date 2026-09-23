/**
 * @jest-environment node
 */

import {
  ACCESS_SCOPE,
  ADMIN_ACCESS_TTL_DAYS,
  adminAccessExpiresAt,
  isAdminConsoleScope,
} from "../accessScopes";
import {
  accessPathSuffixForScopes,
  assertAdminForCompanyLink,
} from "../adminAccessLink";
import { ROLE } from "@models/user";

describe("admin console access links", () => {
  it("lasts 7 days", () => {
    expect(ADMIN_ACCESS_TTL_DAYS).toBe(7);
    const from = Date.parse("2026-09-21T12:00:00.000Z");
    expect(adminAccessExpiresAt(from).toISOString()).toBe(
      "2026-09-28T12:00:00.000Z"
    );
  });

  it("routes admin.console links to /access/…/admin", () => {
    expect(accessPathSuffixForScopes([ACCESS_SCOPE.ADMIN_CONSOLE])).toBe(
      "admin"
    );
    expect(accessPathSuffixForScopes([ACCESS_SCOPE.VOUCHERS_TRANSFER])).toBe(
      "vouchers"
    );
  });

  it("rejects superadmin and mismatched company", () => {
    const companyA = "679903bd10e6c8a8c0f027bc";
    const companyB = "679903bd10e6c8a8c0f027bd";
    expect(
      assertAdminForCompanyLink(
        { isAdmin: true, role: ROLE.SUPERADMIN, ownerId: companyA },
        companyA
      ).ok
    ).toBe(false);
    expect(
      assertAdminForCompanyLink(
        { isAdmin: true, role: ROLE.ADMIN, ownerId: companyA },
        companyB
      ).ok
    ).toBe(false);
    expect(
      assertAdminForCompanyLink(
        { isAdmin: true, role: ROLE.ADMIN, ownerId: companyA },
        companyA
      ).ok
    ).toBe(true);
  });

  it("detects the admin.console scope", () => {
    expect(isAdminConsoleScope([ACCESS_SCOPE.ADMIN_CONSOLE])).toBe(true);
    expect(isAdminConsoleScope([ACCESS_SCOPE.VOUCHERS_TRANSFER])).toBe(false);
  });
});
