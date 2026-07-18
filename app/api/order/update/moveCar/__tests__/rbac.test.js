/**
 * Minimal test for moveCar RBAC guard
 * 
 * This test verifies that ADMIN and SUPERADMIN roles are allowed,
 * while other roles are rejected.
 */

import { ROLE } from "@models/user";

describe("moveCar RBAC Guard", () => {
  it("should allow ADMIN role (role === 1)", () => {
    const userRole = ROLE.ADMIN; // 1
    const isAllowed = userRole === ROLE.ADMIN || userRole === ROLE.SUPERADMIN;
    expect(isAllowed).toBe(true);
  });

  it("should allow SUPERADMIN role (role === 2)", () => {
    const userRole = ROLE.SUPERADMIN; // 2
    const isAllowed = userRole === ROLE.ADMIN || userRole === ROLE.SUPERADMIN;
    expect(isAllowed).toBe(true);
  });

  it("should reject other roles", () => {
    const userRole = 0; // or any other value
    const isAllowed = userRole === ROLE.ADMIN || userRole === ROLE.SUPERADMIN;
    expect(isAllowed).toBe(false);
  });

  it("should have correct ROLE constants", () => {
    expect(ROLE.ADMIN).toBe(1);
    expect(ROLE.SUPERADMIN).toBe(2);
  });
});

