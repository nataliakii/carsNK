/**
 * @jest-environment node
 */
import { GET, POST } from "../route";
import {
  buildConfirmationView,
  consumeConfirmationToken,
} from "@/domain/booking/partnerBookingConfirmation";
import { offerAlternativeVehicle } from "@/domain/booking/alternativeVehicle";

jest.mock("@/domain/booking/partnerBookingConfirmation", () => ({
  buildConfirmationView: jest.fn(),
  consumeConfirmationToken: jest.fn(),
  PARTNER_CONFIRMATION_BUTTON_LABEL: "Confirm availability",
}));
jest.mock("@/domain/booking/alternativeVehicle", () => ({
  listEligibleAlternativeCars: jest.fn(async () => ({ ok: true, cars: [], excluded: [] })),
  offerAlternativeVehicle: jest.fn(),
}));
jest.mock("@models/user", () => ({ ROLE: { ADMIN: 1, SUPERADMIN: 2 } }));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn(),
  extractAuditContext: () => ({ ipAddress: "1.1.1.1", userAgent: "test" }),
}));
jest.mock("@/services/publicPostRateLimit", () => ({
  consumePublicPostOrError: jest.fn(),
  bookingConfirmRateLimitOptions: () => ({}),
}));

describe("GET /api/booking/partner-confirm", () => {
  test("is read-only and never consumes the token", async () => {
    buildConfirmationView.mockResolvedValue({
      ok: true,
      alreadyConsumed: false,
      statement: "I confirm",
      buttonLabel: "Confirm availability",
      booking: {
        bookingId: "b1",
        orderNumber: "1",
        vehicle: {},
        pickup: {},
        dropoff: {},
        extras: {},
        financials: { currency: "EUR", grossMinor: 1000, prepaymentMinor: 100, balanceMinor: 900, prepaymentPercent: 10 },
      },
      cancellationRules: { replacementNotificationHours: 24 },
      agreement: {},
    });
    const request = {
      nextUrl: { searchParams: { get: () => "token-1" } },
      headers: { get: () => "" },
    };
    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(consumeConfirmationToken).not.toHaveBeenCalled();
    expect(buildConfirmationView).toHaveBeenCalledWith("token-1");
  });
});

describe("POST /api/booking/partner-confirm offer_alternative", () => {
  test("does not consume a stale token and surfaces paid_requires_manual", async () => {
    buildConfirmationView.mockResolvedValue({
      ok: true,
      alreadyConsumed: true,
      booking: { bookingId: "order-paid", ownerId: "company-a" },
    });
    offerAlternativeVehicle.mockResolvedValue({
      ok: false,
      status: 409,
      code: "paid_requires_manual",
      message: "This booking is already paid. Replacing the car requires SUPERADMIN/manual resolution — the automatic alternative flow cannot run.",
    });
    const request = {
      headers: { get: () => "application/json" },
      json: async () => ({
        token: "stale-token",
        decision: "offer_alternative",
        proposedCarId: "car-b",
        reason: "workshop",
      }),
    };
    const res = await POST(request);
    expect(res.status).toBe(409);
    expect(consumeConfirmationToken).not.toHaveBeenCalled();
    expect(offerAlternativeVehicle).toHaveBeenCalled();
  });
});
