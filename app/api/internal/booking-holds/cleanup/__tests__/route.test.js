/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";

jest.mock("@lib/adminAuth", () => ({ requireSuperAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/booking/expiredHoldCleanup", () => ({
  clampCleanupBatchSize: (n) => n || 50,
  runExpiredHoldCleanup: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { requireSuperAdmin } from "@lib/adminAuth";
import { runExpiredHoldCleanup } from "@/domain/booking/expiredHoldCleanup";
import * as route from "../route";
import { GET, POST } from "../route";

const ENDPOINT = "https://rovaro.autos/api/internal/booking-holds/cleanup";
const SECRET = "hold-cleanup-secret";

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
  runExpiredHoldCleanup.mockResolvedValue({
    scanned: 1,
    released: 1,
    skippedConfirmed: 0,
    failed: 0,
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

describe("booking-holds cleanup cron", () => {
  test("exports POST and GET only", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(route.PUT).toBeUndefined();
    expect(route.PATCH).toBeUndefined();
    expect(route.DELETE).toBeUndefined();
  });

  test("does not call syncIndexes or ensureBookingHoldIndexes", () => {
    const src = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
    expect(src).not.toMatch(/syncIndexes/);
    expect(src).not.toMatch(/ensureBookingHoldIndexes/);
  });

  test("GET never mutates", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(runExpiredHoldCleanup).not.toHaveBeenCalled();
  });

  test("rejects unauthorised POST", async () => {
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(runExpiredHoldCleanup).not.toHaveBeenCalled();
  });

  test("rejects a wrong secret", async () => {
    const res = await POST(request({ authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
    expect(runExpiredHoldCleanup).not.toHaveBeenCalled();
  });

  test("runs with CRON_SECRET bearer", async () => {
    const res = await POST(request({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      scanned: 1,
      released: 1,
      skippedConfirmed: 0,
      failed: 0,
    });
  });
});
