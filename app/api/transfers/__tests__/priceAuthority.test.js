/**
 * @jest-environment node
 *
 * A public POST used to be able to name its own price: omitUntrustedTransferMetrics
 * stripped the client distance and quote but left adminPriceOverrideMinor,
 * adminOverrideReason and createdByAdmin in the body, and createTransferOrder
 * honoured them. Nothing but this public route calls createTransferOrder, so the
 * override branch was reachable only by an attacker.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({
  sendTelegramDirect: jest.fn(async () => undefined),
}));
jest.mock("@/domain/transfers/notifyTransferEmails", () => ({
  notifyTransferEmails: jest.fn(async () => undefined),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(async () => null),
  transferRateLimitOptions: jest.fn(() => ({ tableName: "transferRateLimit" })),
}));
jest.mock("@models/Transfer", () => {
  const actual = jest.requireActual("@models/Transfer");
  return { ...actual, __esModule: true, default: { create: jest.fn() } };
});
jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({ select: () => ({ lean: async () => null }) })),
  },
}));

const SERVER_PRICE_MINOR = 9900;
const SERVER_PAYOUT_MINOR = 8000;

jest.mock("@/domain/transfers/pricingEngine", () => ({
  calculateTransferQuote: jest.fn(async () => ({
    ok: true,
    quote: {
      customerPriceMinor: 9900,
      supplierPayoutMinor: 8000,
      platformMarginMinor: 1900,
      paymentProcessingAmountMinor: 0,
      currency: "EUR",
      pricingMethod: "DISTANCE_FORMULA",
      isProvisional: false,
    },
    route: { distanceKm: 30, durationMinutes: 35 },
    vehicleCategory: "STANDARD",
  })),
}));

import Transfer from "@models/Transfer";
import { createTransferOrder } from "@/domain/transfers/createTransferOrder";
import { adminOverrideFromTrustedBody } from "@/domain/transfers/transferPayloadPolicy";
import { POST } from "../route";

function transferRequest(body) {
  return new Request("https://carsnk.gr/api/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides = {}) {
  return {
    from: "Thessaloniki Airport",
    to: "Kriopigi",
    datetime: "2030-06-01T10:00",
    adults: 2,
    email: "traveller@example.com",
    customerName: "A Traveller",
    ...overrides,
  };
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
  Transfer.create.mockImplementation(async (doc) => ({
    ...doc,
    _id: { toString: () => "transfer-1" },
    toObject: () => doc,
  }));
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

describe("POST /api/transfers cannot be talked into a price", () => {
  test("a submitted price override is ignored and the server price is stored", async () => {
    const res = await POST(
      transferRequest(
        validBody({
          adminPriceOverrideMinor: 1,
          adminOverrideReason: "I would like to pay one cent",
          adminSupplierPayoutMinor: 99999999,
        })
      )
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.quoteSnapshot.customerPriceMinor).toBe(SERVER_PRICE_MINOR);
    expect(saved.quoteSnapshot.supplierPayoutMinor).toBe(SERVER_PAYOUT_MINOR);
    expect(saved.quoteSnapshot.adminOverrideReason).toBeUndefined();
    expect(body.quote.customerPriceMinor).toBe(SERVER_PRICE_MINOR);
  });

  test("the created record is never stamped as admin-created", async () => {
    await POST(transferRequest(validBody({ createdByAdmin: true })));

    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.statusEvents[0].actor).toBe("customer");
  });

  test("a submitted status, owner, commission or payment state is ignored", async () => {
    await POST(
      transferRequest(
        validBody({
          status: "PAID",
          assignedSupplierId: "507f1f77bcf86cd799439011",
          claimedByCompanyId: "507f1f77bcf86cd799439011",
          claimedByEmail: "attacker@example.com",
          platformCommissionPercent: 0,
          internalNotes: "injected",
          payment: { status: "paid", amountMinor: 0, method: "online_full" },
          eligibleSupplierIds: ["507f1f77bcf86cd799439011"],
          linkedOrderId: "507f1f77bcf86cd799439011",
        })
      )
    );

    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.status).toBe("OPEN_FOR_CLAIM");
    expect(saved.assignedSupplierId).toBeUndefined();
    expect(saved.claimedByCompanyId).toBeUndefined();
    expect(saved.claimedByEmail).toBeUndefined();
    expect(saved.internalNotes).toBeUndefined();
    expect(saved.eligibleSupplierIds).toBeUndefined();
    expect(saved.linkedOrderId).toBeUndefined();
    expect(saved.platformCommissionPercent).toBeGreaterThan(0);
    expect(saved.payment).toEqual({
      method: "pay_after_claim",
      status: "not_required",
      currency: "EUR",
    });
  });

  test("a submitted quote snapshot, discount or currency is ignored", async () => {
    await POST(
      transferRequest(
        validBody({
          quoteSnapshot: { customerPriceMinor: 1, appliedDiscounts: [{ amountMinor: 9900 }] },
          customerPriceMinor: 1,
          supplierPayoutMinor: 99999999,
          appliedDiscounts: [{ amountMinor: 9900 }],
          currency: "XXX",
          distanceKm: 1,
        })
      )
    );

    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.quoteSnapshot.customerPriceMinor).toBe(SERVER_PRICE_MINOR);
    expect(saved.quoteSnapshot.appliedDiscounts).toBeUndefined();
    expect(saved.distanceKm).toBe(30);
    expect(saved.payment.currency).toBe("EUR");
  });

  test("an unbounded stop list is refused rather than priced", async () => {
    const res = await POST(
      transferRequest(
        validBody({
          additionalStops: Array.from({ length: 200 }, () => ({
            notes: "stop",
          })),
        })
      )
    );

    expect(res.status).toBe(400);
    expect(Transfer.create).not.toHaveBeenCalled();
  });
});

describe("the admin override still works when authority is proven", () => {
  test("a trusted admin context applies the override and its reason", async () => {
    const adminBody = {
      adminPriceOverrideMinor: 7500,
      adminSupplierPayoutMinor: 6000,
      adminOverrideReason: "Agreed with the partner by phone",
    };

    const result = await createTransferOrder(validBody(), {
      marketCountry: "GR",
      actor: "admin",
      adminOverride: adminOverrideFromTrustedBody(adminBody),
    });

    expect(result.ok).toBe(true);
    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.quoteSnapshot.customerPriceMinor).toBe(7500);
    expect(saved.quoteSnapshot.supplierPayoutMinor).toBe(6000);
    expect(saved.quoteSnapshot.platformMarginMinor).toBe(1500);
    expect(saved.quoteSnapshot.adminOverrideReason).toBe(
      "Agreed with the partner by phone"
    );
    expect(saved.quoteSnapshot.isProvisional).toBe(false);
    expect(saved.statusEvents[0].actor).toBe("admin");
  });

  test("an override without an admin actor is ignored, even in a direct call", async () => {
    const result = await createTransferOrder(validBody(), {
      marketCountry: "GR",
      adminOverride: {
        customerPriceMinor: 1,
        supplierPayoutMinor: 0,
        reason: "no actor",
      },
    });

    expect(result.ok).toBe(true);
    const saved = Transfer.create.mock.calls[0][0];
    expect(saved.quoteSnapshot.customerPriceMinor).toBe(SERVER_PRICE_MINOR);
    expect(saved.statusEvents[0].actor).toBe("customer");
  });

  test("an admin override with no reason leaves the server price alone", async () => {
    const result = await createTransferOrder(validBody(), {
      marketCountry: "GR",
      actor: "admin",
      adminOverride: adminOverrideFromTrustedBody({
        adminPriceOverrideMinor: 1,
      }),
    });

    expect(result.ok).toBe(true);
    expect(
      Transfer.create.mock.calls[0][0].quoteSnapshot.customerPriceMinor
    ).toBe(SERVER_PRICE_MINOR);
  });
});
