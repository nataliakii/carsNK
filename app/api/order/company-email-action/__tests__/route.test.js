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

jest.mock("@config/domain", () => ({
  absoluteUrl: (path) => `https://carsnk.gr${path}`,
  getBaseUrl: () => "https://carsnk.gr",
}));

import {
  parseCompanyEmailActionToken,
  applyCompanyEmailDecision,
  sendCompanyEmailMessageToSuperadmin,
} from "@/domain/orders/companyEmailActions";
import { GET, POST } from "../route";

describe("company-email-action route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
