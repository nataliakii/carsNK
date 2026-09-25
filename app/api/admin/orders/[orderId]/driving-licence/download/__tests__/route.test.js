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
  default: {
    url: jest.fn(() => "https://res.cloudinary.com/demo/authenticated/signed?sig=xyz"),
  },
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
import {
  DOWNLOAD_GRANT_TTL_SECONDS,
  createDownloadGrant,
} from "@/domain/legal/drivingLicenceDownloadGrant";
import { POST } from "../route";

const COMPANY = "64a000000000000000000001";
const OTHER_COMPANY = "64a000000000000000000002";
const ORDER_ID = "64a0000000000000000000aa";
const OTHER_ORDER_ID = "64a0000000000000000000bb";
const REFERENCE = "carsnk/orders/licence-intake/2026-06/abc123";
const DOCUMENT_BYTES = "licence-image-bytes";

function order(overrides = {}) {
  return {
    _id: ORDER_ID,
    ownerId: COMPANY,
    my_order: true,
    source: "PLATFORM",
    bookingMode: "MARKETPLACE_REQUEST",
    confirmed: true,
    payment: { status: "paid" },
    returnAtUtc: new Date(Date.now() + 5 * 24 * 3600 * 1000),
    drivingLicenceSnapshot: {
      storageReference: REFERENCE,
      storageType: "authenticated",
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

function validGrant(overrides = {}) {
  return createDownloadGrant({
    orderId: ORDER_ID,
    storageReference: REFERENCE,
    storageType: "authenticated",
    resourceType: "image",
    ...overrides,
  }).grant;
}

async function call(grant, { orderId = ORDER_ID } = {}) {
  const request = new Request(
    `https://rovaro.autos/api/admin/orders/${orderId}/driving-licence/download`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant }),
    }
  );
  return POST(request, { params: { orderId } });
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAdmin.mockResolvedValue(session());
  mockOrder(order());
  global.fetch = jest.fn(async () => new Response(DOCUMENT_BYTES, { status: 200 }));
});

describe("serving the document", () => {
  it("streams the bytes to an authorised company admin after payment", async () => {
    const res = await call(validGrant());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(DOCUMENT_BYTES);
  });

  it("returns no storage reference or signed URL in the response headers", async () => {
    const res = await call(validGrant());
    const headers = JSON.stringify([...res.headers.entries()]);
    expect(headers).not.toContain(REFERENCE);
    expect(headers).not.toContain("res.cloudinary.com");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("audits the download with the storage reference but not the signed URL", async () => {
    await call(validGrant());
    expect(recordDrivingLicenceAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        mode: "download",
        assetRef: REFERENCE,
        result: "success",
      })
    );
    const logged = JSON.stringify(recordDrivingLicenceAccess.mock.calls[0][0]);
    expect(logged).not.toContain("res.cloudinary.com");
    expect(logged).not.toContain("sig=xyz");
  });
});

describe("an expired link", () => {
  it("stops serving the document once the grant lapses", async () => {
    const stale = createDownloadGrant({
      orderId: ORDER_ID,
      storageReference: REFERENCE,
      now: new Date(Date.now() - (DOWNLOAD_GRANT_TTL_SECONDS + 60) * 1000),
    }).grant;

    const res = await call(stale);
    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(recordDrivingLicenceAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "GRANT_EXPIRED", mode: "download" })
    );
  });
});

describe("authorisation is decided again, not inherited from the grant", () => {
  it("refuses a company admin whose booking is no longer paid", async () => {
    mockOrder(order({ payment: { status: "pending" }, confirmed: false }));
    const res = await call(validGrant());
    expect(res.status).toBe(404);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses another company with a generic not-found", async () => {
    requireAdmin.mockResolvedValue(session({ ownerId: OTHER_COMPANY }));
    const res = await call(validGrant());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("not_found");
    expect(JSON.stringify(body)).not.toContain(REFERENCE);
  });

  it("lets superadmin download before payment", async () => {
    requireAdmin.mockResolvedValue(session({ role: 1, ownerId: null }));
    mockOrder(order({ payment: { status: "pending" }, confirmed: false }));
    const res = await call(validGrant());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(DOCUMENT_BYTES);
  });

  it("rejects an unauthenticated caller before touching the database", async () => {
    requireAdmin.mockResolvedValue({
      session: null,
      errorResponse: new Response("{}", { status: 401 }),
    });
    const res = await call(validGrant());
    expect(res.status).toBe(401);
    expect(Order.findById).not.toHaveBeenCalled();
  });
});

describe("a grant cannot be pointed somewhere else", () => {
  it("refuses a grant minted for a different order", async () => {
    const res = await call(validGrant({ orderId: OTHER_ORDER_ID }));
    expect(res.status).toBe(404);
    expect(recordDrivingLicenceAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "grant_order_mismatch" })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses a grant naming a document the order does not have", async () => {
    const res = await call(
      validGrant({ storageReference: "carsnk/orders/someone-else" })
    );
    expect(res.status).toBe(404);
    expect(recordDrivingLicenceAccessDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "document_reference_mismatch" })
    );
  });

  it("refuses a missing, forged or malformed grant", async () => {
    for (const value of ["", "nonsense", "g1.aaa.bbb"]) {
      jest.clearAllMocks();
      requireAdmin.mockResolvedValue(session());
      mockOrder(order());
      const res = await call(value);
      expect(res.status).toBe(404);
      expect(recordDrivingLicenceAccessDenied).toHaveBeenCalled();
    }
  });
});
