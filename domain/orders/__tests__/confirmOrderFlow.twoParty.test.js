/**
 * @jest-environment node
 */

jest.mock("@models/order", () => ({
  Order: { findById: jest.fn(), find: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/auditLog", () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock("@/domain/orders/orderAccessPolicy", () => ({
  getOrderAccess: jest.fn(() => ({ canConfirm: true })),
}));
jest.mock("@/domain/time/athensTime", () => ({
  getTimeBucket: jest.fn(() => "FUTURE"),
}));
jest.mock("@/domain/orders/orderNotificationDispatcher", () => ({
  notifyOrderAction: jest.fn(),
}));
jest.mock("@/domain/booking/analyzeConfirmationConflicts", () => ({
  analyzeConfirmationConflicts: jest.fn(() => ({ canConfirm: true, level: null })),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { CONFIRM: "CONFIRM" },
  evaluateRentalAvailability: jest.fn(() => ({
    available: true,
    hardConflict: false,
    blockingRecords: [],
  })),
}));
jest.mock("@/domain/booking/bookingMode", () => ({
  resolveBookingMode: jest.fn(() => "INTERNAL"),
  isMarketplaceRequestMode: jest.fn(() => false),
}));
jest.mock("@config/stripe", () => ({ isStripeConfigured: jest.fn(() => true) }));
jest.mock("@/domain/orders/companyRentalPaymentPolicy", () => ({
  resolveCompanyRentalPaymentPolicy: jest.fn(() => ({})),
  isRentalConfirmBlockedByPayment: jest.fn(() => false),
  shouldChargeRentalOnConfirm: jest.fn(() => true),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  createRentalCheckoutSession: jest.fn(),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  assertPartnerCanOperate: jest.fn(),
  auditPartnerComplianceBlock: jest.fn(),
  partnerComplianceJson: jest.fn(),
  PARTNER_OPERATION_PURPOSE: { CONFIRM: "CONFIRM" },
}));

import Company from "@models/company";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { notifyOrderAction } from "@/domain/orders/orderNotificationDispatcher";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { confirmOrderFlow } from "@/domain/orders/confirmOrderFlow";

function makeOrder(overrides = {}) {
  return {
    _id: "ord1",
    confirmed: false,
    car: "car1",
    ownerId: "co1",
    save: jest.fn(function save() {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

const admin = { isAdmin: true, role: ROLE.ADMIN, id: "a1", email: "a@co.test", name: "Ana" };

describe("confirmOrderFlow two-party rules", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.find.mockResolvedValue([]);
    Company.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: "Fleet", rentalPayments: {} }),
      }),
    });
  });

  test("platform bookings are not confirmed by Rovaro or a superadmin toggle", async () => {
    const order = makeOrder({ my_order: true, source: "PLATFORM" });
    Order.findById.mockResolvedValue(order);
    const result = await confirmOrderFlow({
      order,
      sessionUser: { ...admin, role: ROLE.SUPERADMIN },
      bufferHours: 2,
    });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("PLATFORM_CONFIRMATION_NOT_ALLOWED");
    expect(order.save).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(notifyOrderAction).not.toHaveBeenCalled();
  });

  test("internal confirmation does not create Stripe, commission, or a platform notification", async () => {
    const order = makeOrder({ my_order: false, source: "INTERNAL" });
    Order.findById.mockResolvedValue(order);
    const result = await confirmOrderFlow({
      order,
      sessionUser: admin,
      bufferHours: 2,
    });
    expect(result.status).toBe(200);
    expect(order.confirmed).toBe(true);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(notifyOrderAction).not.toHaveBeenCalled();
    expect(order.bookingFeePaymentStatus).toBeUndefined();
    expect(order.customerConfirmation).toBeUndefined();
  });
});
