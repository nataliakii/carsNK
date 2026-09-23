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
  test("omits fake accept links and superadmin calendar when no confirm token is issued", () => {
    const actions = buildCompanyEmailOrderActions(
      "507f1f77bcf86cd799439011",
      "ru"
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe("Contact Rovaro support");
    expect(actions[0].href).toContain("/api/order/company-email-action?token=");
    expect(JSON.stringify(actions)).not.toMatch(/superadmin/i);
    expect(actions.every((a) => !a.href.includes("/admin"))).toBe(true);
    expect(actions[0].href).not.toContain("/api/booking/partner-confirm");
  });

  test("points confirm and decline at the partner-confirm page", () => {
    const actions = buildCompanyEmailOrderActions(
      "507f1f77bcf86cd799439011",
      "en",
      { confirmToken: "one-time-token" }
    );
    expect(actions).toHaveLength(3);
    expect(actions[0].label).toBe("Confirm availability");
    expect(actions[0].href).toContain("/api/booking/partner-confirm?token=");
    expect(actions[0].href).toContain("one-time-token");
    expect(actions[1].href).toBe(actions[0].href);
    expect(actions[2].label).toBe("Contact Rovaro support");
    expect(actions.some((a) => a.href === actions[0].href.replace(/partner-confirm.*/, "admin") || a.href.endsWith("/admin"))).toBe(false);
  });

  test("Spanish partner CTA never says superadmins", () => {
    const actions = buildCompanyEmailOrderActions(
      "507f1f77bcf86cd799439011",
      "es",
      { confirmToken: "tok" }
    );
    expect(actions[2].label).toBe("Contactar con soporte de Rovaro");
    expect(JSON.stringify(actions)).not.toMatch(/superadmin/i);
  });
});
