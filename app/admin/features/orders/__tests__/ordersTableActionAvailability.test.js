/**
 * @jest-environment node
 *
 * The Orders table stopped stacking every possible action into the row. That is
 * a layout decision, and layout is not tested here. What is tested is the one
 * thing the move could have broken: which actions a role can still reach.
 *
 * Relocating an entry point must not grant or revoke a capability, and an action
 * the server refuses must be absent rather than merely moved.
 */
import fs from "fs";
import path from "path";

import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  BOOKING_CAPABILITY,
  resolveOrderCapabilities,
} from "@/domain/orders/bookingCapabilities";
import { buildBookingDetailsView } from "@/domain/booking/bookingDetailsView";
import { orderRequiresCompanyAction } from "@/domain/orders/companyRentalActions";
import {
  BOOKING_EMAIL_STAGE,
  SUPPLIER_DECISION,
  assertSupplierDecisionIsCurrent,
} from "@/domain/bookings/bookingEmailPolicy";

const COMPANY = "64a000000000000000000001";
const ORDER_ID = "64a0000000000000000000aa";

const companyAdmin = { isAdmin: true, role: 1, ownerId: COMPANY };

function platform(overrides = {}) {
  return {
    _id: ORDER_ID,
    source: "PLATFORM",
    my_order: true,
    ownerId: COMPANY,
    publicReference: "RVR-7K4P9",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    carModel: "Toyota Yaris",
    car: { transmission: "Automatic", class: "Economy", seats: 5 },
    ...overrides,
  };
}

function internal(overrides = {}) {
  return {
    _id: ORDER_ID,
    source: "INTERNAL",
    my_order: false,
    ownerId: COMPANY,
    carModel: "Toyota Yaris",
    ...overrides,
  };
}

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const TABLE = read("app/admin/features/orders/OrdersTableSection.js");
const CELL = read("app/admin/features/orders/components/SupplierResponseCell.js");
const DETAILS_MODAL = read(
  "app/admin/features/orders/modals/BookingDetailsModal.js"
);

describe("orders table action availability", () => {
  test("the three relocated actions are the same capabilities, hosted by the details modal", () => {
    const order = platform();
    const capabilities = resolveOrderCapabilities(order, companyAdmin);

    expect(capabilities[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(true);
    expect(capabilities[BOOKING_CAPABILITY.CONTACT_ROVARO]).toBe(true);

    const actionIds = buildBookingDetailsView(order, companyAdmin).actions.map(
      (action) => action.id
    );
    expect(actionIds).toEqual(
      expect.arrayContaining(["confirm", "replace", "decline", "contactRovaro"])
    );

    // Each relocated action has a dialog in the modal to land in.
    for (const dialog of ["replace", "decline", "contactRovaro"]) {
      expect(DETAILS_MODAL).toContain(`dialog === "${dialog}"`);
    }
  });

  test("an answered booking offers no second supplier decision anywhere", () => {
    const confirmed = platform({
      bookingStatus: BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT,
      supplierResponse: "CONFIRMED",
      partnerConfirmedAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const declined = platform({
      bookingStatus: BOOKING_STATUS.SUPPLIER_DECLINED,
      supplierResponse: "SUPPLIER_DECLINED",
      declineReason: "No vehicle of that class left",
    });

    for (const order of [confirmed, declined]) {
      const capabilities = resolveOrderCapabilities(order, companyAdmin);
      expect(capabilities[BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE]).toBe(false);
      expect(capabilities[BOOKING_CAPABILITY.DECLINE_REQUEST]).toBe(false);
      expect(capabilities[BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT]).toBe(false);

      // The endpoint behind the old "change response" button rejects it too, so
      // dropping the button removed a dead control, not a permission.
      for (const decision of [
        SUPPLIER_DECISION.CONFIRM_REQUESTED_VEHICLE,
        SUPPLIER_DECISION.DECLINE_REQUEST,
      ]) {
        expect(
          assertSupplierDecisionIsCurrent({
            order,
            decision,
            expectedStage: BOOKING_EMAIL_STAGE.AWAITING_SUPPLIER_CONFIRMATION,
          }).ok
        ).toBe(false);
      }
    }
  });

  test("an internal booking never reaches a platform-only action", () => {
    const order = internal();
    const capabilities = resolveOrderCapabilities(order, companyAdmin);

    for (const capability of [
      BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE,
      BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT,
      BOOKING_CAPABILITY.DECLINE_REQUEST,
      BOOKING_CAPABILITY.CONTACT_ROVARO,
      BOOKING_CAPABILITY.REPORT_PROBLEM,
    ]) {
      expect(`${capability}:${capabilities[capability]}`).toBe(`${capability}:false`);
    }

    // The row renders no supplier response for it, and the details modal it
    // opens is the internal one.
    expect(CELL).toContain("if (!isClient)");
    expect(TABLE).toContain("isPlatformBooking(selectedOrderForEdit)");
    expect(orderRequiresCompanyAction(order)).toBe(false);
  });

  test("the row marks outstanding work with the same selector the badge counts", () => {
    expect(TABLE).toContain("orderRequiresCompanyAction(order)");
    expect(TABLE).toContain("table.actionRequired");

    expect(orderRequiresCompanyAction(platform())).toBe(true);
    expect(
      orderRequiresCompanyAction(
        platform({ bookingStatus: BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT })
      )
    ).toBe(false);
    // A problem assigned back to the supplier is outstanding work the old row
    // did not mark at all.
    expect(
      orderRequiresCompanyAction(
        platform({
          bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
          problemAssignedTo: "SUPPLIER",
          hasProblem: true,
        })
      )
    ).toBe(true);
  });

  test("the row keeps the entry points that have no other home", () => {
    expect(TABLE).toContain("table.recordRemainingPayment");
    expect(TABLE).toContain("table.confirmInternally");
    expect(TABLE).toContain("table.markTentative");
  });
});
