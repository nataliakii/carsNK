/**
 * @jest-environment node
 */

import { ROLE } from "@models/user";
import {
  policyRoleFromUser,
  isPlatformAdminUser,
  ADMIN_VIEW_MODE,
  resolveAdminViewMode,
} from "@/domain/admin/adminViewMode";
import {
  SUPPLIER_RESPONSE,
  PLATFORM_BOOKING_STATUS,
  getSupplierResponseStatus,
  getPlatformBookingStatus,
  canPlatformConfirmBooking,
  isSupplierResponseLocked,
  validateSupplierResponsePayload,
} from "@/domain/orders/supplierResponseStatus";

const OWNER = "64a000000000000000000001";

describe("policyRoleFromUser / view-as", () => {
  const superadmin = { isAdmin: true, role: ROLE.SUPERADMIN, email: "s@x.com" };
  const admin = { isAdmin: true, role: ROLE.ADMIN, ownerId: OWNER };

  test("platform superadmin is SUPERADMIN", () => {
    expect(resolveAdminViewMode(superadmin)).toBe(ADMIN_VIEW_MODE.PLATFORM_ADMIN);
    expect(policyRoleFromUser(superadmin)).toBe(ROLE.SUPERADMIN);
    expect(isPlatformAdminUser(superadmin)).toBe(true);
  });

  test("superadmin in company view is ADMIN", () => {
    const viewAs = { ...superadmin, viewAsCompanyId: OWNER };
    expect(resolveAdminViewMode(viewAs)).toBe(ADMIN_VIEW_MODE.COMPANY);
    expect(policyRoleFromUser(viewAs)).toBe(ROLE.ADMIN);
    expect(isPlatformAdminUser(viewAs)).toBe(false);
  });

  test("company admin is ADMIN", () => {
    expect(policyRoleFromUser(admin)).toBe(ROLE.ADMIN);
    expect(isPlatformAdminUser(admin)).toBe(false);
  });
});

describe("supplier vs platform status", () => {
  test("empty order awaits supplier and is pending platform", () => {
    const order = { my_order: true, confirmed: false };
    expect(getSupplierResponseStatus(order)).toBe(SUPPLIER_RESPONSE.AWAITING);
    expect(getPlatformBookingStatus(order)).toBe(PLATFORM_BOOKING_STATUS.PENDING);
    expect(canPlatformConfirmBooking(order)).toBe(false);
    expect(isSupplierResponseLocked(order)).toBe(false);
  });

  test("supplier acceptance is not a Rovaro confirmation", () => {
    const order = {
      my_order: true,
      confirmed: false,
      companyEmailDecision: "accepted",
      partnerConfirmedAt: new Date(),
      supplierResponse: "CONFIRMED",
    };
    expect(getSupplierResponseStatus(order)).toBe(SUPPLIER_RESPONSE.CONFIRMED);
    expect(getPlatformBookingStatus(order)).toBe(PLATFORM_BOOKING_STATUS.PENDING);
    expect(canPlatformConfirmBooking(order)).toBe(false);
  });

  test("decline requires a reason in the payload", () => {
    expect(validateSupplierResponsePayload({ response: "DECLINED" }).ok).toBe(false);
    expect(validateSupplierResponsePayload({ response: "DECLINED", reason: "no car" }).ok).toBe(true);
    expect(validateSupplierResponsePayload({ response: "ACCEPTED" }).ok).toBe(true);
  });

  test("legacy availability strings are rejected", () => {
    expect(validateSupplierResponsePayload({ response: "unavailable", reason: "no car" }).ok).toBe(
      false
    );
    expect(validateSupplierResponsePayload({ response: "available" }).ok).toBe(false);
  });

  test("platform confirmed locks supplier response", () => {
    const order = {
      my_order: true,
      confirmed: true,
      companyEmailDecision: "accepted",
    };
    expect(getPlatformBookingStatus(order)).toBe(PLATFORM_BOOKING_STATUS.CONFIRMED);
    expect(isSupplierResponseLocked(order)).toBe(true);
    expect(canPlatformConfirmBooking(order)).toBe(false);
  });

  test("rejected decision maps to declined", () => {
    expect(
      getSupplierResponseStatus({
        companyEmailDecision: "rejected",
        declineReason: "sold",
      })
    ).toBe(SUPPLIER_RESPONSE.DECLINED);
  });
});
