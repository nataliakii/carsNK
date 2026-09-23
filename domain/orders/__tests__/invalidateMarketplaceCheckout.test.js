/**
 * @jest-environment node
 *
 * Unpaid Spain marketplace Checkout Sessions become unusable when a partner
 * loses operating permission. Stripe SDK is mocked — no live charges.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { find: jest.fn(), findById: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/PartnerAgreementAcceptance", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("@models/AlternativeVehicleOffer", () => ({
  __esModule: true,
  default: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn() },
}));
jest.mock("@/domain/legal/agreementService", () => ({
  getCurrentPackageChecksum: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  releaseMarketplaceHold: jest.fn().mockResolvedValue({ ok: true }),
  releaseMarketplaceHoldForOffer: jest.fn().mockResolvedValue({ ok: true, hold: { _id: "h1" } }),
}));
jest.mock("@/domain/orders/marketplaceBookingEmails", () => ({
  sendCustomerPaymentLinkUnavailableEmail: jest.fn().mockResolvedValue({
    ok: true,
    deduped: false,
  }),
}));
const stripeRetrieve = jest.fn();
const stripeExpire = jest.fn();
jest.mock("@config/stripe", () => ({
  getStripeMode: () => "test",
  isStripeConfigured: jest.fn(() => true),
}));
jest.mock("@/lib/stripe", () => ({
  assertStripeReady: jest.fn(() => ({
    checkout: { sessions: { retrieve: stripeRetrieve, expire: stripeExpire } },
  })),
}));

import { Order } from "@models/order";
import Company from "@models/company";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { getCurrentPackageChecksum } from "@/domain/legal/agreementService";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import {
  releaseMarketplaceHold,
  releaseMarketplaceHoldForOffer,
} from "@/domain/booking/bookingHold";
import { sendCustomerPaymentLinkUnavailableEmail } from "@/domain/orders/marketplaceBookingEmails";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import {
  CHECKOUT_INVALIDATION_REASON,
  CHECKOUT_INVALIDATION_RETRY,
  invalidateMarketplaceCheckoutForAlternativeOffer,
  invalidateMarketplaceCheckoutForOrder,
  invalidateMarketplaceCheckoutsForOutdatedAgreements,
  invalidateOpenMarketplaceCheckoutSessions,
  retryMarketplaceCheckoutInvalidations,
  shouldInvalidateOnVerificationChange,
} from "../invalidateMarketplaceCheckout";

const ES_ID = "64b7f2c3a1b2c3d4e5f60711";
const GR_ID = "64b7f2c3a1b2c3d4e5f60722";

function unpaidOrder(overrides = {}) {
  const paymentOverrides = overrides.payment;
  const rest = { ...overrides };
  delete rest.payment;
  const order = {
    _id: "order-1",
    orderNumber: "20260922180000",
    ownerId: ES_ID,
    email: "ana@example.com",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PAYMENT_PROCESSING,
    payment: {
      status: "pending",
      provider: "stripe",
      providerPaymentId: "cs_open",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_open",
      amountMinor: 10000,
      currency: "EUR",
      sessionHistory: [],
      ...paymentOverrides,
    },
    toObject() {
      return { ...this, payment: { ...this.payment } };
    },
    set(key, value) {
      this[key] = value;
    },
    save: jest.fn().mockResolvedValue(true),
    ...rest,
  };
  return order;
}

function spainCompany(overrides = {}) {
  return {
    _id: ES_ID,
    country: "ES",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    listedOnMarketplace: true,
    ...overrides,
  };
}

function mockCompany(doc) {
  Company.findById.mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve(doc),
    }),
  });
}

async function expireOpenSessions(reason) {
  stripeRetrieve.mockResolvedValue({
    id: "cs_open",
    status: "open",
    payment_status: "unpaid",
  });
  stripeExpire.mockResolvedValue({ id: "cs_open", status: "expired" });
  const order = unpaidOrder();
  Order.find.mockResolvedValue([order]);
  mockCompany(spainCompany());
  const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
    reason,
    actorEmail: "root@rovaro.autos",
    actorRole: "superadmin",
  });
  return { result, order };
}

describe("invalidateOpenMarketplaceCheckoutSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendCustomerPaymentLinkUnavailableEmail.mockResolvedValue({
      ok: true,
      deduped: false,
    });
    AlternativeVehicleOffer.find.mockResolvedValue([]);
    AlternativeVehicleOffer.findOne.mockResolvedValue(null);
  });

  test("1. Suspended partner → open unpaid session expired", async () => {
    const { result, order } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.SUSPENDED
    );
    expect(result.ok).toBe(true);
    expect(result.invalidated).toBe(1);
    expect(stripeExpire).toHaveBeenCalledWith("cs_open");
    expect(order.payment.status).toBe("expired");
    expect(order.payment.checkoutUrl).toBe("");
    expect(order.payment.providerPaymentId).toBe("cs_open");
    expect(order.payment.sessionHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: "cs_open" })])
    );
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_EXPIRED);
    expect(releaseMarketplaceHold).toHaveBeenCalledWith("order-1", expect.any(Object));
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RENTAL_CHECKOUT_INVALIDATED",
        reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
        metadata: expect.objectContaining({
          companyId: ES_ID,
          sessionId: "cs_open",
          reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
        }),
      })
    );
  });

  test("2. Rejected partner → open unpaid session expired", async () => {
    const { result, order } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.REJECTED
    );
    expect(result.invalidated).toBe(1);
    expect(order.payment.status).toBe("expired");
    expect(stripeExpire).toHaveBeenCalled();
  });

  test("3. Agreement termination → open unpaid session expired", async () => {
    const { result } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.AGREEMENT_MISSING
    );
    expect(result.invalidated).toBe(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RENTAL_CHECKOUT_INVALIDATED",
        reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_MISSING,
      })
    );
  });

  test("4. New published checksum → stale agreement session expired", async () => {
    getCurrentPackageChecksum.mockResolvedValue("pkg-new");
    PartnerAgreementAcceptance.find.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([{ companyId: ES_ID, packageChecksum: "pkg-old" }]),
      }),
    });
    stripeRetrieve.mockResolvedValue({
      id: "cs_open",
      status: "open",
      payment_status: "unpaid",
    });
    stripeExpire.mockResolvedValue({ status: "expired" });
    const order = unpaidOrder();
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    const result = await invalidateMarketplaceCheckoutsForOutdatedAgreements({
      actorEmail: "root@rovaro.autos",
    });
    expect(result.companies).toBe(1);
    expect(order.payment.status).toBe("expired");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_OUTDATED,
      })
    );
  });

  test("5. Marketplace disabled → session expired", async () => {
    const { result, order } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.MARKETPLACE_DISABLED
    );
    expect(result.invalidated).toBe(1);
    expect(order.payment.status).toBe("expired");
  });

  test("6. Already paid session remains untouched", async () => {
    const order = unpaidOrder({
      payment: { status: "paid", providerPaymentId: "cs_paid" },
    });
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.invalidated).toBe(0);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(order.payment.status).toBe("paid");
  });

  test("7. BOOKING_CONFIRMED remains untouched", async () => {
    const order = unpaidOrder({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "pending", providerPaymentId: "cs_open" },
    });
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.invalidated).toBe(0);
    expect(order.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
    expect(stripeExpire).not.toHaveBeenCalled();
  });

  test("8. Stripe reports complete during race → booking/hold not released", async () => {
    stripeRetrieve.mockResolvedValue({
      id: "cs_open",
      status: "complete",
      payment_status: "paid",
    });
    const order = unpaidOrder();
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.skippedPaid).toBe(1);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(order.payment.status).toBe("pending");
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
  });

  test("9. Stripe expiration failure is retryable and does not claim success", async () => {
    stripeRetrieve.mockResolvedValue({
      id: "cs_open",
      status: "open",
      payment_status: "unpaid",
    });
    stripeExpire.mockRejectedValue(new Error("stripe network down"));
    const order = unpaidOrder();
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.ok).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.invalidated).toBe(0);
    expect(order.payment.status).toBe("pending");
    expect(order.payment.checkoutUrl).toBe(
      "https://checkout.stripe.com/c/pay/cs_open"
    );
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RENTAL_CHECKOUT_INVALIDATE_FAILED" })
    );
    expect(notifySuperadmin).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: expect.arrayContaining([
          expect.stringContaining("PARTNER_SUSPENDED"),
        ]),
      })
    );
  });

  test("10. Repeated invalidation is idempotent", async () => {
    const { order } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.SUSPENDED
    );
    stripeExpire.mockClear();
    order.save.mockClear();
    releaseMarketplaceHold.mockClear();
    Order.find.mockResolvedValue([order]);
    const second = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(second.idempotent).toBe(1);
    expect(second.invalidated).toBe(0);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
  });

  test("11. Customer email sent once", async () => {
    const { order } = await expireOpenSessions(
      CHECKOUT_INVALIDATION_REASON.SUSPENDED
    );
    expect(sendCustomerPaymentLinkUnavailableEmail).toHaveBeenCalledTimes(1);
    sendCustomerPaymentLinkUnavailableEmail.mockResolvedValue({
      ok: true,
      deduped: true,
    });
    Order.find.mockResolvedValue([order]);
    mockCompany(spainCompany());
    await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(sendCustomerPaymentLinkUnavailableEmail).toHaveBeenCalledTimes(2);
    expect(sendCustomerPaymentLinkUnavailableEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({ stripeSessionId: "cs_open" })
    );
  });

  test("13. Superadmin receives the internal reason", async () => {
    await expireOpenSessions(CHECKOUT_INVALIDATION_REASON.SUSPENDED);
    expect(notifySuperadmin).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: expect.arrayContaining([
          "Internal reason: PARTNER_SUSPENDED",
        ]),
      })
    );
  });

  test("15. Greece and transfers remain unchanged", async () => {
    mockCompany({
      _id: GR_ID,
      country: "GR",
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
    });
    const result = await invalidateOpenMarketplaceCheckoutSessions(GR_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("not_marketplace");
    expect(Order.find).not.toHaveBeenCalled();
    expect(stripeExpire).not.toHaveBeenCalled();

    const transferLike = unpaidOrder({
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
    });
    const skipped = await invalidateMarketplaceCheckoutForOrder(transferLike, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(skipped.reason).toBe("not_marketplace");
    expect(transferLike.save).not.toHaveBeenCalled();
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
  });

  test("profile remaining VERIFIED does not invalidate", () => {
    expect(shouldInvalidateOnVerificationChange("VERIFIED", "VERIFIED")).toBe(
      false
    );
    expect(shouldInvalidateOnVerificationChange("DRAFT", "PENDING_VERIFICATION")).toBe(
      false
    );
    expect(shouldInvalidateOnVerificationChange("VERIFIED", "SUSPENDED")).toBe(
      true
    );
    expect(shouldInvalidateOnVerificationChange("VERIFIED", "REJECTED")).toBe(
      true
    );
  });
});

function altOffer(overrides = {}) {
  return {
    offerId: "ALT-ABCDEF0123456789",
    orderId: "order-1",
    companyId: ES_ID,
    status: "ACCEPTED",
    stripeSessionId: "cs_alt",
    checkoutUrl: "https://checkout.stripe.com/c/pay/cs_alt",
    sessionHistory: [],
    originalPriceMinor: 100000,
    proposedAuthoritativePrice: { grossMinor: 90000, currency: "EUR" },
    complianceInvalidateRetry: false,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function marketplaceOrderForOffer(overrides = {}) {
  return unpaidOrder({
    bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
    car: "car-original",
    authoritativePrice: { grossMinor: 100000, prepaymentMinor: 10000, currency: "EUR" },
    originalRequestSnapshot: { carId: "car-original", grossMinor: 100000 },
    acceptedAlternativeOfferId: "ALT-ABCDEF0123456789",
    payment: {
      status: "pending",
      provider: "stripe",
      providerPaymentId: "cs_new",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_new",
      amountMinor: 10000,
      currency: "EUR",
      sessionHistory: [],
    },
    ...overrides,
  });
}

describe("alternative-offer checkout invalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendCustomerPaymentLinkUnavailableEmail.mockResolvedValue({
      ok: true,
      deduped: false,
    });
    AlternativeVehicleOffer.find.mockResolvedValue([]);
    stripeRetrieve.mockResolvedValue({
      id: "cs_alt",
      status: "open",
      payment_status: "unpaid",
    });
    stripeExpire.mockResolvedValue({ status: "expired" });
  });

  test("1. Open unpaid alternative session is expired on suspension", async () => {
    const offer = altOffer();
    const order = marketplaceOrderForOffer();
    Order.find.mockResolvedValue([]);
    Order.findById.mockResolvedValue(order);
    AlternativeVehicleOffer.find.mockResolvedValue([offer]);
    mockCompany(spainCompany());
    const result = await invalidateOpenMarketplaceCheckoutSessions(ES_ID, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(result.invalidated).toBe(1);
    expect(stripeExpire).toHaveBeenCalledWith("cs_alt");
    expect(offer.checkoutUrl).toBe("");
    expect(offer.status).toBe("EXPIRED");
    expect(offer.sessionHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: "cs_alt" })])
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RENTAL_ALTERNATIVE_CHECKOUT_INVALIDATED" })
    );
  });

  test("2. Alternative session is expired when agreement becomes outdated", async () => {
    const offer = altOffer();
    Order.findById.mockResolvedValue(marketplaceOrderForOffer());
    const row = await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_OUTDATED,
    });
    expect(row.invalidated).toBe(true);
    expect(offer.status).toBe("EXPIRED");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: CHECKOUT_INVALIDATION_REASON.AGREEMENT_OUTDATED,
      })
    );
  });

  test("3. Paid alternative is untouched", async () => {
    const offer = altOffer();
    Order.findById.mockResolvedValue(
      marketplaceOrderForOffer({
        bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
        payment: { status: "paid", providerPaymentId: "cs_paid" },
      })
    );
    const row = await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(row.skippedPaid).toBe(true);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(offer.status).toBe("ACCEPTED");
    expect(releaseMarketplaceHoldForOffer).not.toHaveBeenCalled();
  });

  test("4. BOOKING_CONFIRMED order is untouched", async () => {
    const offer = altOffer();
    const order = marketplaceOrderForOffer({
      bookingStatus: BOOKING_STATUS.BOOKING_CONFIRMED,
      payment: { status: "pending", providerPaymentId: "cs_alt" },
    });
    Order.findById.mockResolvedValue(order);
    const row = await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(row.skippedConfirmed).toBe(true);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(offer.status).toBe("ACCEPTED");
    expect(offer.checkoutUrl).toContain("cs_alt");
    expect(order.bookingStatus).toBe(BOOKING_STATUS.BOOKING_CONFIRMED);
    expect(releaseMarketplaceHoldForOffer).not.toHaveBeenCalled();
  });

  test("5. Alternative hold is released once", async () => {
    const offer = altOffer();
    Order.findById.mockResolvedValue(marketplaceOrderForOffer());
    await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(releaseMarketplaceHoldForOffer).toHaveBeenCalledTimes(1);
    expect(releaseMarketplaceHoldForOffer).toHaveBeenCalledWith(
      "order-1",
      "ALT-ABCDEF0123456789",
      expect.any(Object)
    );
    expect(releaseMarketplaceHold).not.toHaveBeenCalled();
  });

  test("6. Original order/price is preserved", async () => {
    const offer = altOffer();
    const order = marketplaceOrderForOffer();
    Order.findById.mockResolvedValue(order);
    await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(order.car).toBe("car-original");
    expect(order.authoritativePrice).toEqual({
      grossMinor: 100000,
      prepaymentMinor: 10000,
      currency: "EUR",
    });
    expect(order.originalRequestSnapshot).toEqual({
      carId: "car-original",
      grossMinor: 100000,
    });
  });

  test("7. Customer receives one neutral email", async () => {
    const offer = altOffer();
    Order.findById.mockResolvedValue(marketplaceOrderForOffer());
    await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(sendCustomerPaymentLinkUnavailableEmail).toHaveBeenCalledTimes(1);
  });

  test("9. Newer session remains authoritative", async () => {
    const offer = altOffer();
    const order = marketplaceOrderForOffer();
    Order.findById.mockResolvedValue(order);
    await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(order.payment.providerPaymentId).toBe("cs_new");
    expect(order.bookingStatus).toBe(
      BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT
    );
    expect(order.payment.status).toBe("pending");
    expect(order.payment.sessionHistory).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: "cs_alt" })])
    );
  });

  test("18. Greece and transfers remain unchanged", async () => {
    const offer = altOffer({ companyId: GR_ID });
    Order.findById.mockResolvedValue(
      unpaidOrder({
        ownerId: GR_ID,
        bookingMode: BOOKING_MODES.OPS_CALENDAR,
      })
    );
    const row = await invalidateMarketplaceCheckoutForAlternativeOffer(offer, {
      reason: CHECKOUT_INVALIDATION_REASON.SUSPENDED,
    });
    expect(row.reason).toBe("not_marketplace");
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(offer.save).not.toHaveBeenCalled();
    expect(releaseMarketplaceHoldForOffer).not.toHaveBeenCalled();
  });
});

function findWithLimit(docs) {
  return {
    limit: jest.fn((n) => Promise.resolve(docs.slice(0, Number(n) || 0))),
  };
}

describe("retryMarketplaceCheckoutInvalidations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendCustomerPaymentLinkUnavailableEmail.mockResolvedValue({
      ok: true,
      deduped: false,
    });
    stripeRetrieve.mockResolvedValue({
      id: "cs_open",
      status: "open",
      payment_status: "unpaid",
    });
    stripeExpire.mockResolvedValue({ status: "expired" });
  });

  test("11. Retry endpoint processes bounded batches", async () => {
    const orders = Array.from({ length: 3 }, (_, i) =>
      unpaidOrder({
        _id: `order-${i}`,
        payment: {
          status: "pending",
          provider: "stripe",
          providerPaymentId: "cs_open",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_open",
          complianceInvalidateRetry: true,
        },
      })
    );
    const finder = findWithLimit(orders);
    Order.find.mockReturnValue(finder);
    AlternativeVehicleOffer.find.mockReturnValue(findWithLimit([]));
    const result = await retryMarketplaceCheckoutInvalidations({ limit: 2 });
    expect(finder.limit).toHaveBeenCalledWith(2);
    expect(result.processed).toBe(2);
    expect(result.processed).toBeLessThanOrEqual(CHECKOUT_INVALIDATION_RETRY.BATCH_MAX);
  });

  test("12. One failed item does not stop the batch", async () => {
    const okOrder = unpaidOrder({ _id: "ok-order" });
    okOrder.payment.complianceInvalidateRetry = true;
    const failOrder = unpaidOrder({ _id: "fail-order" });
    failOrder.payment.complianceInvalidateRetry = true;
    failOrder.payment.providerPaymentId = "cs_fail";
    stripeRetrieve.mockImplementation(async (id) => {
      if (id === "cs_fail") throw new Error("stripe network down");
      return { id, status: "open", payment_status: "unpaid" };
    });
    Order.find.mockReturnValue(findWithLimit([failOrder, okOrder]));
    AlternativeVehicleOffer.find.mockReturnValue(findWithLimit([]));
    const result = await retryMarketplaceCheckoutInvalidations({ limit: 10 });
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.invalidated).toBe(1);
    expect(okOrder.payment.status).toBe("expired");
  });

  test("13. Paid session is skipped during retry", async () => {
    const order = unpaidOrder();
    order.payment.complianceInvalidateRetry = true;
    stripeRetrieve.mockResolvedValue({
      id: "cs_open",
      status: "complete",
      payment_status: "paid",
    });
    Order.find.mockReturnValue(findWithLimit([order]));
    AlternativeVehicleOffer.find.mockReturnValue(findWithLimit([]));
    const result = await retryMarketplaceCheckoutInvalidations({ limit: 10 });
    expect(result.skippedPaid).toBe(1);
    expect(stripeExpire).not.toHaveBeenCalled();
    expect(order.bookingStatus).toBe(BOOKING_STATUS.PAYMENT_PROCESSING);
    expect(order.payment.complianceInvalidateRetry).toBe(false);
  });

  test("14. Successful retry clears retry marker", async () => {
    const order = unpaidOrder();
    order.payment.complianceInvalidateRetry = true;
    order.payment.complianceInvalidateAttempts = 2;
    Order.find.mockReturnValue(findWithLimit([order]));
    AlternativeVehicleOffer.find.mockReturnValue(findWithLimit([]));
    await retryMarketplaceCheckoutInvalidations({ limit: 10 });
    expect(order.payment.complianceInvalidateRetry).toBe(false);
    expect(order.payment.status).toBe("expired");
  });

  test("15. Repeated retry is idempotent", async () => {
    const order = unpaidOrder();
    order.payment.complianceInvalidateRetry = true;
    Order.find.mockReturnValue(findWithLimit([order]));
    AlternativeVehicleOffer.find.mockReturnValue(findWithLimit([]));
    await retryMarketplaceCheckoutInvalidations({ limit: 10 });
    stripeExpire.mockClear();
    order.save.mockClear();
    Order.find.mockReturnValue(findWithLimit([order]));
    const second = await retryMarketplaceCheckoutInvalidations({ limit: 10 });
    expect(second.invalidated).toBe(0);
    expect(stripeExpire).not.toHaveBeenCalled();
  });
});
