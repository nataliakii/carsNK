/**
 * @jest-environment node
 */

process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

jest.mock("@lib/adminAuth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@models/user", () => ({ ROLE: { ADMIN: 0, SUPERADMIN: 1 } }));
jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: { url: jest.fn(() => "https://res.cloudinary.com/demo/signed?sig=abc") },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordDrivingLicenceAccess: jest.fn(async () => true),
  recordDrivingLicenceAccessDenied: jest.fn(async () => true),
  extractAuditContext: jest.fn(() => ({ ipAddress: "203.0.113.5", userAgent: "jest" })),
}));

import { requireAdmin } from "@lib/adminAuth";
import { Order } from "@models/order";
import {
  recordDrivingLicenceAccess,
  recordDrivingLicenceAccessDenied,
} from "@/domain/legal/auditTrail";
import { GET } from "../route";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";
const ORDER_ID = "64a0000000000000000000aa";
const REFERENCE = "carsnk/orders/licence-intake/2026-06/abc123";

function order(overrides = {}) {
  return {
    _id: ORDER_ID,
    ownerId: COMPANY,
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    confirmed: false,
    payment: { status: "pending" },
    returnAtUtc: new Date(Date.now() + 5 * 24 * 3600 * 1000),
    drivingLicenceUrls: [],
    drivingLicenceSnapshot: {
      storageReference: REFERENCE,
      storageType: "authenticated",
      checksum: "f".repeat(64),
      uploadedAt: new Date("2026-06-01T09:00:00Z"),
      holderName: "Ana Lopez",
      licenceNumber: "ES1234567",
      issuingCountry: "ES",
      expiryDate: new Date("2030-01-31T00:00:00Z"),
      issueDate: new Date("2015-03-02T00:00:00Z"),
      verificationStatus: "PENDING",
    },
    ...overrides,
  };
}

function session({ role = 0, ownerId = COMPANY } = {}) {
  return {
    session: { user: { isAdmin: true, role, ownerId, id: "u1", email: "a@b.c" } },
    errorResponse: null,
  };
}

function mockOrder(doc) {
  Order.findById.mockReturnValue({
    select: jest.fn(() => ({ lean: jest.fn(async () => doc) })),
  });
}

async function call() {
  const request = new Request(
    `https://rovaro.autos/api/admin/orders/${ORDER_ID}/driving-licence`
  );
  request.nextUrl = new URL(request.url);
  const res = await GET(request, { params: { orderId: ORDER_ID } });
  return { res, body: await res.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdmin.mockResolvedValue(session());
  mockOrder(order());
});

describe("company admin before the verified Stripe payment", () => {
  it("cannot reach the document and is told why", async () => {
    const { res, body } = await call();
    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.code).toBe("not_yet_lawful");
    expect(body.documents).toBeUndefined();
    expect(body.capturedDocument).toBeUndefined();
    expect(body.licence).toBeUndefined();
  });

  it("leaks no licence data in the refusal payload", async () => {
    const { body } = await call();
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("Ana Lopez");
    expect(serialised).not.toContain("ES1234567");
    expect(serialised).not.toContain(REFERENCE);
  });

  it("is refused even when a Booking Fee checkout session merely exists", async () => {
    mockOrder(
      order({ payment: { status: "pending", checkoutSessionId: "cs_test_123" } })
    );
    const { res } = await call();
    expect(res.status).toBe(403);
  });

  it("is refused even when the booking is confirmed but unpaid", async () => {
    mockOrder(order({ confirmed: true, payment: { status: "pending" } }));
    const { res } = await call();
    expect(res.status).toBe(403);
  });

  it("records the refused attempt", async () => {
    await call();
    expect(recordDrivingLicenceAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        userRole: "admin",
        reason: "not_yet_lawful",
      })
    );
    expect(recordDrivingLicenceAccess).not.toHaveBeenCalled();
  });
});

describe("company admin after the verified Stripe payment", () => {
  beforeEach(() => {
    mockOrder(order({ payment: { status: "paid" }, confirmed: true }));
  });

  it("may read the licence", async () => {
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.licence.holderName).toBe("Ana Lopez");
    expect(body.capturedDocument.grant).toBeTruthy();
  });

  it("never receives the storage reference or a delivery URL", async () => {
    const { body } = await call();
    const serialised = JSON.stringify(body);
    expect(body.licence.storageReference).toBeUndefined();
    expect(body.licence.storageType).toBeUndefined();
    expect(serialised).not.toContain(REFERENCE);
    expect(serialised).not.toContain("res.cloudinary.com");
  });

  it("gets a grant that expires shortly", async () => {
    const { body } = await call();
    const expiresAt = new Date(body.capturedDocument.expiresAt).getTime();
    expect(body.capturedDocument.ttlSeconds).toBeLessThanOrEqual(300);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(300 * 1000);
  });
});

describe("a different company", () => {
  it("gets a generic not-found rather than a 403 confirming the booking", async () => {
    requireAdmin.mockResolvedValue(session({ ownerId: OTHER_COMPANY }));
    mockOrder(order({ payment: { status: "paid" }, confirmed: true }));

    const { res, body } = await call();
    expect(res.status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(body.message).toBe("Booking not found");
    expect(JSON.stringify(body)).not.toContain("Ana Lopez");
  });

  it("gets the identical answer for a booking that does not exist", async () => {
    requireAdmin.mockResolvedValue(session({ ownerId: OTHER_COMPANY }));
    mockOrder(order({ payment: { status: "paid" } }));
    const existing = await call();

    mockOrder(null);
    const missing = await call();

    expect(existing.res.status).toBe(missing.res.status);
    expect(existing.body).toEqual(missing.body);
  });

  it("has the refusal audited", async () => {
    requireAdmin.mockResolvedValue(session({ ownerId: OTHER_COMPANY }));
    await call();
    expect(recordDrivingLicenceAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, reason: "not_found" })
    );
  });
});

describe("superadmin", () => {
  beforeEach(() => {
    requireAdmin.mockResolvedValue(session({ role: 1, ownerId: null }));
  });

  it("may read the licence before payment for support and security review", async () => {
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body.licence.holderName).toBe("Ana Lopez");
    expect(body.capturedDocument.grant).toBeTruthy();
  });

  it("still does not receive the storage reference", async () => {
    const { body } = await call();
    expect(body.licence.storageReference).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(REFERENCE);
  });
});

describe("auditing an allowed access", () => {
  beforeEach(() => {
    mockOrder(order({ payment: { status: "paid" }, confirmed: true }));
  });

  it("records actor, order, outcome and the storage reference only", async () => {
    await call();
    expect(recordDrivingLicenceAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        userId: "u1",
        userEmail: "a@b.c",
        userRole: "admin",
        mode: "view",
        assetRef: REFERENCE,
        result: "success",
      })
    );
  });

  it("logs neither the signed URL nor the download grant", async () => {
    const { body } = await call();
    const logged = JSON.stringify(recordDrivingLicenceAccess.mock.calls[0][0]);
    expect(logged).not.toContain("res.cloudinary.com");
    expect(logged).not.toContain("sig=abc");
    expect(logged).not.toContain(body.capturedDocument.grant);
  });
});

describe("orders with no licence", () => {
  it("answers with an empty, non-crashing payload for a legacy order", async () => {
    mockOrder(
      order({
        payment: { status: "paid" },
        confirmed: true,
        drivingLicenceSnapshot: undefined,
        drivingLicenceUrls: [],
      })
    );
    const { res, body } = await call();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.documents).toEqual([]);
    expect(body.licence).toBeNull();
  });
});
