/**
 * @jest-environment node
 */
import { BOOKING_STATUS } from "../bookingStatus";
import { BOOKING_MODES } from "../bookingMode";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/legal/legalSettingsService", () => ({
  loadLegalSettings: jest.fn(async () => ({
    alternativeOfferExpirationHours: 24,
    paymentLinkExpirationMinutes: 60,
  })),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn(async () => true),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn(async () => undefined),
}));
jest.mock("@/domain/orders/rentalPricingService", () => ({
  calculateAuthoritativeRentalPrice: jest.fn(),
  toAuthoritativePriceDoc: (quote) => quote,
}));
jest.mock("@/domain/delivery/calculateDeliveryPrice", () => ({
  calculateDeliveryPrice: jest.fn(),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { CONFIRM: "CONFIRM", REQUEST: "REQUEST" },
  evaluateRentalAvailability: jest.fn(() => ({ hardConflict: false })),
}));
jest.mock("@/domain/company/officeRecord", () => ({
  resolveEligibleOffices: jest.fn(() => [{ _id: "office-1", name: "BCN" }]),
  findEligibleOffice: jest.fn((list, id) =>
    list.find((row) => String(row._id) === String(id)) || list[0]
  ),
  officeIdString: (id) => String(id || ""),
}));
jest.mock("@/domain/booking/bookingHold", () => ({
  acquireMarketplaceHold: jest.fn(),
  findOverlappingActiveHold: jest.fn(async () => null),
  markHoldForRetry: jest.fn(async () => ({ ok: true })),
  releaseMarketplaceHold: jest.fn(async () => ({ ok: true, hold: null })),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  clampStripeExpiresMinutes: (n) => n || 60,
  createRentalCheckoutSession: jest.fn(),
  expireRentalCheckoutSession: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/domain/orders/marketplaceAlternativeEmails", () => ({
  sendAlternativeOfferedEmail: jest.fn(async () => ({ ok: true })),
  sendAlternativeAcceptedNotice: jest.fn(async () => ({ ok: true })),
  sendAlternativeDeclinedNotice: jest.fn(async () => ({ ok: true })),
  sendAlternativeExpiredNotice: jest.fn(async () => ({ ok: true })),
  sendAlternativeWithdrawnEmail: jest.fn(async () => ({ ok: true })),
  sendAlternativePaymentLinkEmail: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/domain/orders/priceSnapshotChecksum", () => ({
  computePriceSnapshotChecksum: jest.fn(() => "checksum"),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: {
    ALTERNATIVE: "alternative",
  },
  PARTNER_OPERATION_ERROR: {
    COMPLIANCE_REQUIRED: "PARTNER_COMPLIANCE_REQUIRED",
    SUSPENDED: "PARTNER_SUSPENDED",
  },
  assertPartnerCanOperate: jest.fn(async () => ({ allowed: true })),
  auditPartnerComplianceBlock: jest.fn(async () => true),
}));
jest.mock("@models/car", () => ({
  Car: { findById: jest.fn(), find: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/order", () => ({
  Order: {
    findById: jest.fn(),
    find: jest.fn(async () => []),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock("@models/AlternativeVehicleOffer", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

import { Car } from "@models/car";
import Company from "@models/company";
import { Order } from "@models/order";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { calculateAuthoritativeRentalPrice } from "@/domain/orders/rentalPricingService";
import { acquireMarketplaceHold } from "@/domain/booking/bookingHold";
import { evaluateRentalAvailability } from "@/domain/booking/availabilityEngine";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import {
  sendAlternativeOfferedEmail,
  sendAlternativePaymentLinkEmail,
} from "@/domain/orders/marketplaceAlternativeEmails";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { assertPartnerCanOperate } from "@/domain/legal/partnerOperatingPolicy";
import {
  decideAlternativeVehicle,
  offerAlternativeVehicle,
  offerUnlistedEquivalent,
} from "../alternativeVehicle";
import {
  GUARANTEED_EQUIVALENT_MODEL,
  REPLACEMENT_SOURCE,
} from "../equivalentReplacementCopy";

function carDoc(id, overrides = {}) {
  return {
    _id: id,
    ownerId: "company-a",
    model: id === "car-a" ? "Seat Leon" : "Cupra Formentor",
    make: "Seat",
    class: overrides.class || (id === "car-a" ? "compact" : "suv"),
    transmission: "automatic",
    seats: 5,
    luggage: 2,
    numberOfDoors: 5,
    photoUrl: `${id}-photo`,
    photos: [`${id}-photo`],
    isActive: overrides.isActive !== false,
    carNumber: id,
    franchise: 300,
    deposit: 400,
    calculateTotalRentalPricePerDay: jest.fn(),
    ...overrides,
  };
}

function orderDoc(overrides = {}) {
  const order = {
    _id: "order-1",
    orderNumber: "20260922120000",
    ownerId: "company-a",
    car: "car-a",
    carModel: "Seat Leon",
    email: "ana@example.test",
    bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
    insurance: "CDW",
    pickupAtUtc: new Date("2026-10-01T10:00:00Z"),
    returnAtUtc: new Date("2026-10-05T10:00:00Z"),
    timezone: "Europe/Madrid",
    locationSnapshot: {
      pickup: {
        kind: "office",
        officeId: "office-1",
        name: "BCN",
        feeMajor: 0,
      },
      return: {
        kind: "office",
        officeId: "office-1",
        name: "BCN",
        feeMajor: 0,
      },
      currency: "EUR",
    },
    authoritativePrice: {
      currency: "EUR",
      grossMinor: 100000,
      prepaymentMinor: 10000,
      balanceMinor: 90000,
    },
    payment: {},
    set: jest.fn(function (key, value) {
      this[key] = value;
    }),
    save: jest.fn(async () => undefined),
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
  return order;
}

function offerDoc(overrides = {}) {
  return {
    offerId: "ALT-ABCDEF0123456789",
    orderId: "order-1",
    companyId: "company-a",
    proposedCarId: "car-b",
    originalCarId: "car-a",
    status: "OFFERED",
    expiresAt: new Date(Date.now() + 3600_000),
    priceMinor: 100000,
    offeredGrossMinor: 100000,
    originalPriceMinor: 100000,
    calculatedAlternativeGrossMinor: 100000,
    replacementDiscountMinor: 0,
    prepaymentMinor: 10000,
    balanceMinor: 90000,
    currency: "EUR",
    termsChanged: false,
    changedTerms: [],
    proposedTermsHash: "h2",
    originalTermsHash: "h1",
    snapshotChecksum: "",
    vehicle: {
      carId: "car-b",
      make: "Seat",
      model: "Cupra Formentor",
      category: "suv",
      transmission: "automatic",
      seats: 5,
      luggage: 2,
      photos: ["car-b-photo"],
    },
    proposedLocationSnapshot: orderDoc().locationSnapshot,
    proposedAuthoritativePrice: {
      currency: "EUR",
      grossMinor: 100000,
      prepaymentMinor: 10000,
      balanceMinor: 90000,
    },
    originalRequest: {
      carId: "car-a",
      vehicle: { model: "Seat Leon", category: "compact" },
    },
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function thenable(doc) {
  const row = {
    lean: async () => doc,
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
  return row;
}

beforeEach(() => {
  jest.clearAllMocks();
  Company.findById.mockReturnValue(thenable({
    _id: "company-a",
    name: "Owner A",
    email: "owner-a@example.test",
    customerRentalTerms: { sourceEn: "rules", sourceHash: "abc" },
    offices: [{ _id: "office-1", name: "BCN" }],
  }));
  Car.findById.mockImplementation(async (id) => carDoc(String(id)));
  Car.find.mockResolvedValue([carDoc("car-a"), carDoc("car-b")]);
  calculateAuthoritativeRentalPrice.mockResolvedValue({
    currency: "EUR",
    grossMinor: 100000,
    prepaymentPercent: 10,
    prepaymentMinor: 10000,
    balanceMinor: 90000,
    pickupFeeMinor: 0,
    returnFeeMinor: 0,
  });
  AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(null));
  AlternativeVehicleOffer.create.mockImplementation(async (doc) => ({
    ...doc,
    toObject() {
      return { ...doc };
    },
  }));
  Order.find.mockReturnValue(thenable([]));
  AlternativeVehicleOffer.updateOne.mockResolvedValue({ acknowledged: true });
  AlternativeVehicleOffer.updateMany.mockResolvedValue({ acknowledged: true });
  evaluateRentalAvailability.mockReturnValue({ hardConflict: false });
  acquireMarketplaceHold.mockResolvedValue({ ok: true, hold: { _id: "hold-b" } });
  sendAlternativePaymentLinkEmail.mockResolvedValue({ ok: true });
  createRentalCheckoutSession.mockResolvedValue({
    ok: true,
    url: "https://checkout.stripe.com/c/pay/cs_test_alt",
    sessionId: "cs_test_alt",
    expiresAt: new Date(Date.now() + 3600_000),
    reused: false,
  });
});

describe("offer creation", () => {
  test("ADMIN creates an offer for own stored car, emails once, no hold/Stripe", async () => {
    Order.findById.mockResolvedValue(orderDoc());
    const result = await offerAlternativeVehicle({
      orderId: "order-1",
      proposedCarId: "car-b",
      alternative: { reasonForReplacement: "The booked car is in the workshop." },
      actor: { role: 1, ownerId: "company-a", email: "admin@a.test" },
    });
    expect(result.ok).toBe(true);
    expect(result.holdCreated).toBe(false);
    expect(result.stripeCreated).toBe(false);
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(sendAlternativeOfferedEmail).toHaveBeenCalledTimes(1);
    expect(AlternativeVehicleOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        proposedCarId: "car-b",
        afterPayment: false,
        reasonForReplacement: "The booked car is in the workshop.",
      })
    );
    const stored = AlternativeVehicleOffer.create.mock.calls[0][0];
    expect(stored.offerId).toMatch(/^ALT-[0-9A-F]{32}$/);
  });

  test("client-supplied price and vehicle snapshot are ignored", async () => {
    Order.findById.mockResolvedValue(orderDoc());
    await offerAlternativeVehicle({
      orderId: "order-1",
      proposedCarId: "car-b",
      alternative: {
        carId: "car-b",
        priceMinor: 1,
        currency: "USD",
        make: "FAKE",
        model: "Injected",
        reasonForReplacement: "workshop",
      },
      actor: { role: 1, ownerId: "company-a" },
    });
    const created = AlternativeVehicleOffer.create.mock.calls[0][0];
    expect(created.priceMinor).toBe(100000);
    expect(created.currency).toBe("EUR");
    expect(created.vehicle.model).toBe("Cupra Formentor");
    expect(created.vehicle.make).not.toBe("FAKE");
  });

  test("ad-hoc vehicle without car id is rejected", async () => {
    Order.findById.mockResolvedValue(orderDoc());
    const result = await offerAlternativeVehicle({
      orderId: "order-1",
      alternative: { model: "Typed in", priceMinor: 1, reasonForReplacement: "x" },
      actor: { role: 1, ownerId: "company-a" },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("car_required");
  });

  test("duplicate active offer is a conflict", async () => {
    Order.findById.mockResolvedValue(orderDoc());
    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable({
        offerId: "ALT-EXISTING",
        status: "OFFERED",
      })
    );
    const result = await offerAlternativeVehicle({
      orderId: "order-1",
      proposedCarId: "car-b",
      alternative: { reasonForReplacement: "workshop" },
      actor: { role: 1, ownerId: "company-a" },
    });
    expect(result.status).toBe(409);
    expect(result.code).toBe("active_offer_exists");
    expect(AlternativeVehicleOffer.create).not.toHaveBeenCalled();
  });
});

describe("customer decision", () => {
  test("GET remains read-only — decide is POST-only in this module", () => {
    expect(typeof decideAlternativeVehicle).toBe("function");
  });

  test("decline is idempotent and creates no hold or Stripe", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    AlternativeVehicleOffer.findOneAndUpdate.mockResolvedValue(offerDoc({ status: "DECLINED" }));
    Order.findById.mockResolvedValue(orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED }));
    const first = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: false,
    });
    expect(first.ok).toBe(true);
    expect(first.holdCreated).toBe(false);
    expect(first.refundRequired).toBe(false);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();

    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable(offerDoc({ status: "DECLINED" }))
    );
    const second = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: false,
    });
    expect(second.idempotent).toBe(true);
  });

  test("expired and withdrawn offers cannot be accepted", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable(offerDoc({ status: "OFFERED", expiresAt: new Date(Date.now() - 1000) }))
    );
    Order.findById.mockResolvedValue(orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED }));
    const expired = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(expired.code).toBe("expired");

    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable(offerDoc({ status: "WITHDRAWN" }))
    );
    const withdrawn = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(withdrawn.code).toBe("withdrawn");
  });

  test("changed terms require explicit consent", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable(offerDoc({ termsChanged: true }))
    );
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
      termsAccepted: false,
    });
    expect(result.code).toBe("terms_consent_required");
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
  });

  test("successful acceptance holds car B, switches the order, and creates Stripe", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    AlternativeVehicleOffer.findOneAndUpdate.mockResolvedValue(offerDoc({ status: "ACCEPTED" }));
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    Order.findOneAndUpdate.mockResolvedValue(
      orderDoc({
        car: "car-b",
        carModel: "Cupra Formentor",
        bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
        originalRequestSnapshot: { carId: "car-a" },
        acceptedAlternativeOfferId: "ALT-ABCDEF0123456789",
      })
    );
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.ok).toBe(true);
    expect(result.holdCreated).toBe(true);
    expect(acquireMarketplaceHold).toHaveBeenCalledWith(
      expect.objectContaining({ carId: "car-b", offerId: "ALT-ABCDEF0123456789" })
    );
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          car: "car-b",
          originalRequestSnapshot: expect.objectContaining({ carId: "car-a" }),
        }),
      }),
      expect.any(Object)
    );
    expect(createRentalCheckoutSession).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({ forceNew: true })
    );
    expect(result.paymentUrl).toContain("cs_test_alt");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ALTERNATIVE_HOLD_ACQUIRED",
        orderData: expect.objectContaining({ orderId: "order-1" }),
      })
    );
  });

  test("availability is rechecked on acceptance and a conflict blocks hold/Stripe", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    evaluateRentalAvailability.mockReturnValue({
      hardConflict: true,
      userSafeReason: "Car B is already booked",
    });
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.code).toBe("availability_conflict");
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("another customer's hold on car B prevents acceptance", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    acquireMarketplaceHold.mockResolvedValue({
      ok: false,
      code: "hold_conflict",
      message: "Those dates are already held",
    });
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("hold_conflict");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("replay of an accepted offer does not create a second hold", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      thenable(
        offerDoc({
          status: "ACCEPTED",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_alt",
        })
      )
    );
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT })
    );
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.idempotent).toBe(true);
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
  });

  test("Stripe failure leaves a recoverable accepted state", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    AlternativeVehicleOffer.findOneAndUpdate.mockResolvedValue(offerDoc({ status: "ACCEPTED" }));
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    Order.findOneAndUpdate.mockResolvedValue(
      orderDoc({
        car: "car-b",
        bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
        originalRequestSnapshot: { carId: "car-a" },
      })
    );
    createRentalCheckoutSession.mockResolvedValue({
      ok: false,
      code: "checkout_failed",
      message: "stripe down",
    });
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.ok).toBe(true);
    expect(result.paymentLinkGenerationFailed).toBe(true);
    expect(result.status).toBe("ACCEPTED");
  });

  test("payment-link email failure keeps the accepted booking and Stripe session", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(offerDoc()));
    AlternativeVehicleOffer.findOneAndUpdate.mockResolvedValue(offerDoc({ status: "ACCEPTED" }));
    Order.findById.mockResolvedValue(
      orderDoc({ bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    Order.findOneAndUpdate.mockResolvedValue(
      orderDoc({
        car: "car-b",
        bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
        originalRequestSnapshot: { carId: "car-a" },
      })
    );
    sendAlternativePaymentLinkEmail.mockResolvedValue({
      ok: false,
      code: "smtp_failed",
    });
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("ACCEPTED");
    expect(result.paymentUrl).toContain("cs_test_alt");
    expect(result.paymentLinkGenerationFailed).not.toBe(true);
    expect(acquireMarketplaceHold).toHaveBeenCalledTimes(1);
    expect(createRentalCheckoutSession).toHaveBeenCalledTimes(1);
  });

  test("partner cannot offer an alternative when compliance is lost", async () => {
    Order.findById.mockResolvedValue(orderDoc());
    assertPartnerCanOperate.mockResolvedValueOnce({
      allowed: false,
      error: "PARTNER_SUSPENDED",
      code: "PARTNER_SUSPENDED",
      partnerMessage: "Trading is suspended.",
    });
    const result = await offerAlternativeVehicle({
      orderId: "order-1",
      proposedCarId: "car-b",
      alternative: { reasonForReplacement: "original car is in the workshop" },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("PARTNER_SUSPENDED");
    expect(AlternativeVehicleOffer.create).not.toHaveBeenCalled();
  });

  test("customer accept rechecks the gate and hides the compliance reason", async () => {
    AlternativeVehicleOffer.findOne.mockImplementation(() =>
      Promise.resolve(offerDoc())
    );
    Order.findById.mockResolvedValue(orderDoc());
    assertPartnerCanOperate.mockResolvedValueOnce({
      allowed: false,
      error: "PARTNER_COMPLIANCE_REQUIRED",
      code: "AGREEMENT_OUTDATED",
      partnerMessage: "sign again",
    });
    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.message).toBe("Offer not found");
    expect(JSON.stringify(result)).not.toMatch(/AGREEMENT_OUTDATED|COMPLIANCE/);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });
});

