import { ROLE } from "@models/user";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";

const COMPANY = "64b7f0c2a1b2c3d4e5f60789";
const OTHER = "64b7f0c2a1b2c3d4e5f60780";

describe("resolvePartnerCompanyId", () => {
  it("uses the partner admin's own company and ignores a requested id", () => {
    const session = { user: { role: ROLE.ADMIN, ownerId: COMPANY } };
    expect(resolvePartnerCompanyId(session, OTHER)).toBe(COMPANY);
  });

  it("uses view-as for a superadmin when no company is requested", () => {
    const session = {
      user: { role: ROLE.SUPERADMIN, viewAsCompanyId: COMPANY },
    };
    expect(resolvePartnerCompanyId(session)).toBe(COMPANY);
  });

  it("lets a superadmin target a company explicitly", () => {
    const session = {
      user: { role: ROLE.SUPERADMIN, viewAsCompanyId: COMPANY },
    };
    expect(resolvePartnerCompanyId(session, OTHER)).toBe(OTHER);
  });

  it("returns null when a superadmin has not picked a company", () => {
    expect(resolvePartnerCompanyId({ user: { role: ROLE.SUPERADMIN } })).toBe(
      null
    );
  });
});
