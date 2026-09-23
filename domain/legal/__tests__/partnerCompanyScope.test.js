/**
 * @jest-environment node
 */

import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { ROLE } from "@models/user";

describe("resolvePartnerCompanyId", () => {
  const otherCompany = "507f1f77bcf86cd799439011";
  const ownCompany = "507f1f77bcf86cd799439022";

  it("lets SUPERADMIN open any companyId for document review", () => {
    const session = {
      user: { role: ROLE.SUPERADMIN, isAdmin: true },
    };
    expect(resolvePartnerCompanyId(session, otherCompany)).toBe(otherCompany);
  });

  it("ADMIN cannot override to another company via query/body companyId", () => {
    const session = {
      user: {
        role: ROLE.ADMIN,
        isAdmin: true,
        ownerId: ownCompany,
      },
    };
    expect(resolvePartnerCompanyId(session, otherCompany)).toBe(ownCompany);
  });

  it("rejects empty session company for ADMIN", () => {
    const session = { user: { role: ROLE.ADMIN, isAdmin: true } };
    expect(resolvePartnerCompanyId(session, otherCompany)).toBeFalsy();
  });
});
