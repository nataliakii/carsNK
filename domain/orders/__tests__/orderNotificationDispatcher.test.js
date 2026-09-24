import { notifyOrderAction } from "../orderNotificationDispatcher";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import AuditLog from "@models/auditLog";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));
jest.mock("@/domain/booking/partnerBookingConfirmation", () => ({
  issueConfirmationToken: jest.fn().mockResolvedValue({
    ok: true,
    token: "test-partner-confirm-token",
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
import { issueConfirmationToken } from "@/domain/booking/partnerBookingConfirmation";

describe("orderNotificationDispatcher", () => {
  const originalEmailTesting = process.env.EMAIL_TESTING;

  const baseOrder = {
    _id: "order-1",
    orderNumber: "1001",
    carNumber: "0052",
    regNumber: "AA-1234",
    carModel: "Toyota Yaris",
    placeIn: "Thessaloniki Airport (SKG)",
    placeOut: "Nea Kallikratia",
    rentalStartDate: "2026-01-14T22:00:00.000Z",
    rentalEndDate: "2026-01-16T22:00:00.000Z",
    timeIn: "2026-01-15T12:00:00.000Z",
    timeOut: "2026-01-17T08:00:00.000Z",
    totalPrice: 123,
    customerName: "Test User",
    phone: "+306900000000",
    email: "customer@example.com",
    my_order: true,
    confirmed: false,
    locale: "en",
    clientLang: "ru",
    clientIP: "203.0.113.1",
    clientCountry: "Greece",
    clientRegion: "Attica",
    clientCity: "Athens",
  };

  const baseUser = {
    id: "admin-1",
    isAdmin: true,
    role: 1,
    email: "admin@example.com",
    name: "Admin",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TESTING = "false";
    sendEmailDirect.mockResolvedValue({ messageId: "test-id" });
    sendTelegramDirect.mockResolvedValue(true);
    AuditLog.create.mockResolvedValue({});
    notifyBookingRequested.mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    process.env.EMAIL_TESTING = originalEmailTesting;
  });

  test("CREATE client order delegates company/superadmin to matrix and keeps telegram + customer", async () => {
    await expect(
      notifyOrderAction({
        order: baseOrder,
        user: baseUser,
        action: "CREATE",
        source: "BACKEND",
        companyEmail: "company@example.com",
        locale: "en",
        notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
      })
    ).resolves.toBeUndefined();

    expect(notifyBookingRequested).toHaveBeenCalledTimes(1);
    const matrix = notifyBookingRequested.mock.calls[0][0];
    expect(matrix.companyEmail).toBe("company@example.com");
    expect(matrix.confirmUrl).toContain("/api/booking/partner-confirm?token=");
    expect(matrix.confirmUrl).toContain("test-partner-confirm-token");
    expect(matrix.revealContacts).toBe(false);
    expect(matrix.customerName).toBe("Test User");
    expect(issueConfirmationToken).toHaveBeenCalled();

    // Customer email only (company/superadmin owned by matrix policy).
    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    expect(sendEmailDirect.mock.calls[0][0].to).toContain("customer@example.com");
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);

    const telegram = sendTelegramDirect.mock.calls[0][0];
    expect(telegram).toContain("AA-1234");
    expect(telegram).toContain("📍 Pickup: Thessaloniki Airport (SKG)");
    expect(telegram).toContain("↩️ Return: Nea Kallikratia");
    expect(telegram).toContain("🪪 Driver's licence: not uploaded");
    expect(telegram).toContain("• Language: ru");
    expect(telegram).toContain("• Client IP: 203.0.113.1");
  });

  test("CREATE with CDW includes insurance line in telegram", async () => {
    await notifyOrderAction({
      order: { ...baseOrder, insurance: "CDW", numberOfDays: 2 },
      user: baseUser,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "company@example.com",
      locale: "en",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    const telegramMsg = sendTelegramDirect.mock.calls[0][0];
    const daysIdx = telegramMsg.indexOf("🗓 Days:");
    const insIdx = telegramMsg.indexOf("🛡️ Insurance: CDW");
    expect(insIdx).toBeGreaterThan(-1);
    expect(daysIdx).toBeGreaterThan(-1);
    expect(insIdx).toBeLessThan(daysIdx);
  });

  test("CREATE includes driving licence URLs only on superadmin telegram", async () => {
    const licUrl = "https://res.cloudinary.com/demo/image/upload/v1/licence-front";
    await notifyOrderAction({
      order: { ...baseOrder, drivingLicenceUrls: [licUrl] },
      user: baseUser,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "company@example.com",
      locale: "en",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    expect(notifyBookingRequested.mock.calls[0][0].revealContacts).toBe(false);
    const telegramMsg = sendTelegramDirect.mock.calls[0][0];
    expect(telegramMsg).toContain(licUrl);
    expect(telegramMsg).toContain("🪪 Driver's licence: uploaded");
  });

  test("CREATE with Russian notify locale does not throw", async () => {
    const licUrl = "https://res.cloudinary.com/demo/image/upload/v1/licence-front";
    await expect(
      notifyOrderAction({
        order: { ...baseOrder, drivingLicenceUrls: [licUrl] },
        user: baseUser,
        action: "CREATE",
        source: "BACKEND",
        companyEmail: "company@example.com",
        locale: "en",
        notifyLocales: { langAdmin: "ru", langSuperadmin: "ru" },
      })
    ).resolves.toBeUndefined();

    expect(notifyBookingRequested).toHaveBeenCalled();
    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
  });

  test("CREATE with TPL does not include insurance line on telegram", async () => {
    await notifyOrderAction({
      order: { ...baseOrder, insurance: "TPL", numberOfDays: 2 },
      user: baseUser,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "company@example.com",
      locale: "en",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    expect(sendTelegramDirect.mock.calls[0][0]).not.toContain("🛡️");
  });

  test("CREATE succeeds when Telegram fails but customer email succeeds", async () => {
    sendTelegramDirect.mockResolvedValue(false);

    await expect(
      notifyOrderAction({
        order: baseOrder,
        user: baseUser,
        action: "CREATE",
        source: "BACKEND",
        companyEmail: "company@example.com",
        locale: "en",
        notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
      })
    ).resolves.toBeUndefined();

    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
  });

  test("throws aggregated error when customer email fails", async () => {
    sendEmailDirect.mockRejectedValueOnce(new Error("SMTP down"));

    await expect(
      notifyOrderAction({
        order: baseOrder,
        user: baseUser,
        action: "CREATE",
        source: "BACKEND",
        companyEmail: "company@example.com",
        locale: "en",
        notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
      })
    ).rejects.toThrow(/Notification dispatch failed/);

    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
  });

  test("UPDATE_DATES on confirmed client order includes old/new prices in critical message", async () => {
    const confirmedClientOrderBefore = {
      ...baseOrder,
      confirmed: true,
      rentalStartDate: "2099-01-14T22:00:00.000Z",
      rentalEndDate: "2099-01-16T22:00:00.000Z",
      totalPrice: 100,
      OverridePrice: null,
    };
    const confirmedClientOrderAfter = {
      ...baseOrder,
      confirmed: true,
      rentalStartDate: "2099-01-15T22:00:00.000Z",
      rentalEndDate: "2099-01-17T22:00:00.000Z",
      totalPrice: 120,
      OverridePrice: null,
    };

    await expect(
      notifyOrderAction({
        order: confirmedClientOrderAfter,
        previousOrder: confirmedClientOrderBefore,
        user: baseUser,
        action: "UPDATE_DATES",
        source: "BACKEND",
        notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
      })
    ).resolves.toBeUndefined();

    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
    const telegramText = sendTelegramDirect.mock.calls[0][0];
    expect(telegramText).toContain("CRITICAL: critical edit on confirmed client order");
    expect(telegramText).toContain("🪪 Driver's licence: not uploaded");
    expect(telegramText).toContain("Action: UPDATE_DATES");
    expect(telegramText).toContain("Old price: €100.00");
    expect(telegramText).toContain("New price: €120.00");
  });

  test("AuditLog persistence failure does not block notifications", async () => {
    AuditLog.create.mockRejectedValueOnce(new Error("mongo down"));
    await expect(
      notifyOrderAction({
        order: baseOrder,
        user: baseUser,
        action: "CREATE",
        source: "BACKEND",
        companyEmail: "company@example.com",
        notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
      })
    ).resolves.toBeUndefined();
    expect(notifyBookingRequested).toHaveBeenCalled();
  });
});
