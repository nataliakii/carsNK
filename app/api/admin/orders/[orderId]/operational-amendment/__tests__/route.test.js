/**
 * @jest-environment node
 */

jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@models/car", () => ({ Car: { findById: jest.fn() } }));
jest.mock("@/domain/legal/auditTrail", () => ({ recordAuditEvent: jest.fn() }));

import { requireAdmin } from "@lib/adminAuth";
import { Order } from "@models/order";
import { Car } from "@models/car";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { ROLE } from "@models/user";
import { POST } from "../route";

const COMPANY = "64a000000000000000000001";

function makeOrder(overrides = {}) {
  const order = {
    _id: "64a0000000000000000000aa",
    orderNumber: "RVR-001",
    source: "PLATFORM",
    my_order: true,
    ownerId: COMPANY,
    bookingStatus: "BOOKING_CONFIRMED",
    payment: { status: "paid" },
    customerName: "Before Name",
    phone: "+34123456789",
    email: "before@example.com",
    car: "old-car",
    placeOutDetail: "Old instructions",
    secondDriver: false,
    ChildSeats: 0,
    insurance: "CDW",
    drivingLicenceVerificationStatus: "PENDING",
    operationalAmendments: [],
    toObject() {
      return { ...this, toObject: undefined, save: undefined };
    },
    save: jest.fn(async function save() {
      return this;
    }),
    ...overrides,
  };
  return order;
}

function request(body) {
  return new Request(
    "https://rovaro.autos/api/admin/orders/o1/operational-amendment",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

async function post(body, order = makeOrder()) {
  Order.findById.mockResolvedValue(order);
  const response = await POST(request(body), { params: { orderId: "o1" } });
  return { response, order };
}

describe("paid PLATFORM operational amendment endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({
      session: {
        user: {
          isAdmin: true,
          role: ROLE.ADMIN,
          ownerId: COMPANY,
          email: "fleet@example.com",
          id: "company-admin",
        },
      },
      errorResponse: null,
    });
    recordAuditEvent.mockResolvedValue(true);
  });

  test("rejects date and price changes even with the agreement checkbox", async () => {
    const { response } = await post(
      {
        changes: { rentalEndDate: "2026-10-02", totalPrice: 99 },
        customerConsentRecorded: true,
      },
      makeOrder({ bookingStatus: "COMPLETED" })
    );
    expect(response.status).toBe(400);
    expect(Order.findById.mock.results[0].value).toBeDefined();
  });

  test("requires customer-agreement attestation", async () => {
    const { response } = await post(
      { changes: { customerName: "After Name" } },
      makeOrder({ bookingStatus: "COMPLETED" })
    );
    expect(response.status).toBe(409);
  });

  test("keeps cancelled bookings read-only", async () => {
    const cancelled = makeOrder({ bookingStatus: "CUSTOMER_CANCELLED" });
    const { response } = await post(
      {
        changes: { customerName: "After Name" },
        customerConsentRecorded: true,
      },
      cancelled
    );
    expect(response.status).toBe(409);
  });

  test("writes allowed operations and appends actor, consent and before/after audit", async () => {
    const { response, order } = await post(
      {
        changes: {
          customerName: "After Name",
          placeOutDetail: "Meet at the hotel entrance",
          secondDriver: true,
        },
        customerConsentRecorded: true,
        customerConsentNote: "Confirmed by phone",
      },
      makeOrder({ bookingStatus: "COMPLETED" })
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(order.customerName).toBe("After Name");
    expect(order.placeOutDetail).toBe("Meet at the hotel entrance");
    expect(order.secondDriver).toBe(true);
    expect(order.totalPrice).toBeUndefined();
    expect(order.operationalAmendments).toHaveLength(1);
    expect(order.operationalAmendments[0]).toMatchObject({
      fieldsChanged: ["customerName", "placeOutDetail", "secondDriver"],
      before: {
        customerName: "Before Name",
        placeOutDetail: "Old instructions",
      },
      after: {
        customerName: "After Name",
        placeOutDetail: "Meet at the hotel entrance",
      },
      customerConsent: { recorded: true, note: "Confirmed by phone" },
      actor: { email: "fleet@example.com", role: "ADMIN" },
    });
    expect(order.operationalAmendments[0].checksum).toHaveLength(64);
    expect(payload.revision.checksum).toBe(
      order.operationalAmendments[0].checksum
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BOOKING_OPERATIONAL_AMENDED" })
    );
  });

  test("records the actual fleet vehicle separately from the booked vehicle snapshot", async () => {
    Car.findById.mockResolvedValue({
      _id: "actual-car",
      ownerId: COMPANY,
      make: "Toyota",
      model: "Yaris",
      carNumber: "ES-1234",
    });
    const order = makeOrder({
      bookingStatus: "COMPLETED",
      car: "original-car",
    });
    const { response } = await post(
      {
        changes: { actualCarId: "actual-car" },
        customerConsentRecorded: true,
      },
      order
    );
    expect(response.status).toBe(200);
    expect(order.car).toBe("original-car");
    expect(order.actualVehicle).toMatchObject({
      carId: "actual-car",
      make: "Toyota",
      model: "Yaris",
      carNumber: "ES-1234",
    });
    expect(order.operationalAmendments[0].fieldsChanged).toEqual([
      "actualVehicle",
    ]);
  });
});
