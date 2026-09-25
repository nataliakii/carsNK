/**
 * @jest-environment node
 */
jest.mock("@lib/adminAuth", () => ({
  requireAdmin: jest.fn(),
  requireSuperAdmin: jest.fn(),
}));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("@models/MailLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("@/domain/mail/resendOutboundMail", () => ({
  resendMailLog: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  extractAuditContext: () => ({ ipAddress: "1.1.1.1", userAgent: "test" }),
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/marketplacePaymentVisibility", () => ({
  buildMarketplacePaymentOpsView: jest.fn(),
}));
jest.mock("@/domain/orders/reissueMarketplacePaymentLink", () => ({
  evaluatePaymentLinkReissue: jest.fn(),
  reissueMarketplacePaymentLink: jest.fn(),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentRequestEmail: jest.fn(),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: { CHECKOUT: "checkout" },
  assertPartnerCanOperate: jest.fn().mockResolvedValue({ allowed: true }),
  auditPartnerComplianceBlock: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/invalidateMarketplaceCheckout", () => ({
  invalidateMarketplaceCheckoutsForOrderRecord: jest.fn().mockResolvedValue([{ ok: true }]),
  retryCheckoutInvalidationForOrder: jest.fn().mockResolvedValue({
    processed: 1,
    invalidated: 1,
    skippedPaid: 0,
    stillRetryable: 0,
    failed: 0,
  }),
  buildCheckoutInvalidationView: jest.fn(() => ({
    pending: false,
    canRetry: false,
  })),
}));
jest.mock("@/domain/orders/marketplaceBookingFeeRefund", () => ({
  issueMarketplaceBookingFeeRefund: jest.fn(),
}));
jest.mock("@/domain/orders/applyMarketplacePriceCorrection", () => ({
  applyMarketplacePriceCorrection: jest.fn(),
}));

import { requireAdmin, requireSuperAdmin } from "@lib/adminAuth";
import { ROLE } from "@models/user";
import { Order } from "@models/order";
import { reissueMarketplacePaymentLink } from "@/domain/orders/reissueMarketplacePaymentLink";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { retryCheckoutInvalidationForOrder } from "@/domain/orders/invalidateMarketplaceCheckout";
import { issueMarketplaceBookingFeeRefund } from "@/domain/orders/marketplaceBookingFeeRefund";
import { GET, POST } from "../route";

