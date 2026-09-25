import {
  ORDER_NOT_FOUND,
  orderBelongsToAnotherCompany,
  orderOwnershipDenial,
  orderOwnershipResponse,
} from "@/domain/orders/orderOwnershipGuard";

const COMPANY_A = "64a0000000000000000000a1";
const COMPANY_B = "64a0000000000000000000b2";

const companyAdmin = (ownerId) => ({
  isAdmin: true,
  role: 1,
  id: "64a0000000000000000000c3",
  ownerId,
});

const superadmin = (viewAsCompanyId) => ({
  isAdmin: true,
  role: 2,
  id: "64a0000000000000000000d4",
  ...(viewAsCompanyId ? { viewAsCompanyId } : {}),
});

describe("orderOwnershipGuard", () => {
  it("refuses a company admin writing to another company's order", () => {
    expect(
      orderBelongsToAnotherCompany(companyAdmin(COMPANY_A), {
        ownerId: COMPANY_B,
      })
    ).toBe(true);
  });

  it("allows a company admin writing to its own order", () => {
    expect(
      orderBelongsToAnotherCompany(companyAdmin(COMPANY_A), {
        ownerId: COMPANY_A,
      })
    ).toBe(false);
  });

  it("compares ids by value, not by reference type", () => {
    const objectIdLike = { toString: () => COMPANY_A };
    expect(
      orderBelongsToAnotherCompany(companyAdmin(COMPANY_A), {
        ownerId: objectIdLike,
      })
    ).toBe(false);
  });

  it("lets a superadmin reach any company's order", () => {
    expect(
      orderBelongsToAnotherCompany(superadmin(), { ownerId: COMPANY_B })
    ).toBe(false);
  });

  it("scopes a superadmin who is viewing as one company", () => {
    expect(
      orderBelongsToAnotherCompany(superadmin(COMPANY_A), {
        ownerId: COMPANY_B,
      })
    ).toBe(true);
    expect(
      orderBelongsToAnotherCompany(superadmin(COMPANY_A), {
        ownerId: COMPANY_A,
      })
    ).toBe(false);
  });

  it("does not lock the real owner out of a legacy order with no ownerId", () => {
    expect(
      orderBelongsToAnotherCompany(companyAdmin(COMPANY_A), { ownerId: null })
    ).toBe(false);
  });

  it("answers a missing order exactly as it answers another company's order", () => {
    const missing = orderOwnershipDenial(companyAdmin(COMPANY_A), null);
    const foreign = orderOwnershipDenial(companyAdmin(COMPANY_A), {
      ownerId: COMPANY_B,
    });
    expect(missing).toEqual(ORDER_NOT_FOUND);
    expect(foreign).toEqual(ORDER_NOT_FOUND);
  });

  it("returns no denial for an accessible order", () => {
    expect(
      orderOwnershipDenial(companyAdmin(COMPANY_A), { ownerId: COMPANY_A })
    ).toBeNull();
  });

  it("builds a 404 JSON response for a foreign order", async () => {
    const response = orderOwnershipResponse(companyAdmin(COMPANY_A), {
      ownerId: COMPANY_B,
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found",
    });
  });

  it("returns null so the route continues when access is allowed", () => {
    expect(
      orderOwnershipResponse(companyAdmin(COMPANY_A), { ownerId: COMPANY_A })
    ).toBeNull();
  });
});
