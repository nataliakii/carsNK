/**
 * @jest-environment node
 */
import { GET, POST } from "../route";
import { buildAlternativeOfferView } from "@/domain/booking/alternativeVehicleView";
import { decideAlternativeVehicle } from "@/domain/booking/alternativeVehicle";
import { consumePublicPostOrError } from "@/services/publicPostRateLimit";

jest.mock("@/domain/booking/alternativeVehicleView", () => ({
  buildAlternativeOfferView: jest.fn(),
}));
jest.mock("@/domain/booking/alternativeVehicle", () => ({
  decideAlternativeVehicle: jest.fn(),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  extractAuditContext: () => ({ ipAddress: "1.1.1.1", userAgent: "test" }),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(async () => null),
  alternativeDecisionRateLimitOptions: () => ({}),
}));

const LEGACY_ID = "ALT-ABCDEF0123456789";
const STRONG_ID = "ALT-0123456789ABCDEF0123456789ABCDEF";

beforeEach(() => {
  jest.clearAllMocks();
  consumePublicPostOrError.mockResolvedValue(null);
});

describe("GET /api/booking/alternative/:offerId", () => {
  test("is read-only and never decides", async () => {
    buildAlternativeOfferView.mockResolvedValue({
      offerId: LEGACY_ID,
      status: "OFFERED",
      decidable: true,
    });
    const res = await GET({}, { params: Promise.resolve({ offerId: LEGACY_ID }) });
    expect(res.status).toBe(200);
    expect(decideAlternativeVehicle).not.toHaveBeenCalled();
    expect(buildAlternativeOfferView).toHaveBeenCalledWith(LEGACY_ID);
  });

  test("malformed and missing IDs both 404 without enumerating", async () => {
    const malformed = await GET({}, { params: Promise.resolve({ offerId: "ALT-1" }) });
    expect(malformed.status).toBe(404);
    expect(await malformed.json()).toEqual({
      success: false,
      message: "Offer not found",
    });
    expect(buildAlternativeOfferView).not.toHaveBeenCalled();

    buildAlternativeOfferView.mockResolvedValue(null);
    const missing = await GET(
      {},
      { params: Promise.resolve({ offerId: STRONG_ID }) }
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      success: false,
      message: "Offer not found",
    });
  });
});

describe("POST /api/booking/alternative/:offerId", () => {
  test("rate-limits before validating the capability id", async () => {
    consumePublicPostOrError.mockResolvedValueOnce({
      status: 429,
      body: { success: false, message: "Too many requests", code: "RATE_LIMIT" },
    });
    const res = await POST(
      {
        json: async () => ({ decision: "accept" }),
        headers: { get: () => "" },
      },
      { params: Promise.resolve({ offerId: "not-an-id" }) }
    );
    expect(res.status).toBe(429);
    expect(decideAlternativeVehicle).not.toHaveBeenCalled();
  });

  test("malformed IDs 404 after the rate-limit check", async () => {
    const res = await POST(
      {
        json: async () => ({ decision: "accept" }),
        headers: { get: () => "" },
      },
      { params: Promise.resolve({ offerId: "ALT-1" }) }
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      message: "Offer not found",
    });
    expect(decideAlternativeVehicle).not.toHaveBeenCalled();
  });

  test("requires accept or decline", async () => {
    const res = await POST(
      {
        json: async () => ({ decision: "maybe" }),
        headers: { get: () => "" },
      },
      { params: Promise.resolve({ offerId: LEGACY_ID }) }
    );
    expect(res.status).toBe(400);
    expect(decideAlternativeVehicle).not.toHaveBeenCalled();
  });
});
