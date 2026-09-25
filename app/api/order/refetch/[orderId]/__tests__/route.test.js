/**
 * @jest-environment node
 */

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@lib/authOptions", () => ({ authOptions: {} }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));

import { getServerSession } from "next-auth/next";
import { requireAdmin } from "@lib/adminAuth";
import { Order } from "@models/order";
import { GET } from "../route";

const COMPANY = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";
const ORDER_ID = "64a0000000000000000000aa";

function order(overrides = {}) {
  return {
    _id: ORDER_ID,
    ownerId: COMPANY,
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: "PENDING_SUPPLIER_CONFIRMATION",
    customerName: "Ana Lopez",
    email: "ana@example.com",
    phone: "+34600000000",
    drivingLicenceUrls: ["https://res.cloudinary.com/demo/licence.jpg"],
    payment: { status: "pending" },
    confirmed: false,
    ...overrides,
  };
}

function companySession(ownerId = COMPANY) {
  return {
    user: { isAdmin: true, role: 1, ownerId },
  };
}

describe("GET /api/order/refetch/[orderId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({
      session: companySession(),
      errorResponse: null,
    });
    getServerSession.mockResolvedValue(companySession());
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(order()),
    });
  });

  test("authenticated supplier receives its order without customer contacts before payment", async () => {
    const res = await GET(new Request("https://rovaro.autos/api/order/refetch/" + ORDER_ID), {
      params: { orderId: ORDER_ID },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(String(body._id)).toBe(ORDER_ID);
    expect(body.email).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.drivingLicenceUrls).toBeUndefined();
    expect(body.customerName).not.toBe("Ana Lopez");
    expect(JSON.stringify(body)).not.toContain("ana@example.com");
  });

  test("another company cannot access the order", async () => {
    requireAdmin.mockResolvedValue({
      session: companySession(OTHER),
      errorResponse: null,
    });
    getServerSession.mockResolvedValue(companySession(OTHER));
    const res = await GET(new Request("https://rovaro.autos/api/order/refetch/" + ORDER_ID), {
      params: { orderId: ORDER_ID },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("Not found");
    expect(JSON.stringify(body)).not.toContain("ana@example.com");
    expect(JSON.stringify(body)).not.toContain("Ana Lopez");
  });

  test("paid booking keeps contacts for the owning company", async () => {
    Order.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        order({ payment: { status: "paid" }, bookingStatus: "BOOKING_CONFIRMED", confirmed: true })
      ),
    });
    const res = await GET(new Request("https://rovaro.autos/api/order/refetch/" + ORDER_ID), {
      params: { orderId: ORDER_ID },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("ana@example.com");
    expect(body.customerName).toBe("Ana Lopez");
  });
});
