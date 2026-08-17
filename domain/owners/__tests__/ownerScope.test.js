/**
 * @jest-environment node
 */
import {
  buildCarsOwnerFilter,
  buildOrdersOwnerFilter,
  canAccessOwnedDoc,
  resolveOwnerIdForCreate,
} from "@/domain/owners/ownerScope";
import { ROLE } from "@models/user";
import { COMPANY_ID } from "@config/company";

describe("ownerScope", () => {
  const ownerA = COMPANY_ID;
  const ownerB = "507f1f77bcf86cd799439011";

  test("public cars filter hides testingCar and inactive", () => {
    const filter = buildCarsOwnerFilter(null);
    expect(filter).toEqual({
      $and: [
        {
          $or: [
            { testingCar: { $ne: true } },
            { testingCar: { $exists: false } },
          ],
        },
        {
          $or: [{ isActive: { $ne: false } }, { isActive: { $exists: false } }],
        },
      ],
    });
  });

  test("superadmin cars filter is empty", () => {
    expect(
      buildCarsOwnerFilter({
        user: { isAdmin: true, role: ROLE.SUPERADMIN },
      })
    ).toEqual({});
  });

  test("superadmin by role alone (no isAdmin) sees all cars", () => {
    expect(
      buildCarsOwnerFilter({
        user: { role: ROLE.SUPERADMIN },
      })
    ).toEqual({});
  });

  test("isAdmin without role still skips public active gate", () => {
    expect(
      buildCarsOwnerFilter({
        user: { isAdmin: true },
      })
    ).toEqual({});
  });

  test("admin cars filter scopes by ownerId and keeps inactive", () => {
    const filter = buildCarsOwnerFilter({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: ownerA },
    });
    expect(filter.$and).toHaveLength(2);
    expect(String(filter.$and[1].ownerId)).toBe(ownerA);
    expect(JSON.stringify(filter)).not.toContain("isActive");
  });

  test("admin orders filter scopes by ownerId", () => {
    const filter = buildOrdersOwnerFilter({
      user: { isAdmin: true, role: ROLE.ADMIN, ownerId: ownerA },
    });
    expect(String(filter.ownerId)).toBe(ownerA);
  });

  test("canAccessOwnedDoc", () => {
    const admin = { isAdmin: true, role: ROLE.ADMIN, ownerId: ownerA };
    expect(canAccessOwnedDoc(admin, { ownerId: ownerA })).toBe(true);
    expect(canAccessOwnedDoc(admin, { ownerId: ownerB })).toBe(false);
    expect(
      canAccessOwnedDoc(
        { isAdmin: true, role: ROLE.SUPERADMIN },
        { ownerId: ownerB }
      )
    ).toBe(true);
  });

  test("resolveOwnerIdForCreate", () => {
    expect(
      resolveOwnerIdForCreate(
        { isAdmin: true, role: ROLE.ADMIN, ownerId: ownerA },
        ownerB
      )
    ).toBe(ownerA);
    expect(
      resolveOwnerIdForCreate(
        { isAdmin: true, role: ROLE.SUPERADMIN },
        ownerB
      )
    ).toBe(ownerB);
  });
});
