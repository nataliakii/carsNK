/**
 * @jest-environment node
 */
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-for-company-email-actions";

jest.mock("@/domain/orders/companyEmailActions", () => ({
  parseCompanyEmailActionToken: jest.fn(),
  applyCompanyEmailDecision: jest.fn(),
  sendCompanyEmailMessageToSuperadmin: jest.fn(),
}));

jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  supportMessageRateLimitOptions: jest.fn(() => ({
    tableName: "supportMessageRateLimit",
  })),
}));

jest.mock("@/domain/legal/auditTrail", () => ({
  extractAuditContext: jest.fn(() => ({ ipAddress: "1.1.1.1", userAgent: "jest" })),
}));

import {
  parseCompanyEmailActionToken,
  applyCompanyEmailDecision,
  sendCompanyEmailMessageToSuperadmin,
} from "@/domain/orders/companyEmailActions";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";
import { GET, POST } from "../route";

describe("company-email-action route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consumePublicPostOrError.mockResolvedValue(null);
  });

  test("GET message shows compact Rovaro support UI, not the old form", async () => {
    parseCompanyEmailActionToken.mockResolvedValue({
      ok: true,
      action: "message",
      orderId: "507f1f77bcf86cd799439011",
    });

    const request = {
      nextUrl: new URL(
        "https://rovaro.autos/api/order/company-email-action?token=message-token&lang=en"
      ),
      headers: { get: () => "" },
    };
    const res = await GET(request);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain("Contact Rovaro support");
    expect(html).toContain("support-dialog");
    expect(html).toContain("Back to bookings");
    expect(html).toContain("/admin/orders");
    expect(html).not.toMatch(/superadmin/i);
    expect(html).not.toContain("Send to superadmins");
    expect(html).not.toContain("Open admin calendar");
    expect(html).not.toMatch(/CarsNK|Natali Cars|BBQR|carsnk\.gr/i);
    expect(sendCompanyEmailMessageToSuperadmin).not.toHaveBeenCalled();
  });

  test("GET accept validates token and does not apply decision", async () => {
    parseCompanyEmailActionToken.mockResolvedValue({
      ok: true,
      action: "accept",
      orderId: "507f1f77bcf86cd799439011",
    });

    const request = {
      nextUrl: new URL(
        "https://carsnk.gr/api/order/company-email-action?token=accept-token"
      ),
    };
    const res = await GET(request);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/method="POST"/i);
    expect(html).toMatch(/name="intent" value="accept"/);
    expect(html).toMatch(/name="token" value="accept-token"/);
    expect(applyCompanyEmailDecision).not.toHaveBeenCalled();
    expect(sendCompanyEmailMessageToSuperadmin).not.toHaveBeenCalled();
  });

  test("GET reject is confirm-only (no mutation)", async () => {
    parseCompanyEmailActionToken.mockResolvedValue({
      ok: true,
      action: "reject",
      orderId: "507f1f77bcf86cd799439011",
    });

    const request = {
      nextUrl: new URL(
        "https://carsnk.gr/api/order/company-email-action?token=reject-token"
      ),
    };
    const res = await GET(request);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/name="intent" value="reject"/);
    expect(applyCompanyEmailDecision).not.toHaveBeenCalled();
  });

  test("POST accept still applies decision", async () => {
    applyCompanyEmailDecision.mockResolvedValue({
      ok: true,
      message: "Accepted. Superadmins have been notified.",
    });

    const request = new Request(
      "https://carsnk.gr/api/order/company-email-action",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "accept-token", intent: "accept" }),
      }
    );
    const res = await POST(request);
    const html = await res.text();

    expect(applyCompanyEmailDecision).toHaveBeenCalledWith({
      token: "accept-token",
      decision: "accepted",
    });
    expect(html).toMatch(/Accepted/);
  });

  test("POST message rate limit returns 429", async () => {
    consumePublicPostOrError.mockResolvedValue({
      status: 429,
      body: { success: false, code: "RATE_LIMIT" },
    });
    const request = new Request(
      "https://rovaro.autos/api/order/company-email-action",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "message-token",
          intent: "message",
          message: "Hello there",
        }),
      }
    );
    const res = await POST(request);
    expect(res.status).toBe(429);
    expect(sendCompanyEmailMessageToSuperadmin).not.toHaveBeenCalled();
  });
});
