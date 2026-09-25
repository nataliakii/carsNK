/**
 * @jest-environment node
 */
import { notifyOrderAction } from "../orderNotificationDispatcher";
import { sendEmailDirect } from "@/lib/email/sendDirect";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));
jest.mock("@/domain/booking/partnerBookingConfirmation", () => ({
  issueConfirmationToken: jest.fn().mockResolvedValue({
    ok: true,
    token: "partner-token",
  }),
}));
jest.mock("@/domain/mail/notificationPolicy", () => ({
  notifyBookingRequested: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("@models/auditLog", () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue({}) },
}));
jest.mock("@models/MailLog", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    }),
    create: jest.fn(),
  },
}));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));

import { notifyBookingRequested } from "@/domain/mail/notificationPolicy";

describe("Spain marketplace create notifications", () => {
  const originalEmailTesting = process.env.EMAIL_TESTING;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TESTING = "false";
    sendEmailDirect.mockResolvedValue({ messageId: "id" });
  });

  afterAll(() => {
    process.env.EMAIL_TESTING = originalEmailTesting;
  });

  const user = { id: "u1", isAdmin: false, role: 0 };

  test("owner A receives the company email, not owner B", async () => {
    await notifyOrderAction({
      order: {
        _id: "order-1",
        orderNumber: "1",
        carModel: "Seat Leon",
        my_order: true,
        confirmed: false,
        bookingMode: "MARKETPLACE_REQUEST",
        ownerId: "company-a",
        email: "ana@example.com",
        rentalStartDate: "2026-10-01T10:00:00.000Z",
        rentalEndDate: "2026-10-05T10:00:00.000Z",
        timeIn: "2026-10-01T10:00:00.000Z",
        timeOut: "2026-10-05T10:00:00.000Z",
      },
      user,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "owner-a@example.com",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    expect(notifyBookingRequested).toHaveBeenCalled();
    const matrix = notifyBookingRequested.mock.calls[0][0];
    expect(matrix.companyId).toBe("company-a");
    expect(matrix.revealContacts).toBe(false);
    expect(matrix.confirmUrl).toBeUndefined();
    expect(matrix.pickupAt).toBe("2026-10-01T10:00:00.000Z");
    expect(matrix.returnAt).toBe("2026-10-05T10:00:00.000Z");
    const leaked = sendEmailDirect.mock.calls.find((call) =>
      (call[0].to || []).includes("owner-b@example.com")
    );
    expect(leaked).toBeFalsy();
  });

  test("missing owner does not email a platform company address", async () => {
    await notifyOrderAction({
      order: {
        _id: "order-2",
        orderNumber: "2",
        carModel: "Seat Leon",
        my_order: true,
        confirmed: false,
        bookingMode: "MARKETPLACE_REQUEST",
        email: "ana@example.com",
        rentalStartDate: "2026-10-01T10:00:00.000Z",
        rentalEndDate: "2026-10-05T10:00:00.000Z",
        timeIn: "2026-10-01T10:00:00.000Z",
        timeOut: "2026-10-05T10:00:00.000Z",
      },
      user,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: undefined,
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    expect(notifyBookingRequested).toHaveBeenCalled();
    const matrix = notifyBookingRequested.mock.calls[0][0];
    expect(matrix.companyId).toBe("");
    const partnerish = sendEmailDirect.mock.calls.filter((call) =>
      (call[0].to || []).some((addr) =>
        /owner|partner|company-b/i.test(String(addr))
      )
    );
    expect(partnerish).toHaveLength(0);
  });
});
