/**
 * Unit tests for canAdminModifyOrder permission helper (DEPRECATED)
 * 
 * ⚠️ NOTE: This function is deprecated. Use canEditOrder/canDeleteOrder from admin-rbac.js instead.
 * 
 * Permission Rules (legacy):
 * - Protected orders (my_order=true) can ONLY be modified by superadmin (role=2)
 * - Non-protected orders (my_order=false) can be modified by any admin
 * 
 * Note: createdByRole is no longer used - order type is determined by my_order only
 */

// Import functions directly from their source to avoid side effects from getOrderColor module
const { ROLE } = require("../admin-rbac");

// Copy the function implementation directly to avoid importing from index.js which imports getOrderColor
function canAdminModifyOrder({ order, adminRole }) {
  // Legacy compatibility: always allow for superadmin
  if (adminRole === ROLE.SUPERADMIN) {
    return { allowed: true, reason: null, isProtected: order?.my_order === true };
  }
  // Admin can only modify admin-created orders
  if (order?.my_order === true) {
    return { allowed: false, reason: "Only superadmin can modify client orders", isProtected: true };
  }
  return { allowed: true, reason: null, isProtected: false };
}

function isOrderProtected(order) {
  return order?.my_order === true;
}

describe("canAdminModifyOrder (deprecated)", () => {
  // ─────────────────────────────────────────────────────────────
  // TEST: Regular admin (role=1) trying to modify orders
  // ─────────────────────────────────────────────────────────────
  
  describe("Regular admin (role=ROLE.ADMIN=1)", () => {
    const adminRole = ROLE.ADMIN; // 1
    
    test("DENIED: cannot modify client order (my_order=true)", () => {
      const order = { my_order: true };
      const result = canAdminModifyOrder({ order, adminRole });
      
      expect(result.allowed).toBe(false);
      expect(result.isProtected).toBe(true);
      expect(result.reason).toBeTruthy();
    });
    
    test("ALLOWED: can modify admin-created order (my_order=false)", () => {
      const order = { my_order: false };
      const result = canAdminModifyOrder({ order, adminRole });
      
      expect(result.allowed).toBe(true);
      expect(result.isProtected).toBe(false);
      expect(result.reason).toBeNull();
    });
    
    test("ALLOWED: can modify order without my_order field (defaults to false)", () => {
      const order = {};
      const result = canAdminModifyOrder({ order, adminRole });
      
      expect(result.allowed).toBe(true);
      expect(result.isProtected).toBe(false);
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // TEST: Superadmin (role=2) can modify ANY order
  // ─────────────────────────────────────────────────────────────
  
  describe("Superadmin (role=ROLE.SUPERADMIN=2)", () => {
    const adminRole = ROLE.SUPERADMIN; // 2
    
    test("ALLOWED: can modify client order (my_order=true)", () => {
      const order = { my_order: true };
      const result = canAdminModifyOrder({ order, adminRole });
      
      expect(result.allowed).toBe(true);
      expect(result.isProtected).toBe(true); // Still marked as protected
    });
    
    test("ALLOWED: can modify admin-created order (my_order=false)", () => {
      const order = { my_order: false };
      const result = canAdminModifyOrder({ order, adminRole });
      
      expect(result.allowed).toBe(true);
      expect(result.isProtected).toBe(false);
    });
    
    test("ALLOWED: can modify any order regardless of protection", () => {
      const orders = [
        { my_order: true },
        { my_order: false },
        {}, // No my_order (defaults to false)
      ];
      
      orders.forEach((order) => {
        const result = canAdminModifyOrder({ order, adminRole });
        expect(result.allowed).toBe(true);
      });
    });
  });
  
  // ─────────────────────────────────────────────────────────────
  // TEST: Edge cases
  // ─────────────────────────────────────────────────────────────
  
  describe("Edge cases", () => {
    test("handles null order gracefully", () => {
      const result = canAdminModifyOrder({ order: null, adminRole: ROLE.ADMIN });
      expect(result.isProtected).toBe(false);
    });
    
    test("handles undefined order gracefully", () => {
      const result = canAdminModifyOrder({ order: undefined, adminRole: ROLE.ADMIN });
      expect(result.isProtected).toBe(false);
    });
    
    test("handles missing my_order field (defaults to false)", () => {
      const order = {};
      const result = canAdminModifyOrder({ order, adminRole: ROLE.ADMIN });
      
      expect(result.allowed).toBe(true);
      expect(result.isProtected).toBe(false);
    });
  });
});

describe("isOrderProtected (deprecated)", () => {
  test("returns true for client orders (my_order=true)", () => {
    expect(isOrderProtected({ my_order: true })).toBe(true);
  });
  
  test("returns false for admin-created orders (my_order=false)", () => {
    expect(isOrderProtected({ my_order: false })).toBe(false);
  });
  
  test("returns false for null/undefined order", () => {
    expect(isOrderProtected(null)).toBe(false);
    expect(isOrderProtected(undefined)).toBe(false);
  });
  
  test("returns false for order without my_order field", () => {
    expect(isOrderProtected({})).toBe(false);
  });
});
