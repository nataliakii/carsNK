/**
 * @jest-environment node
 *
 * The Spain 10% is a non-refundable Rovaro Booking Fee. Stripe is mocked;
 * no live charges or emails.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("@/lib/stripe", () => ({
  assertStripeReady: jest.fn(),
  getStripeMode: () => "test",
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerBookingFeeRefundEmail: jest.fn().mockResolvedValue({ ok: true }),
}));

import { ROLE } from "@models/user";
import { Order } from "@models/order";
import { assertStripeReady } from "@/lib/stripe";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { sendCustomerBookingFeeRefundEmail } from "@/domain/orders/marketplaceBookingEmails";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import customerTermsEn from "@/domain/legal/content/customer-booking-terms.en";
import customerTermsEs from "@/domain/legal/content/customer-booking-terms.es";
import partnerAgreementEn from "@/domain/legal/content/partner-agreement.en";
import partnerAgreementEs from "@/domain/legal/content/partner-agreement.es";
import {
  MARKETPLACE_FEE_NO_AUTO_REFUND,
  BOOKING_FEE_REFUND_CODE,
  assertVoluntaryMarketplaceFeeRefund,
  blockAutomaticMarketplaceFeeRefund,
  issueMarketplaceBookingFeeRefund,
  marketplaceBookingFeeExceptionClause,
} from "../marketplaceBookingFeeRefund";
import { marketplaceSplitLabels } from "../marketplaceFinancialSplit";

function paidMarketplaceOrder(overrides = {}) {
  const order = {
    _id: "order-1",
    orderNumber: "20260922180000",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    payment: {
      status: "paid",
      provider: "stripe",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      paidAmountMinor: 5000,
      amountMinor: 5000,
      refundedAmountMinor: 0,
      currency: "eur",
    },
    set(key, value) {
      this[key] = value;
    },
    save: jest.fn().mockResolvedValue(true),
    toObject() {
      return { ...this, payment: { ...this.payment } };
    },
    ...overrides,
  };
  return order;
}

describe("automatic marketplace Booking Fee refunds are blocked", () => {
  test.each(MARKETPLACE_FEE_NO_AUTO_REFUND)(
    "does not auto-refund for %s",
    (trigger) => {
      const result = blockAutomaticMarketplaceFeeRefund(trigger);
      expect(result.ok).toBe(false);
      expect(result.refunded).toBe(false);
      expect(result.automatic).toBe(false);
      expect(result.code).toBe(BOOKING_FEE_REFUND_CODE.BOOKING_FEE_NON_REFUNDABLE);
      expect(result.message).toMatch(/except where required by applicable law/i);
    }
  );
});

describe("voluntary refund gate", () => {
  test("rental-company ADMIN cannot authorise a refund", () => {
    const result = assertVoluntaryMarketplaceFeeRefund({
      actorRole: ROLE.ADMIN,
      reason: "customer asked",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.code).toBe(BOOKING_FEE_REFUND_CODE.FORBIDDEN_NOT_SUPERADMIN);
  });

  test("SUPERADMIN without an explicit reason is rejected", () => {
    const result = assertVoluntaryMarketplaceFeeRefund({
      actorRole: "superadmin",
      reason: "   ",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.code).toBe(BOOKING_FEE_REFUND_CODE.REASON_REQUIRED);
  });
});

describe("SUPERADMIN exceptional refund", () => {
  const refundsCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    refundsCreate.mockResolvedValue({
      id: "re_1",
      amount: 5000,
      currency: "eur",
    });
    assertStripeReady.mockReturnValue({ refunds: { create: refundsCreate } });
    Order.findById.mockResolvedValue(paidMarketplaceOrder());
  });

  test("ADMIN cannot call the Stripe refund path even with a reason", async () => {
    const result = await issueMarketplaceBookingFeeRefund({
      orderId: "order-1",
      reason: "goodwill",
      actorRole: ROLE.ADMIN,
      actorEmail: "admin@rental.test",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
    expect(sendCustomerBookingFeeRefundEmail).not.toHaveBeenCalled();
  });

  test("SUPERADMIN with reason calls refunds.create, AuditLog and customer email", async () => {
    const result = await issueMarketplaceBookingFeeRefund({
      orderId: "order-1",
      reason: "Required by applicable law — charge captured in error",
      actorRole: "superadmin",
      actorEmail: "root@rovaro.autos",
      idempotencyKey: "idem-refund-1",
    });
    expect(result.ok).toBe(true);
    expect(result.automatic).toBe(false);
    expect(result.stripeRefundId).toBe("re_1");
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_1",
        metadata: expect.objectContaining({
          kind: "rental_booking_fee",
          voluntary: "1",
        }),
      }),
      { idempotencyKey: "idem-refund-1" }
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RENTAL_BOOKING_FEE_REFUND_REQUESTED",
        userRole: "superadmin",
        result: "success",
        reason: expect.stringMatching(/applicable law/i),
      })
    );
    expect(sendCustomerBookingFeeRefundEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 5000,
        reason: expect.stringMatching(/applicable law/i),
      })
    );
  });
});

describe("copy and unpublished legal drafts", () => {
  test("customer and partner labels stay compact", () => {
    const en = marketplaceSplitLabels("en");
    expect(en.payNow).toBe("Pay now");
    expect(en.payAtPickup).toBe("Pay at pickup");
    expect(en.paidToRovaro).toBe("Paid to Rovaro");
    expect(en.collectFromCustomer).toBe("Collect from customer");
  });

  test("legal drafts include the statutory exception clause and are unpublished", () => {
    const clause = marketplaceBookingFeeExceptionClause();
    expect(clause).toBe(
      "except where required by applicable law or expressly authorised by Rovaro in exceptional circumstances"
    );
    const customerText = customerTermsEn.content.sections
      .map((s) => s.body)
      .join("\n");
    const partnerText = partnerAgreementEn.content.sections
      .map((s) => s.body)
      .join("\n");
    expect(customerText).toContain(clause);
    expect(partnerText).toContain(clause);
    expect(customerTermsEn.effectiveFrom).toBeNull();
    expect(partnerAgreementEn.effectiveFrom).toBeNull();
    expect(customerTermsEs.effectiveFrom).toBeNull();
    expect(partnerAgreementEs.effectiveFrom).toBeNull();
    expect(customerText).toContain("{{settings.bookingFeeDisplayNote}}");
    expect(partnerText).toContain("{{settings.bookingFeeDisplayNote}}");
    expect(partnerText).not.toContain("{{settings.bookingPrepaymentPercent}}");
    expect(partnerText).not.toContain("{{settings.supplierBalancePercent}}");
    expect(customerTermsEs.content.sections.map((s) => s.body).join("\n")).toContain(
      "{{settings.bookingFeeDisplayNote}}"
    );
    expect(
      partnerAgreementEs.content.sections.map((s) => s.body).join("\n")
    ).not.toContain("{{settings.bookingPrepaymentPercent}}");
    expect(customerText).not.toMatch(/If a prepayment has nevertheless been captured, it is refunded in full/);
    expect(partnerText).not.toMatch(
      /The Customer receives a full refund of the Booking Prepayment/
    );
  });
});