function request(method, body) {
  return new Request("https://rovaro.autos/api/admin/orders/o1/payment-ops", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("payment-ops permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.findById.mockResolvedValue({
      _id: "o1",
      my_order: true,
      bookingMode: "MARKETPLACE_REQUEST",
      payment: { checkoutUrl: "https://pay", providerPaymentId: "cs_1" },
      toObject: () => ({ _id: "o1" }),
    });
  });

  test("rental company ADMIN cannot issue payment links", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Forbidden — superadmin only" }),
        { status: 403 }
      ),
    });
    const res = await POST(request("POST", { action: "reissue", reason: "payment_link_expired" }), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(res.status).toBe(403);
    expect(reissueMarketplacePaymentLink).not.toHaveBeenCalled();
  });

  test("superadmin permission is required to reissue", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: { user: { email: "root@rovaro.autos", role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    reissueMarketplacePaymentLink.mockResolvedValue({
      ok: true,
      url: "https://pay/new",
      sessionId: "cs_2",
    });
    const res = await POST(
      request("POST", { action: "reissue", reason: "payment_link_expired" }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(res.status).toBe(200);
    expect(reissueMarketplacePaymentLink).toHaveBeenCalled();
  });

  test("13. superadmin reissue forwards an explicit compliance override", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: { user: { email: "root@rovaro.autos", role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    reissueMarketplacePaymentLink.mockResolvedValue({
      ok: true,
      url: "https://pay/new",
      sessionId: "cs_2",
    });
    const res = await POST(
      request("POST", {
        action: "reissue",
        reason: "payment_link_expired",
        complianceOverride: true,
        complianceOverrideReason: "Recover existing unpaid request after suspension",
      }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(res.status).toBe(200);
    expect(reissueMarketplacePaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        complianceOverride: true,
        complianceOverrideReason:
          "Recover existing unpaid request after suspension",
        actorRole: "superadmin",
      })
    );
  });

  test("GET still loads for a superadmin", async () => {
    requireAdmin.mockResolvedValue({
      session: { user: { role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    const { buildMarketplacePaymentOpsView } = jest.requireMock(
      "@/domain/orders/marketplacePaymentVisibility"
    );
    buildMarketplacePaymentOpsView.mockResolvedValue({
      canIssueNewLink: true,
      canResendExisting: false,
    });
    const res = await GET(request("GET"), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canIssueNewLink).toBe(true);
  });

  test("16. superadmin manual retry requires SUPERADMIN and is audited", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Forbidden — superadmin only" }),
        { status: 403 }
      ),
    });
    const denied = await POST(request("POST", { action: "retry_invalidation" }), {
      params: Promise.resolve({ orderId: "o1" }),
    });
    expect(denied.status).toBe(403);
    expect(retryCheckoutInvalidationForOrder).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();

    requireSuperAdmin.mockResolvedValue({
      session: { user: { email: "root@rovaro.autos", role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    const { buildMarketplacePaymentOpsView } = jest.requireMock(
      "@/domain/orders/marketplacePaymentVisibility"
    );
    buildMarketplacePaymentOpsView.mockResolvedValue({
      invalidation: { pending: false, canRetry: false },
    });
    const allowed = await POST(
      request("POST", { action: "retry_invalidation" }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(allowed.status).toBe(200);
    expect(retryCheckoutInvalidationForOrder).toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RENTAL_CHECKOUT_INVALIDATE_RETRY",
        userRole: "superadmin",
        userEmail: "root@rovaro.autos",
        metadata: expect.objectContaining({ trigger: "superadmin_manual" }),
      })
    );
    const body = await allowed.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        processed: 1,
        invalidated: 1,
      })
    );
    expect(body).not.toHaveProperty("lastCheckoutError");
    expect(JSON.stringify(body)).not.toMatch(/sk_(live|test)_/);
  });

  test("rental company ADMIN cannot issue a Booking Fee refund", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response(
        JSON.stringify({ message: "Forbidden — superadmin only" }),
        { status: 403 }
      ),
    });
    const res = await POST(
      request("POST", { action: "refund", reason: "goodwill" }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(res.status).toBe(403);
    expect(issueMarketplaceBookingFeeRefund).not.toHaveBeenCalled();
  });

  test("SUPERADMIN refund forwards an explicit reason", async () => {
    requireSuperAdmin.mockResolvedValue({
      session: { user: { email: "root@rovaro.autos", role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    issueMarketplaceBookingFeeRefund.mockResolvedValue({
      ok: true,
      stripeRefundId: "re_1",
      amountMinor: 5000,
      mailed: { ok: true },
    });
    const { buildMarketplacePaymentOpsView } = jest.requireMock(
      "@/domain/orders/marketplacePaymentVisibility"
    );
    buildMarketplacePaymentOpsView.mockResolvedValue({
      payment: { status: "paid", netPaidAmountMinor: 0 },
    });
    const res = await POST(
      request("POST", {
        action: "refund",
        reason: "Required by applicable law",
        idempotencyKey: "idem-1",
      }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(res.status).toBe(200);
    expect(issueMarketplaceBookingFeeRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "o1",
        reason: "Required by applicable law",
        actorRole: "superadmin",
        actorEmail: "root@rovaro.autos",
      })
    );
  });

  test("superadmin cannot run payment-ops on internal company bookings", async () => {
    Order.findById.mockResolvedValue({
      _id: "o1",
      my_order: false,
      bookingMode: "OPS_CALENDAR",
    });
    requireSuperAdmin.mockResolvedValue({
      session: { user: { email: "root@rovaro.autos", role: ROLE.SUPERADMIN } },
      errorResponse: null,
    });
    const res = await POST(
      request("POST", { action: "reissue", reason: "payment_link_expired" }),
      { params: Promise.resolve({ orderId: "o1" }) }
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("internal_company_booking");
    expect(reissueMarketplacePaymentLink).not.toHaveBeenCalled();
  });
});
