/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";

jest.mock("@lib/adminAuth", () => ({ requireSuperAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/orders/invalidateMarketplaceCheckout", () => ({
  clampInvalidationRetryBatchSize: (n) => {
    const value = Number(n);
    if (!Number.isFinite(value) || value <= 0) return 50;
    return Math.min(200, Math.round(value));
  },
  retryMarketplaceCheckoutInvalidations: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { requireSuperAdmin } from "@lib/adminAuth";
import { retryMarketplaceCheckoutInvalidations } from "@/domain/orders/invalidateMarketplaceCheckout";
import * as route from "../route";
import { GET, POST } from "../route";

const ENDPOINT =
  "https://rovaro.autos/api/internal/marketplace-checkout-invalidation/retry";
const SECRET = "checkout-invalidate-secret";

function request(headers = {}, body = {}) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  retryMarketplaceCheckoutInvalidations.mockResolvedValue({
    processed: 2,
    invalidated: 1,
    skippedPaid: 0,
    stillRetryable: 1,
    failed: 1,
  });
  requireSuperAdmin.mockResolvedValue({
    session: null,
    errorResponse: new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
    }),
  });
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("marketplace checkout invalidation retry cron", () => {
  test("exports POST and GET only", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(route.PUT).toBeUndefined();
    expect(route.PATCH).toBeUndefined();
    expect(route.DELETE).toBeUndefined();
  });

  test("does not call syncIndexes", () => {
    const src = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
    expect(src).not.toMatch(/syncIndexes/);
  });

  test("GET never mutates", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(retryMarketplaceCheckoutInvalidations).not.toHaveBeenCalled();
  });

  test("10. Retry endpoint rejects missing/wrong secret", async () => {
    const missing = await POST(request());
    expect(missing.status).toBe(401);
    expect(retryMarketplaceCheckoutInvalidations).not.toHaveBeenCalled();

    const wrong = await POST(request({ authorization: "Bearer nope" }));
    expect(wrong.status).toBe(401);
    expect(retryMarketplaceCheckoutInvalidations).not.toHaveBeenCalled();

    delete process.env.CRON_SECRET;
    const empty = await POST(
      request({ authorization: `Bearer ${SECRET}` }, { limit: 10 })
    );
    expect(empty.status).toBe(401);
    expect(retryMarketplaceCheckoutInvalidations).not.toHaveBeenCalled();
  });

  test("11. Retry endpoint processes bounded batches", async () => {
    const res = await POST(
      request({ authorization: `Bearer ${SECRET}` }, { limit: 2 })
    );
    expect(res.status).toBe(200);
    expect(retryMarketplaceCheckoutInvalidations).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 2, trigger: "cron" })
    );
    const clamped = await POST(
      request({ authorization: `Bearer ${SECRET}` }, { limit: 9999 })
    );
    expect(clamped.status).toBe(200);
    expect(retryMarketplaceCheckoutInvalidations).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 200 })
    );
  });

  test("12. One failed item does not stop the batch", async () => {
    const res = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      processed: 2,
      invalidated: 1,
      skippedPaid: 0,
      stillRetryable: 1,
      failed: 1,
    });
    expect(JSON.stringify(body)).not.toMatch(/@|sk_(live|test)_|whsec_/);
  });
});
