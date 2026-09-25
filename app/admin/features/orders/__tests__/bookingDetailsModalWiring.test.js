import fs from "node:fs";
import path from "node:path";

import {
  BOOKING_DETAILS_MODAL_MAX_WIDTH,
  BOOKING_DETAILS_SECTION,
} from "@/domain/admin/bookingDetailsLayout";
import { PLATFORM_FORBIDDEN_CONTROLS } from "@/domain/booking/bookingDetailsView";

const read = (relative) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

const MODAL_PATH = "app/admin/features/orders/modals/BookingDetailsModal.js";
const MODAL = read(MODAL_PATH);
const ORDERS_TABLE = read("app/admin/features/orders/OrdersTableSection.js");
const CALENDAR = read("app/components/calendar-ui/CalendarOverlays.js");
const ACTIONS = read("app/admin/features/orders/actions/bookingDetailsActions.js");

describe("booking details modal wiring", () => {
  it("the calendar and the orders list open the same component", () => {
    for (const source of [ORDERS_TABLE, CALENDAR]) {
      expect(source).toContain("modals/BookingDetailsModal");
      expect(source).toContain("<BookingDetailsModal");
    }
  });

  it("an orderId deep link opens it against freshly loaded server state", () => {
    expect(ORDERS_TABLE).toContain('get("orderId")');
    expect(ORDERS_TABLE).toContain("loadAdminOrder");
    // The modal re-reads the order itself, so every entry point agrees.
    expect(MODAL).toContain("loadAdminOrder(orderId)");
  });

  it("INTERNAL bookings keep their own editing flow and PLATFORM bookings never reach it", () => {
    expect(ORDERS_TABLE).toContain("isPlatformBooking(selectedOrderForEdit)");
    expect(ORDERS_TABLE).toContain("<EditOrderModal");
    expect(MODAL).toContain("!isPlatformBooking(current)) return null");
    expect(MODAL).not.toContain("<EditOrderModal");
  });

  it("no generic edit control is rendered for a platform booking", () => {
    for (const control of PLATFORM_FORBIDDEN_CONTROLS) {
      expect(MODAL.toLowerCase()).not.toContain(control.toLowerCase());
    }
    expect(MODAL).not.toContain("Offline");
    expect(MODAL).not.toContain("disabled={true}");
  });

  it("the modal makes no API call of its own", () => {
    expect(MODAL).not.toContain("fetch(");
    expect(MODAL).toContain("actions/bookingDetailsActions");
    // Replacement is a guaranteed-class acknowledgement; fleet picker was removed.
    expect(MODAL).toContain("proposeEquivalentReplacement");
    expect(MODAL).toContain("guaranteeAck");
    expect(MODAL).not.toContain("loadReplacementFleetCars");
    // The support task reuses the endpoint that already exists.
    expect(read("app/admin/features/orders/actions/supplierBookingActions.js")).toContain(
      "ask-rovaro"
    );
  });

  it("the width comes from a named constant, not an inline number", () => {
    expect(MODAL).toContain("maxWidth: BOOKING_DETAILS_MODAL_MAX_WIDTH");
    expect(BOOKING_DETAILS_MODAL_MAX_WIDTH).toBeGreaterThanOrEqual(520);
    expect(BOOKING_DETAILS_MODAL_MAX_WIDTH).toBeLessThanOrEqual(720);
    expect(Object.keys(BOOKING_DETAILS_SECTION).length).toBeGreaterThan(0);
  });

  it("money (collect / total) is rendered before the vehicle block", () => {
    const money = MODAL.indexOf('data-testid="booking-money"');
    const vehicle = MODAL.indexOf('data-testid="vehicle-snapshot"');
    expect(money).toBeGreaterThan(-1);
    expect(vehicle).toBeGreaterThan(-1);
    expect(money).toBeLessThan(vehicle);
  });

  it("the amount the company collects is the emphasised figure", () => {
    expect(MODAL).toContain("SupplierPayout");
    expect(MODAL).toContain('data-testid="payable-to-supplier"');
    expect(MODAL).toMatch(/<SupplierPayoutAmount variant="h4"/);
    expect(MODAL).toMatch(/<TotalAmount variant="body1"/);
  });

  it("price details stay collapsed until opened, with total still visible", () => {
    expect(MODAL).toContain("bookingDetails.price.showBreakdown");
    expect(MODAL).toContain("{priceTotal}");
    expect(MODAL).toContain("{priceOpen ? priceBreakdown : null}");
  });

  it("warns instead of showing a second total when the line items do not sum", () => {
    expect(MODAL).toContain('data-testid="price-data-warning"');
    expect(MODAL).toContain("bookingDetails.price.dataWarning");
  });

  it("the confirmation dialog repeats the essential terms", () => {
    const dialog = MODAL.slice(MODAL.indexOf('dialog === "confirm"'));
    for (const key of [
      "bookingDetails.vehicle.requested",
      "bookingDetails.vehicle.transmission",
      "bookingDetails.dates.pickup",
      "bookingDetails.dates.return",
      "bookingDetails.price.totalRentalPrice",
      "bookingDetails.price.payableToSupplier",
    ]) {
      expect(dialog).toContain(key);
    }
  });

  it("contacting Rovaro sends a category and a message and never mutates the booking", () => {
    expect(MODAL).toContain("bookingDetails.contactDialog.category");
    expect(MODAL).toContain("bookingDetails.contactDialog.reference");
    expect(ACTIONS).toContain("askRovaroAboutBooking");
    expect(ACTIONS).not.toContain("updateOrderConfirmation");
  });

  it("supplier confirm/decline use the API response enum, not legacy availability strings", () => {
    expect(ACTIONS).toContain("SUPPLIER_RESPONSE_PAYLOAD");
    expect(ACTIONS).toContain("SUPPLIER_RESPONSE_PAYLOAD.ACCEPTED");
    expect(ACTIONS).toContain("SUPPLIER_RESPONSE_PAYLOAD.DECLINED");
    expect(ACTIONS).not.toMatch(/response:\s*"available"/);
    expect(ACTIONS).not.toMatch(/response:\s*"unavailable"/);
    expect(MODAL).toMatch(/dialog === "decline"[\s\S]*severity="error"/);
  });
});
