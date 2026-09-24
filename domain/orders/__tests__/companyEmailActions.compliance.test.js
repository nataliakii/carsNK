/**
 * @jest-environment node
 */
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-for-company-email-actions";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/order", () => ({
  Order: { findById: jest.fn() },
}));
jest.mock("@models/auditLog", () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn(),
  adminCalendarUrl: jest.fn(() => "https://admin.example/calendar"),
  superadminNotifyFooter: jest.fn(() => "footer"),
}));
jest.mock("@/domain/mail/notificationPolicy", () => ({
  notifyBookingAccepted: jest.fn().mockResolvedValue({ ok: true }),
  notifyBookingDeclined: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: { EMAIL_ACCEPT: "email_accept" },
  assertPartnerCanOperate: jest.fn(),
  auditPartnerComplianceBlock: jest.fn().mockResolvedValue(true),
}));

import { Order } from "@models/order";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { assertPartnerCanOperate } from "@/domain/legal/partnerOperatingPolicy";
import { applyCompanyEmailDecision } from "../companyEmailActions";
import { signCompanyEmailActionToken } from "../companyEmailActionToken";

describe("company email accept gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("8. marketplace email accept fails closed when the partner is not compliant", async () => {
    const token = signCompanyEmailActionToken({
      orderId: "507f1f77bcf86cd799439011",
      action: "accept",
    });
    const order = {
      _id: "507f1f77bcf86cd799439011",
      ownerId: "company-es",
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
      companyEmailDecision: null,
      save: jest.fn(),
    };
    Order.findById.mockResolvedValue(order);
    assertPartnerCanOperate.mockResolvedValue({
      allowed: false,
      error: "PARTNER_COMPLIANCE_REQUIRED",
      code: "PROFILE_NOT_VERIFIED",
      partnerMessage: "You cannot take bookings until verified.",
    });
    const result = await applyCompanyEmailDecision({
      token,
      decision: "accepted",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("PARTNER_COMPLIANCE_REQUIRED");
    expect(order.save).not.toHaveBeenCalled();
  });

  test("14. Greece email accept is unchanged by the Spain gate", async () => {
    const token = signCompanyEmailActionToken({
      orderId: "507f1f77bcf86cd799439012",
      action: "accept",
    });
    const order = {
      _id: "507f1f77bcf86cd799439012",
      ownerId: "company-gr",
      bookingMode: BOOKING_MODES.OPS_CALENDAR,
      companyEmailDecision: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Order.findById.mockResolvedValue(order);
    const result = await applyCompanyEmailDecision({
      token,
      decision: "accepted",
    });
    expect(assertPartnerCanOperate).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(order.companyEmailDecision).toBe("accepted");
  });
});