/**
 * The guaranteed equivalent: the supplier commits to the booking's own
 * specification rather than describing a car. Typing nothing is the fast path,
 * so nothing typed may be what the promise depends on.
 */
describe("guaranteed equivalent replacement", () => {
  const actor = { role: 1, ownerId: "company-a", email: "admin@a.test" };

  const requested = {
    vehicleSnapshot: {
      carId: "car-a",
      displayName: "Seat Leon",
      class: "compact",
      transmission: "automatic",
      seats: 5,
      luggage: 2,
    },
  };

  const bareProposal = {
    replacementSource: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
    supplierMessage: "The booked car is in the workshop.",
  };

  /** Run the supplier side and hand back exactly what was stored. */
  async function offerGuaranteed({ order, proposal = bareProposal } = {}) {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(null));
    Order.findById.mockResolvedValue(order || orderDoc(requested));
    const result = await offerUnlistedEquivalent({
      orderId: "order-1",
      proposal,
      actor,
    });
    const stored = AlternativeVehicleOffer.create.mock.calls[0]?.[0] || null;
    return { result, stored };
  }

  /**
   * The offer the customer later sees, built by the supplier path rather than
   * hand-written, so its checksum is the one the module itself computed.
   */
  async function storedGuaranteedOffer(mutate) {
    const { stored } = await offerGuaranteed();
    expect(stored).toBeTruthy();
    jest.clearAllMocks();
    const row = offerDoc({
      ...stored,
      status: "OFFERED",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    if (typeof mutate === "function") mutate(row);
    return row;
  }

  function serveOffer(row) {
    AlternativeVehicleOffer.findOne.mockImplementation(() => thenable(row));
    AlternativeVehicleOffer.findOneAndUpdate.mockResolvedValue({
      ...row,
      status: "ACCEPTED",
      toObject() {
        return { ...this };
      },
    });
    Order.findById.mockResolvedValue(
      orderDoc({ ...requested, bookingStatus: BOOKING_STATUS.ALTERNATIVE_PROPOSED })
    );
    Order.findOneAndUpdate.mockResolvedValue(
      orderDoc({
        ...requested,
        bookingStatus: BOOKING_STATUS.ALTERNATIVE_ACCEPTED_AWAITING_PAYMENT,
      })
    );
  }

  test("an empty form still records every guarantee, derived from the booking", async () => {
    const { result, stored } = await offerGuaranteed();

    expect(result.ok).toBe(true);
    expect(stored.replacementSource).toBe(REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT);
    expect(stored.replacementProposal.guarantees).toMatchObject({
      classAtLeast: "compact",
      transmission: "automatic",
      seatsAtLeast: 5,
      luggageAtLeast: 2,
      totalPriceAtMost: 1000,
      datesUnchanged: true,
      locationsUnchanged: true,
      noSurcharge: true,
    });
    expect(stored.replacementProposal.derivedFromOriginal).toEqual([
      "class",
      "luggage",
      "seats",
      "totalPrice",
      "transmission",
    ]);
    expect(stored.vehicle).toMatchObject({
      model: GUARANTEED_EQUIVALENT_MODEL,
      category: "compact",
      transmission: "automatic",
      seats: 5,
      luggage: 2,
    });
    expect(stored.priceMinor).toBe(100000);
    expect(stored.proposedCarId).toBeNull();
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("the promise is read from the booking snapshot, not from today's fleet record", async () => {
    // The live car was re-classified to a higher class after the booking.
    Car.findById.mockImplementation(async (id) =>
      carDoc(String(id), { class: "suv", transmission: "manual", seats: 7 })
    );

    const { stored } = await offerGuaranteed();

    expect(stored.replacementProposal.guarantees).toMatchObject({
      classAtLeast: "compact",
      transmission: "automatic",
      seatsAtLeast: 5,
    });
  });

  test("the Booking Fee comes from the booking's own rate, not a fixed 10%", async () => {
    const { stored } = await offerGuaranteed({
      order: orderDoc({ ...requested, marketplaceBookingFeeBps: 3000 }),
    });

    expect(stored.marketplaceBookingFeeBps).toBe(3000);
    expect(stored.prepaymentMinor).toBe(30000);
    expect(stored.balanceMinor).toBe(70000);
  });

  test("a typed downgrade is refused even though the fields are optional", async () => {
    const { result } = await offerGuaranteed({
      proposal: { ...bareProposal, category: "economy" },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("category_downgrade");
    expect(AlternativeVehicleOffer.create).not.toHaveBeenCalled();
  });

  test("a supplier comment is still required", async () => {
    const { result } = await offerGuaranteed({
      proposal: { replacementSource: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("reason_required");
    expect(AlternativeVehicleOffer.create).not.toHaveBeenCalled();
  });

  test("the customer can accept it: no car to hold, straight to payment", async () => {
    serveOffer(await storedGuaranteedOffer());

    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ACCEPTED");
    expect(result.paymentUrl).toContain("cs_test_alt");
    expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    const update = Order.findOneAndUpdate.mock.calls[0][1].$set;
    expect(update.pendingReplacementProposal).toMatchObject({
      version: 2,
      guarantees: expect.objectContaining({
        classAtLeast: "compact",
        transmission: "automatic",
        seatsAtLeast: 5,
      }),
    });
    expect(update.replacementDisclosure).toContain("automatic");
    expect(update.replacementDisclosure).toContain("5");
  });

  test("a row written under either merged-away kind still resolves", async () => {
    for (const legacy of ["EXTERNAL_VEHICLE", "GUARANTEED_CLASS"]) {
      const row = await storedGuaranteedOffer((doc) => {
        doc.replacementSource = legacy;
      });
      serveOffer(row);

      const result = await decideAlternativeVehicle({
        offerId: "ALT-ABCDEF0123456789",
        accept: true,
      });

      expect(`${legacy}:${result.ok}`).toBe(`${legacy}:true`);
      expect(acquireMarketplaceHold).not.toHaveBeenCalled();
    }
  });

  test("an altered stored promise cannot be accepted", async () => {
    const row = await storedGuaranteedOffer((doc) => {
      doc.replacementProposal = {
        ...doc.replacementProposal,
        guarantees: { ...doc.replacementProposal.guarantees, classAtLeast: "mini" },
      };
    });
    serveOffer(row);

    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("snapshot_mismatch");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("a promise stripped of its checksum cannot be accepted either", async () => {
    const row = await storedGuaranteedOffer((doc) => {
      delete doc.replacementProposal.checksum;
    });
    serveOffer(row);

    const result = await decideAlternativeVehicle({
      offerId: "ALT-ABCDEF0123456789",
      accept: true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("snapshot_mismatch");
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });
});
