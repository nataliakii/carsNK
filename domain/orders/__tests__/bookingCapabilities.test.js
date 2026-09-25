/**
 * @jest-environment node
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
  assertBookingCapability,
  checkBookingFieldWrites,
  resolveBookingCapabilities,
  resolveOrderCapabilities,
  PLATFORM_LOCKED_FIELDS,
} from "@/domain/orders/bookingCapabilities";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };
const otherCompanyAdmin = { isAdmin: true, role: 1, ownerId: OTHER_COMPANY };
const superadmin = { isAdmin: true, role: 2 };

function platform(overrides = {}) {
  return {
    _id: "64a0000000000000000000aa",
    source: BOOKING_SOURCE.PLATFORM,
    my_order: true,
    ownerId: COMPANY,
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    ...overrides,
  };
}

function caps(status, role = BOOKING_ROLE.ADMIN) {
  return resolveBookingCapabilities({
    source: BOOKING_SOURCE.PLATFORM,
    status,
    role,
    companyId: COMPANY,
    orderCompanyId: COMPANY,
  });
}

describe("new request — the supplier decides, and sees nothing private", () => {
  const newRequest = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION);

  test("exposes exactly confirm, replacement, decline and contact Rovaro", () => {
    const granted = Object.entries(newRequest)
      .filter(([, allowed]) => allowed)
      .map(([capability]) => capability)
      .sort();
    expect(granted).toEqual([
      BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE,
      BOOKING_CAPABILITY.CONTACT_ROVARO,
      BOOKING_CAPABILITY.DECLINE_REQUEST,
      BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT,
      BOOKING_CAPABILITY.VIEW_BOOKING,
    ].sort());
  });

  test("contacts and driving documents stay hidden", () => {
    expect(newRequest[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(false);
    expect(newRequest[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
    expect(newRequest[BOOKING_CAPABILITY.CONTACT_CUSTOMER]).toBe(false);
  });
});

describe("awaiting customer payment — the confirmation is irreversible", () => {
  const waiting = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT);

  test("the supplier cannot unconfirm, decline or offer another vehicle", () => {
    expect(waiting[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(false);
    expect(waiting[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(waiting[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(false);
  });

  test("Contact Rovaro is the only remaining action", () => {
    const granted = Object.entries(waiting)
      .filter(([, allowed]) => allowed)
      .map(([capability]) => capability)
      .sort();
    expect(granted).toEqual([
      BOOKING_CAPABILITY.CONTACT_ROVARO,
      BOOKING_CAPABILITY.VIEW_BOOKING,
    ].sort());
  });

  test("a submitted replacement proposal cannot be withdrawn either", () => {
    const proposed = caps(
      PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_ALTERNATIVE_ACCEPTANCE
    );
    expect(proposed[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(false);
    expect(proposed[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(proposed[BOOKING_CAPABILITY.CONTACT_ROVARO]).toBe(true);
  });
});

describe("paid booking — read-only, but the supplier can finally reach the customer", () => {
  const paidOrder = platform({
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    confirmed: true,
    payment: { status: "paid" },
    returnAtUtc: "2026-10-01T10:00:00.000Z",
  });
  const now = new Date("2026-09-29T10:00:00.000Z");

  test("contacts and licence open only for the owning company", () => {
    const owning = resolveOrderCapabilities(paidOrder, companyAdmin, { now });
    expect(owning[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.CONTACT_CUSTOMER]).toBe(true);
    expect(owning[BOOKING_CAPABILITY.REPORT_PROBLEM]).toBe(true);
  });

  test("another company gets nothing at all, not even the booking", () => {
    const stranger = resolveOrderCapabilities(paidOrder, otherCompanyAdmin, { now });
    expect(stranger[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(false);
    expect(stranger[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(false);
    expect(stranger[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
    expect(assertBookingCapability(stranger, BOOKING_CAPABILITY.VIEW_BOOKING)).toEqual({
      ok: false,
      status: 404,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    });
  });

  test("the booking stays read-only for the supplier", () => {
    const owning = resolveOrderCapabilities(paidOrder, companyAdmin, { now });
    expect(owning[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    expect(owning[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
    const writes = checkBookingFieldWrites({
      capabilities: owning,
      source: BOOKING_SOURCE.PLATFORM,
      fields: ["rentalEndDate", "totalPrice", "insurance", "ChildSeats", "placeOut"],
    });
    expect(writes.allowed).toBe(false);
    expect(writes.deniedFields.sort()).toEqual(
      ["ChildSeats", "insurance", "placeOut", "rentalEndDate", "totalPrice"].sort()
    );
  });

  test("the licence window closes again after the rental", () => {
    const late = resolveOrderCapabilities(paidOrder, companyAdmin, {
      now: new Date("2026-10-10T10:00:00.000Z"),
    });
    expect(late[BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS]).toBe(true);
    expect(late[BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS]).toBe(false);
  });
});

describe("superadmin", () => {
  const order = platform({
    bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
    payment: { status: "paid" },
  });

  test("may amend under audit but never confirms the vehicle itself", () => {
    const able = resolveOrderCapabilities(order, superadmin);
    expect(able[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(true);
    expect(able[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(false);
    expect(able[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
    expect(able[BOOKING_CAPABILITY.CONTACT_ROVARO]).toBe(false);
  });

  test("a company admin never receives amendment powers", () => {
    const supplier = resolveOrderCapabilities(order, companyAdmin);
    expect(supplier[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
  });

  test("viewing the console as a company drops platform powers", () => {
    const viewingAs = resolveOrderCapabilities(order, {
      isAdmin: true,
      role: 2,
      viewAsCompanyId: COMPANY,
    });
    expect(viewingAs[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    expect(viewingAs[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(true);
  });
});

describe("the second driver is a platform extra", () => {
  const stages = [
    PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
    PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT,
    PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
  ];

  test("no company admin can add it, at any stage or source", () => {
    for (const stage of stages) {
      const company = caps(stage);
      expect(company[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(false);
      expect(
        checkBookingFieldWrites({
          capabilities: company,
          source: BOOKING_SOURCE.PLATFORM,
          fields: ["secondDriver"],
        }).allowed
      ).toBe(false);
    }
    const internal = resolveBookingCapabilities({
      source: BOOKING_SOURCE.INTERNAL,
      status: "",
      role: BOOKING_ROLE.ADMIN,
      companyId: COMPANY,
      orderCompanyId: COMPANY,
    });
    expect(internal[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(true);
    expect(internal[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(false);
    expect(
      checkBookingFieldWrites({
        capabilities: internal,
        source: BOOKING_SOURCE.INTERNAL,
        fields: ["secondDriver"],
      }).allowed
    ).toBe(false);
  });

  test("a superadmin can", () => {
    const platformCaps = caps(
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
      BOOKING_ROLE.SUPERADMIN
    );
    expect(platformCaps[BOOKING_CAPABILITY.ADD_SECOND_DRIVER]).toBe(true);
    expect(
      checkBookingFieldWrites({
        capabilities: platformCaps,
        source: BOOKING_SOURCE.PLATFORM,
        fields: ["secondDriver"],
      }).allowed
    ).toBe(true);
  });
});

describe("INTERNAL controls never leak onto a PLATFORM booking", () => {
  test("a company admin gets no edit capability on any platform stage", () => {
    for (const stage of Object.values(PLATFORM_WORKFLOW_STAGE)) {
      const granted = caps(stage);
      expect(granted[BOOKING_CAPABILITY.EDIT_INTERNAL_BOOKING]).toBe(false);
      expect(granted[BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING]).toBe(false);
    }
  });

  test("every platform-locked field is refused even when the UI is bypassed", () => {
    const granted = caps(PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION);
    const writes = checkBookingFieldWrites({
      capabilities: granted,
      source: BOOKING_SOURCE.PLATFORM,
      fields: [...PLATFORM_LOCKED_FIELDS],
    });
    expect(writes.allowed).toBe(false);
    expect(writes.deniedFields.sort()).toEqual([...PLATFORM_LOCKED_FIELDS].sort());
    expect(writes.code).toBe("PLATFORM_BOOKING_READ_ONLY");
  });

  test("an unclassified record grants nothing until it is reviewed", () => {
    const ambiguous = resolveBookingCapabilities({
      source: "",
      status: PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED,
      role: BOOKING_ROLE.SUPERADMIN,
      companyId: COMPANY,
      orderCompanyId: COMPANY,
    });
    expect(ambiguous[BOOKING_CAPABILITY.VIEW_BOOKING]).toBe(false);
  });
});
