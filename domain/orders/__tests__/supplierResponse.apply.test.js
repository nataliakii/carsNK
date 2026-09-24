/**
 * @jest-environment node
 */

jest.mock("@models/car", () => ({ Car: { findById: jest.fn() } }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn(), find: jest.fn() } }));
jest.mock("@models/company", () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock("@models/auditLog", () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { CONFIRM: "CONFIRM" },
  evaluateRentalAvailability: jest.fn(() => ({ available: true, hardConflict: false })),
}));
jest.mock("@/domain/booking/analyzeConfirmationConflicts", () => ({
  analyzeConfirmationConflicts: jest.fn(() => ({ canConfirm: true, level: null })),
}));
jest.mock("@/domain/booking/bookingMode", () => ({
  resolveBookingMode: jest.fn(() => "GREECE"),
}));

import { ROLE } from "@models/user";
import { Car } from "@models/car";
import { Order } from "@models/order";
import Company from "@models/company";
import AuditLog from "@models/auditLog";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { applySupplierResponse } from "@/domain/orders/supplierResponse";
import { evaluateRentalAvailability } from "@/domain/booking/availabilityEngine";

const OWNER = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";
const CAR_ID = "64a0000000000000000000aa";

function makeOrder(overrides = {}) {
  const order = {
    _id: "ord1",
    orderNumber: "R-100",
    my_order: true,
    confirmed: false,
    ownerId: OWNER,
    car: CAR_ID,
    carModel: "Golf",
    rentalStartDate: new Date("2026-10-01"),
    rentalEndDate: new Date("2026-10-05"),
    timeIn: new Date("2026-10-01T10:00:00Z"),
    timeOut: new Date("2026-10-05T10:00:00Z"),
    partnerConfirmMeta: null,
    save: jest.fn().mockImplementation(function save() {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
  return order;
}

const companyAdmin = {
  isAdmin: true,
  role: ROLE.ADMIN,
  ownerId: OWNER,
  id: "admin1",
  name: "Maria",
  email: "maria@partner.test",
};

describe("applySupplierResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Company.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: "Aegean Cars", bufferTime: 2 }),
      }),
    });
    Car.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: CAR_ID, ownerId: OWNER, model: "Golf" }),
      }),
    });
    Order.find.mockResolvedValue([]);
    AuditLog.create.mockResolvedValue({});
  });

  test("company admin can accept own vehicle without setting confirmed", async () => {
    const order = makeOrder();
    Order.findById.mockResolvedValue(order);
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "ACCEPTED",
    });
    expect(result.status).toBe(200);
    expect(result.body.data.confirmed).toBe(false);
    expect(result.body.data.supplierResponse).toBe("SUPPLIER_ACCEPTED");
    expect(order.confirmed).toBeFalsy();
    expect(order.companyEmailDecision).toBe("accepted");
    expect(notifySuperadmin).toHaveBeenCalledTimes(1);
    expect(notifySuperadmin.mock.calls[0][0].title).toContain("Aegean Cars");
    expect(notifySuperadmin.mock.calls[0][0].title).toContain("R-100");
  });

  test("cannot respond for another company's order", async () => {
    Order.findById.mockResolvedValue(makeOrder({ ownerId: OTHER }));
    Car.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: CAR_ID, ownerId: OTHER }),
      }),
    });
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "ACCEPTED",
    });
    expect(result.status).toBe(403);
    expect(notifySuperadmin).not.toHaveBeenCalled();
  });

  test("decline without going through payload validation still stores reason when provided", async () => {
    const order = makeOrder();
    Order.findById.mockResolvedValue(order);
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "DECLINED",
      reason: "Car in workshop",
    });
    expect(result.status).toBe(200);
    expect(order.companyEmailDecision).toBe("rejected");
    expect(order.declineReason).toBe("Car in workshop");
    expect(order.confirmed).toBeFalsy();
    expect(notifySuperadmin).toHaveBeenCalledTimes(1);
    expect(notifySuperadmin.mock.calls[0][0].bodyLines.join(" ")).toContain("workshop");
  });

  test("locked after platform confirmation", async () => {
    Order.findById.mockResolvedValue(makeOrder({ confirmed: true, companyEmailDecision: "accepted" }));
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "ACCEPTED",
    });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("SUPPLIER_RESPONSE_LOCKED");
  });

  test("repeat identical acceptance is idempotent and does not re-notify", async () => {
    const order = makeOrder({
      companyEmailDecision: "accepted",
      partnerConfirmedAt: new Date(),
      partnerConfirmMeta: { notifiedKind: "accepted" },
    });
    Order.findById.mockResolvedValue(order);
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "ACCEPTED",
    });
    expect(result.status).toBe(200);
    expect(result.body.idempotent).toBe(true);
    expect(notifySuperadmin).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });

  test("platform superadmin cannot use supplier-response", async () => {
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: { isAdmin: true, role: ROLE.SUPERADMIN, email: "s@x.com" },
      response: "ACCEPTED",
    });
    expect(result.status).toBe(403);
  });

  test("view-as superadmin can accept for that company", async () => {
    const order = makeOrder();
    Order.findById.mockResolvedValue(order);
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: {
        isAdmin: true,
        role: ROLE.SUPERADMIN,
        viewAsCompanyId: OWNER,
        name: "Rovaro",
        email: "s@x.com",
      },
      response: "ACCEPTED",
    });
    expect(result.status).toBe(200);
    expect(order.confirmed).toBeFalsy();
  });

  test("availability hard conflict blocks acceptance", async () => {
    evaluateRentalAvailability.mockReturnValueOnce({
      hardConflict: true,
      userSafeReason: "dates overlap",
    });
    Order.findById.mockResolvedValue(makeOrder());
    const result = await applySupplierResponse({
      orderId: "ord1",
      sessionUser: companyAdmin,
      response: "ACCEPTED",
    });
    expect(result.status).toBe(409);
    expect(orderConfirmed(result)).toBeUndefined();
  });
});

function orderConfirmed(result) {
  return result.body?.data?.confirmed;
}
