/**
 * @jest-environment node
 */

jest.mock("@lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
}));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/orders/supplierResponse", () => ({
  applySupplierResponse: jest.fn(),
}));

import { requireAdmin } from "@/lib/adminAuth";
import { ROLE } from "@models/user";
import { applySupplierResponse } from "@/domain/orders/supplierResponse";
import { PATCH } from "../route";

function request(body) {
  return new Request("https://rovaro.autos/api/admin/orders/o1/supplier-response", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/orders/[orderId]/supplier-response", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdmin.mockResolvedValue({
      session: { user: { isAdmin: true, role: ROLE.ADMIN, ownerId: "c1" } },
      errorResponse: null,
    });
  });

  test("rejects decline without reason", async () => {
    const res = await PATCH(request({ response: "DECLINED" }), {
      params: { orderId: "o1" },
    });
    expect(res.status).toBe(400);
    expect(applySupplierResponse).not.toHaveBeenCalled();
  });

  test("forwards ACCEPTED to domain", async () => {
    applySupplierResponse.mockResolvedValue({
      status: 200,
      body: { success: true, data: { confirmed: false } },
    });
    const res = await PATCH(request({ response: "ACCEPTED" }), {
      params: { orderId: "o1" },
    });
    expect(res.status).toBe(200);
    expect(applySupplierResponse).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "o1", response: "ACCEPTED" })
    );
  });
});
