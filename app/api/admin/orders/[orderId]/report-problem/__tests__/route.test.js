/**
 * @jest-environment node
 */

jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@/domain/legal/auditTrail", () => ({
  extractAuditContext: jest.fn(() => ({
    ipAddress: "127.0.0.1",
    userAgent: "test",
  })),
  recordAuditEvent: jest.fn(),
}));

import { requireAdmin } from "@lib/adminAuth";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { POST } from "../route";

const COMPANY = "64a000000000000000000001";

function orderFixture(status = "COMPLETED") {
  return {
    _id: "64a0000000000000000000aa",
    orderNumber: "RVR-001",
    source: "PLATFORM",
    my_order: true,
    ownerId: COMPANY,
    bookingStatus: status,
    payment: { status: "paid" },
    save: jest.fn(async function save() {
      return this;
    }),
  };
}

function request() {
  return new Request(
    "https://rovaro.autos/api/admin/orders/o1/report-problem",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "DAMAGE",
        message: "Scratch on passenger door",
      }),
    }
  );
}

describe("completed platform booking problem report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({
      session: {
        user: {
          isAdmin: true,
          role: ROLE.ADMIN,
          ownerId: COMPANY,
          email: "fleet@example.com",
        },
      },
      errorResponse: null,
    });
  });

  test("stores a linked issue while preserving COMPLETED and audit logging it", async () => {
    const order = orderFixture();
    Order.findById.mockResolvedValue(order);
    const response = await POST(request(), { params: { orderId: "o1" } });
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(order.bookingStatus).toBe("COMPLETED");
    expect(order.status).toBeUndefined();
    expect(order.bookingIssues).toHaveLength(1);
    expect(order.bookingIssues[0]).toMatchObject({
      status: "OPEN",
      type: "DAMAGE",
      note: "Scratch on passenger door",
      reportedBy: "fleet@example.com",
    });
    expect(result.issue.issueId).toBeTruthy();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RENTAL_DISPUTE_CREATED" })
    );
  });

  test("company admin cannot report a problem on a cancelled booking", async () => {
    Order.findById.mockResolvedValue(orderFixture("CUSTOMER_CANCELLED"));
    const response = await POST(request(), { params: { orderId: "o1" } });
    expect(response.status).toBe(403);
  });
});
