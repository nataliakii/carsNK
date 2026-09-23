/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";

jest.mock("@lib/adminAuth", () => ({ requireSuperAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/booking/alternativeVehicle", () => ({
  expireOpenAlternativeOffers: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { requireSuperAdmin } from "@lib/adminAuth";
import { expireOpenAlternativeOffers } from "@/domain/booking/alternativeVehicle";
import * as route from "../route";
import { GET, POST } from "../route";

const ENDPOINT = "https://rovaro.autos/api/internal/alternative-offers/expire";
const SECRET = "alt-expire-secret";

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
  expireOpenAlternativeOffers.mockResolvedValue({
    scanned: 1,
    expired: 1,
    emailed: 1,
    failed: [],
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

describe("alternative-offers expire cron", () => {
  test("exports POST and GET only", () => {
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(route.PUT).toBeUndefined();
  });

  test("does not call syncIndexes", () => {
    const src = fs.readFileSync(path.join(__dirname, "../route.js"), "utf8");
    expect(src).not.toMatch(/syncIndexes/);
  });

  test("GET never mutates", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(expireOpenAlternativeOffers).not.toHaveBeenCalled();
  });

  test("rejects unauthorised POST", async () => {
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(expireOpenAlternativeOffers).not.toHaveBeenCalled();
  });

  test("authorised POST expires due offers", async () => {
    const res = await POST(
      request({ authorization: `Bearer ${SECRET}` }, { limit: 10 })
    );
    expect(res.status).toBe(200);
    expect(expireOpenAlternativeOffers).toHaveBeenCalled();
  });

  test("empty CRON_SECRET is not a default and does not authorize", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      request({ authorization: "Bearer anything" }, { limit: 10 })
    );
    expect(res.status).toBe(401);
    expect(expireOpenAlternativeOffers).not.toHaveBeenCalled();
  });
});
