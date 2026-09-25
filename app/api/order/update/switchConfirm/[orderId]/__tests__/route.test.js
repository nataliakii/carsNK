/**
 * @jest-environment node
 */

jest.mock("@lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
  requirePlatformAdmin: jest.fn(),
}));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@models/company", () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock("@/domain/orders/confirmOrderFlow", () => ({
  confirmOrderFlow: jest.fn(),
}));

import { requireAdmin, requirePlatformAdmin } from "@/lib/adminAuth";
import { ROLE } from "@models/user";
import { Order } from "@models/order";
import Company from "@models/company";
import { confirmOrderFlow } from "@/domain/orders/confirmOrderFlow";
import { PATCH } from "@/app/api/order/update/switchConfirm/[orderId]/route";
import { orderMessages } from "@/domain/messages";

function request() {
  return new Request("https://rovaro.autos/api/order/update/switchConfirm/o1", {
    method: "PATCH",
  });
}

describe("switchConfirm client-order gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Company.findById.mockResolvedValue({ bufferTime: 2, email: "c@x.com" });
  });

  test("company admin cannot use final-confirmation for client orders", async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { isAdmin: true, role: ROLE.ADMIN, ownerId: "c1" } },
      errorResponse: null,
    });
    requirePlatformAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "no" }), { status: 403 }),
    });
    Order.findById.mockResolvedValue({ _id: "o1", my_order: true });

    const res = await PATCH(request(), { params: { orderId: "o1" } });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.message).toBe(orderMessages.CONFIRM_PERMISSION_DENIED);
    expect(confirmOrderFlow).not.toHaveBeenCalled();
  });

  test("superadmin in company view cannot use platform confirmation", async () => {
    requireAdmin.mockResolvedValue({
      session: {
        user: {
          isAdmin: true,
          role: ROLE.SUPERADMIN,
          viewAsCompanyId: "c1",
        },
      },
      errorResponse: null,
    });
    requirePlatformAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ message: "company_context" }), {
        status: 403,
      }),
    });
    Order.findById.mockResolvedValue({ _id: "o1", my_order: true });

    const res = await PATCH(request(), { params: { orderId: "o1" } });
    expect(res.status).toBe(403);
    expect(confirmOrderFlow).not.toHaveBeenCalled();
  });

  test("platform superadmin cannot confirm a booking on behalf of either party", async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { isAdmin: true, role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    requirePlatformAdmin.mockResolvedValue({
      session: { user: { isAdmin: true, role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    Order.findById.mockResolvedValue({ _id: "o1", my_order: true });
    confirmOrderFlow.mockResolvedValue({
      status: 200,
      body: { success: true, data: { confirmed: true } },
    });

    const res = await PATCH(request(), { params: { orderId: "o1" } });
    expect(res.status).toBe(409);
    expect(confirmOrderFlow).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.code).toBe("PLATFORM_CONFIRMATION_NOT_ALLOWED");
  });
});
