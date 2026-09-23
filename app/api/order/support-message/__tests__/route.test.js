/**
 * @jest-environment node
 */
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-for-company-email-actions";

jest.mock("@lib/adminAuth", () => ({
  getAdminSession: jest.fn(),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  supportMessageRateLimitOptions: jest.fn(() => ({
    tableName: "supportMessageRateLimit",
  })),
}));
jest.mock("@/domain/orders/partnerSupportMessage", () => {
  const actual = jest.requireActual("@/domain/orders/partnerSupportMessage");
  return {
    ...actual,
    loadOrderForSupport: jest.fn(),
    sendPartnerSupportMessage: jest.fn(),
    listSupportMessagesForOrder: jest.fn(),
  };
});

import { getAdminSession } from "@lib/adminAuth";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import {
  loadOrderForSupport,
  sendPartnerSupportMessage,
  listSupportMessagesForOrder,
} from "@/domain/orders/partnerSupportMessage";
import { signCompanyEmailActionToken } from "@/domain/orders/companyEmailActionToken";
import { ROLE } from "@models/user";
import { GET, POST } from "../route";

const ORDER_ID = "64b7f0c2a1b2c3d4e5f60789";
const COMPANY_A = "64b7f0c2a1b2c3d4e5f60701";
const COMPANY_B = "64b7f0c2a1b2c3d4e5f60702";

function jsonRequest(body) {
  return new Request("https://rovaro.autos/api/order/support-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/order/support-message", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumePublicPostOrError.mockResolvedValue(null);
    sendPartnerSupportMessage.mockResolvedValue({
      ok: true,
      message: "Your message has been sent to Rovaro support.",
      messageId: "msg-1",
      orderId: ORDER_ID,
      duplicate: false,
    });
    loadOrderForSupport.mockResolvedValue({
      _id: ORDER_ID,
      ownerId: COMPANY_A,
      orderNumber: "RV-1001",
    });
  });

  test("unauthenticated request without token is 401", async () => {
    getAdminSession.mockResolvedValue(null);
    const res = await POST(
      jsonRequest({ orderId: ORDER_ID, message: "Hello there" })
    );
    expect(res.status).toBe(401);
    expect(sendPartnerSupportMessage).not.toHaveBeenCalled();
  });

  test("partner can send a message for their own booking", async () => {
    getAdminSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "partner@costa.test",
        isAdmin: true,
        role: ROLE.ADMIN,
        ownerId: COMPANY_A,
      },
    });
    const res = await POST(
      jsonRequest({
        orderId: ORDER_ID,
        message: "Need a later pickup",
        reason: "booking_question",
        to: "attacker@evil.test",
        recipient: "attacker@evil.test",
        companyId: COMPANY_B,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sendPartnerSupportMessage).toHaveBeenCalledTimes(1);
    const args = sendPartnerSupportMessage.mock.calls[0][0];
    expect(args.order._id).toBe(ORDER_ID);
    expect(args.message).toBe("Need a later pickup");
    expect(args.actor.user.ownerId).toBe(COMPANY_A);
    expect(args).not.toHaveProperty("to");
  });

  test("partner cannot send for another company's booking", async () => {
    getAdminSession.mockResolvedValue({
      user: {
        id: "user-2",
        email: "other@firm.test",
        isAdmin: true,
        role: ROLE.ADMIN,
        ownerId: COMPANY_B,
      },
    });
    const res = await POST(
      jsonRequest({
        orderId: ORDER_ID,
        message: "Should not work",
      })
    );
    expect(res.status).toBe(403);
    expect(sendPartnerSupportMessage).not.toHaveBeenCalled();
  });

  test("valid email-action token can send without a session", async () => {
    getAdminSession.mockResolvedValue(null);
    const token = signCompanyEmailActionToken({
      orderId: ORDER_ID,
      action: "message",
    });
    const res = await POST(
      jsonRequest({
        token,
        message: "From the email link",
        reason: "other",
        to: "attacker@evil.test",
      })
    );
    expect(res.status).toBe(200);
    expect(sendPartnerSupportMessage).toHaveBeenCalled();
  });

  test("rate limit is enforced", async () => {
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, message: "Too many requests", code: "RATE_LIMIT" },
    });
    getAdminSession.mockResolvedValue({
      user: {
        id: "user-1",
        isAdmin: true,
        role: ROLE.ADMIN,
        ownerId: COMPANY_A,
      },
    });
    const res = await POST(
      jsonRequest({ orderId: ORDER_ID, message: "Hello there" })
    );
    expect(res.status).toBe(429);
    expect(sendPartnerSupportMessage).not.toHaveBeenCalled();
  });
});

describe("GET /api/order/support-message", () => {
  test("superadmin can read stored messages", async () => {
    getAdminSession.mockResolvedValue({
      user: { id: "sa", isAdmin: true, role: ROLE.SUPERADMIN },
    });
    loadOrderForSupport.mockResolvedValue({
      _id: ORDER_ID,
      ownerId: COMPANY_A,
    });
    listSupportMessagesForOrder.mockResolvedValue([
      { id: "m1", message: "Need a later pickup", orderId: ORDER_ID },
    ]);
    const request = {
      nextUrl: new URL(
        `https://rovaro.autos/api/order/support-message?orderId=${ORDER_ID}`
      ),
    };
    const res = await GET(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].message).toBe("Need a later pickup");
  });

  test("unauthenticated history is 401", async () => {
    getAdminSession.mockResolvedValue(null);
    const request = {
      nextUrl: new URL(
        `https://rovaro.autos/api/order/support-message?orderId=${ORDER_ID}`
      ),
    };
    const res = await GET(request);
    expect(res.status).toBe(401);
  });
});
