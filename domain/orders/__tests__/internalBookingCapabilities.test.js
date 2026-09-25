/**
 * @jest-environment node
 *
 * An internal booking is the contractor's own offline record. Rovaro does not
 * mediate it, so nothing that only exists because Rovaro is a party to the
 * booking may ever be granted on one.
 *
 * These tests enumerate the whole capability vocabulary on purpose. Adding a
 * capability without deciding what it means for an internal booking fails
 * here, which is the point.
 */

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import {
  BOOKING_SOURCE,
  PLATFORM_WORKFLOW_STAGE,
} from "@/domain/admin/rovaroContractorAdmin";
import {
  BOOKING_CAPABILITY,
  BOOKING_ROLE,
  resolveBookingCapabilities,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";

const COMPANY = "64a000000000000000000001";

/**
 * The only capabilities an internal booking may ever grant, to anybody.
 * Everything absent from this list is platform-only by definition.
 */
const INTERNAL_ALLOWED = Object.freeze([
  BOOKING_CAPABILITY.VIEW_BOOKING,
  BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS,
  BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS,
  BOOKING_CAPABILITY.CONTACT_CUSTOMER,
  BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING,
  BOOKING_CAPABILITY.ADD_SECOND_DRIVER,
]);

const PLATFORM_ONLY = Object.values(BOOKING_CAPABILITY).filter(
  (capability) => !INTERNAL_ALLOWED.includes(capability)
);

function internalCaps(role = BOOKING_ROLE.ADMIN, status = "") {
  return resolveBookingCapabilities({
    source: BOOKING_SOURCE.INTERNAL,
    status,
    role,
    companyId: role === BOOKING_ROLE.SUPERADMIN ? null : COMPANY,
    orderCompanyId: COMPANY,
  });
}

function internalOrder(overrides = {}) {
  return {
    _id: "64a0000000000000000000ab",
    source: BOOKING_SOURCE.INTERNAL,
    my_order: false,
    ownerId: COMPANY,
    ...overrides,
  };
}

describe("internal bookings never grant a platform-only capability", () => {
  test("the vocabulary is fully classified", () => {
    // Every capability is either allowed internally or platform-only. A new
    // capability lands in PLATFORM_ONLY until someone decides otherwise.
    expect(
      [...INTERNAL_ALLOWED, ...PLATFORM_ONLY].sort()
    ).toEqual(Object.values(BOOKING_CAPABILITY).sort());
    expect(PLATFORM_ONLY.length).toBeGreaterThan(0);
  });

  test.each(PLATFORM_ONLY)(
    "%s is denied to the owning company admin",
    (capability) => {
      expect(internalCaps(BOOKING_ROLE.ADMIN)[capability]).toBe(false);
    }
  );

  test.each(PLATFORM_ONLY)("%s is denied to the superadmin", (capability) => {
    expect(internalCaps(BOOKING_ROLE.SUPERADMIN)[capability]).toBe(false);
  });

  test.each(PLATFORM_ONLY)(
    "%s stays denied whatever platform stage the record carries",
    (capability) => {
      for (const stage of Object.values(PLATFORM_WORKFLOW_STAGE)) {
        expect(internalCaps(BOOKING_ROLE.ADMIN, stage)[capability]).toBe(false);
      }
    }
  );

  test("a marketplace booking mode does not turn an internal record platform", () => {
    // Mode and source are independent axes. This is exactly the combination
    // that leaked the replacement-offer card onto an internal booking.
    const order = internalOrder({
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    });
    const capabilities = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 1,
      ownerId: COMPANY,
    });
    for (const capability of PLATFORM_ONLY) {
      expect(capabilities[capability]).toBe(false);
    }
  });

  test("the company keeps the powers over its own record", () => {
    const capabilities = internalCaps(BOOKING_ROLE.ADMIN);
    expect(capabilities[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(true);
  });

  test("the superadmin reads an internal record but does not edit it", () => {
    const capabilities = internalCaps(BOOKING_ROLE.SUPERADMIN);
    expect(capabilities[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
  });
});
