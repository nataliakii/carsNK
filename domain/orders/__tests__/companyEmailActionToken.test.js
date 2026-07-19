/**
 * @jest-environment node
 */
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-for-company-email-actions";

import {
  signCompanyEmailActionToken,
  verifyCompanyEmailActionToken,
} from "../companyEmailActionToken";
import { buildCompanyEmailOrderActions } from "../buildCompanyEmailOrderActions";

describe("companyEmailActionToken", () => {
  test("signs and verifies accept token", () => {
    const token = signCompanyEmailActionToken({
      orderId: "507f1f77bcf86cd799439011",
      action: "accept",
    });
    const verified = verifyCompanyEmailActionToken(token);
    expect(verified.ok).toBe(true);
    expect(verified.action).toBe("accept");
    expect(verified.orderId).toBe("507f1f77bcf86cd799439011");
  });

  test("rejects tampered token", () => {
    const token = signCompanyEmailActionToken({
      orderId: "507f1f77bcf86cd799439011",
      action: "reject",
    });
    const verified = verifyCompanyEmailActionToken(token + "x");
    expect(verified.ok).toBe(false);
  });

  test("rejects expired token", () => {
    const token = signCompanyEmailActionToken({
      orderId: "507f1f77bcf86cd799439011",
      action: "message",
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const verified = verifyCompanyEmailActionToken(token);
    expect(verified.ok).toBe(false);
    expect(verified.message).toMatch(/expired/i);
  });
});

describe("buildCompanyEmailOrderActions", () => {
  test("returns four CTAs with signed links", () => {
    const actions = buildCompanyEmailOrderActions(
      "507f1f77bcf86cd799439011",
      "ru"
    );
    expect(actions).toHaveLength(4);
    expect(actions[0].label).toBe("Принять");
    expect(actions[1].label).toBe("Отклонить");
    expect(actions[2].href).toContain("/admin");
    expect(actions[0].href).toContain("/api/order/company-email-action?token=");
    expect(actions[3].label).toMatch(/суперадмин/i);
  });
});
