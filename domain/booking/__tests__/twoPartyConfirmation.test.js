/**
 * @jest-environment node
 */

const fs = require("fs");
const path = require("path");

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import {
  CALENDAR_TONE,
  PLATFORM_WORKFLOW_STAGE,
  resolveContractorCalendarTone,
  resolveInternalRecordStatus,
  resolvePlatformWorkflowStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { getOrderColor } from "@/domain/orders/getOrderColor";
import { palette } from "@/theme";
import { applyVisibilityToOrder } from "@/domain/orders/orderVisibility";
import { evaluateDrivingLicenceAccess } from "@/domain/legal/drivingLicenceAccess";
import {
  CUSTOMER_CONFIRMATION,
  SUPPLIER_RESPONSE,
  canPlatformConfirmBooking,
  resolveCustomerConfirmation,
} from "@/domain/orders/supplierResponseStatus";

const COMPANY = { isAdmin: true, role: 1, ownerId: "co1", id: "admin1" };

function platform(overrides = {}) {
  return {
    my_order: true,
    source: "PLATFORM",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    ownerId: "co1",
    customerName: "Maria Costa",
    email: "maria@example.com",
    phone: "+340000",
    drivingLicenceUrls: ["https://res.cloudinary.com/demo/licence.jpg"],
    ...overrides,
  };
}

describe("two-party booking confirmation", () => {
  test("no UI copy says a booking was confirmed by Rovaro", () => {
    const files = [
      "app/admin/features/orders/OrdersTableSection.js",
      "app/admin/features/orders/components/SupplierResponseCell.js",
      "app/admin/features/orders/components/CustomerConfirmationCell.js",
      "app/admin/features/orders/modals/EditOrderModal.js",
      "app/ui/email/renderEmail.js",
      "locales/en.json",
      "domain/orders/supplierResponse.js",
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), "utf8").toLowerCase();
      expect(text).not.toContain("confirmed by rovaro");
    }
  });

  test("superadmin confirmation is not part of the successful path", () => {
    expect(canPlatformConfirmBooking(platform({ supplierResponse: "CONFIRMED" }))).toBe(false);
  });

  test("a new platform request waits for the supplier", () => {
    const order = platform({ bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION });
    expect(resolvePlatformWorkflowStage(order)).toBe(
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION
    );
    expect(resolveCustomerConfirmation(order)).toBe(CUSTOMER_CONFIRMATION.NOT_REQUESTED);
    expect(resolveContractorCalendarTone(order)).toBe(CALENDAR_TONE.NEW_REQUEST);
  });

  test("supplier confirmation moves the booking to customer payment and does not reveal identity", () => {
    const order = platform({
      bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
      supplierResponse: SUPPLIER_RESPONSE.CONFIRMED,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "admin1",
    });
    expect(resolvePlatformWorkflowStage(order)).toBe(
      PLATFORM_WORKFLOW_STAGE.AWAITING_CUSTOMER_PAYMENT
    );
    expect(resolveCustomerConfirmation(order)).toBe(CUSTOMER_CONFIRMATION.AWAITING_PAYMENT);
    const hidden = applyVisibilityToOrder(order, COMPANY);
    expect(hidden.email).toBeUndefined();
    expect(hidden.phone).toBeUndefined();
    expect(hidden.drivingLicenceUrls).toBeUndefined();
    expect(hidden.customerName).not.toBe("Maria Costa");
    expect(
      evaluateDrivingLicenceAccess({
        order,
        isSuperadmin: false,
        sessionOwnerId: "co1",
      }).allowed
    ).toBe(false);
  });

  test("verified Booking Fee payment is the only customer confirmation write", () => {
    const checkout = fs.readFileSync(
      path.join(process.cwd(), "domain/orders/rentalStripeCheckout.js"),
      "utf8"
    );
    expect(checkout).toContain('customerConfirmation: "CONFIRMED_BY_PAYMENT"');
    expect(checkout).toContain('bookingFeePaymentStatus: "PAID"');
    expect(checkout).toContain('"payment.paidAt": paidAt');
  });

  test("verified Booking Fee payment confirms the customer and reveals contacts", () => {
    const order = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      supplierResponse: SUPPLIER_RESPONSE.CONFIRMED,
      customerConfirmation: CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT,
      bookingFeePaymentStatus: "PAID",
      payment: { status: "paid", paidAt: "2026-09-01T10:00:00.000Z" },
    });
    expect(resolveCustomerConfirmation(order)).toBe(CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT);
    expect(resolvePlatformWorkflowStage(order)).toBe(PLATFORM_WORKFLOW_STAGE.BOOKING_CONFIRMED);
    const visible = applyVisibilityToOrder(order, COMPANY);
    expect(visible.email).toBe("maria@example.com");
    expect(visible.phone).toBe("+340000");
    expect(visible.customerName).toBe("Maria Costa");
    expect(visible.drivingLicenceUrls).toBeUndefined();
    expect(visible.hasDrivingLicence).toBe(true);
    expect(
      evaluateDrivingLicenceAccess({
        order,
        isSuperadmin: false,
        sessionOwnerId: "co1",
        now: new Date("2026-09-02T10:00:00.000Z"),
      }).allowed
    ).toBe(true);
  });

  test("internal bookings keep internal statuses and purple colour", () => {
    const tentative = { my_order: false, source: "INTERNAL", confirmed: false };
    const confirmed = { my_order: false, source: "INTERNAL", confirmed: true };
    expect(resolveInternalRecordStatus(tentative)).toBe("TENTATIVE");
    expect(resolveInternalRecordStatus(confirmed)).toBe("CONFIRMED");
    expect(resolvePlatformWorkflowStage(tentative)).toBeNull();
    expect(resolveContractorCalendarTone(tentative)).toBe(CALENDAR_TONE.INTERNAL);
    expect(resolveContractorCalendarTone(confirmed)).toBe(CALENDAR_TONE.INTERNAL);
    expect(getOrderColor(tentative).main).toBe(palette.contractorBooking.internal);
    expect(resolveCustomerConfirmation(tentative)).toBe(CUSTOMER_CONFIRMATION.NOT_REQUESTED);
  });

  test("calendar colour follows source and status, and a problem is only a border", () => {
    const waiting = platform({ bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION });
    const paying = platform({ bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING });
    const paid = platform({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "paid" },
    });
    const problem = { ...paid, hasProblem: true };
    expect(getOrderColor(waiting).main).toBe(palette.contractorBooking.newRequest);
    expect(getOrderColor(paying).main).toBe(palette.contractorBooking.awaitingPayment);
    expect(getOrderColor(paid).main).toBe(palette.contractorBooking.confirmedPaid);
    expect(getOrderColor(problem).main).toBe(palette.contractorBooking.confirmedPaid);
    expect(getOrderColor(problem).border).toBe(palette.contractorBooking.problem);
    expect(getOrderColor(paid).border).toBeUndefined();
  });

  test("decline and alternative stages do not look like a payment request", () => {
    const declined = platform({ bookingStatus: BOOKING_STATUS.SUPPLIER_DECLINED });
    const alternative = platform({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED });
    expect(resolvePlatformWorkflowStage(declined)).toBe(PLATFORM_WORKFLOW_STAGE.SUPPLIER_DECLINED);
    expect(resolvePlatformWorkflowStage(alternative)).toBe(
      PLATFORM_WORKFLOW_STAGE.ALTERNATIVE_PROPOSED
    );
    expect(resolveCustomerConfirmation(declined)).toBe(CUSTOMER_CONFIRMATION.NOT_REQUESTED);
    expect(resolveCustomerConfirmation(alternative)).toBe(CUSTOMER_CONFIRMATION.AWAITING_ACCEPTANCE);
    expect(resolveContractorCalendarTone(declined)).not.toBe(CALENDAR_TONE.AWAITING_PAYMENT);
    expect(resolveContractorCalendarTone(alternative)).not.toBe(CALENDAR_TONE.AWAITING_PAYMENT);
  });
});
