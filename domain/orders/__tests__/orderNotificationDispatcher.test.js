import { notifyOrderAction } from "../orderNotificationDispatcher";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));

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
    rentalStartDate: "2026-01-14T22:00:00.000Z", // 15-01-26 Athens
    rentalEndDate: "2026-01-16T22:00:00.000Z", // 17-01-26 Athens
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
  });

  afterAll(() => {
    process.env.EMAIL_TESTING = originalEmailTesting;
  });

  test("CREATE client order sends all channels and formats dates in Athens timezone", async () => {
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

    // COMPANY_EMAIL + SUPERADMIN + CUSTOMER -> 3 email sends
    expect(sendEmailDirect).toHaveBeenCalledTimes(3);
    // SUPERADMIN telegram only once for this scenario
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);

    const firstEmailCall = sendEmailDirect.mock.calls[0][0];
    expect(firstEmailCall.message).toContain("📅 From: 15-01-26 (14:00)");
    expect(firstEmailCall.message).toContain("📅 To: 17-01-26 (10:00)");
    expect(firstEmailCall.message).toContain("AA-1234");
    expect(firstEmailCall.message).toContain("📍 Pickup: Thessaloniki Airport (SKG)");
    expect(firstEmailCall.message).toContain("↩️ Return: Nea Kallikratia");
    expect(sendTelegramDirect.mock.calls[0][0]).toContain("AA-1234");
    expect(sendTelegramDirect.mock.calls[0][0]).toContain(
      "📍 Pickup: Thessaloniki Airport (SKG)"
    );
    expect(sendTelegramDirect.mock.calls[0][0]).toContain("↩️ Return: Nea Kallikratia");
    expect(sendTelegramDirect.mock.calls[0][0]).toContain(
      "🪪 Driver's licence: not uploaded"
    );
    expect(firstEmailCall.message).not.toContain("🪪 Driver's licence:");

    // COMPANY_EMAIL: только язык + страна; SUPERADMIN: полный гео-футер в Telegram и письме
    const companyEmail = sendEmailDirect.mock.calls[0][0];
    expect(companyEmail.message).toContain("• Language: ru");
    expect(companyEmail.message).toContain("• Country: Greece");
    expect(companyEmail.message).not.toContain("• Region:");
    expect(companyEmail.message).not.toContain("• City:");
    expect(companyEmail.message).not.toContain("• Client IP:");

    const superadminTelegram = sendTelegramDirect.mock.calls[0][0];
    expect(superadminTelegram).toContain("• Language: ru");
    expect(superadminTelegram).toContain("• Client IP: 203.0.113.1");
    expect(superadminTelegram).toContain("• Country: Greece");
    expect(superadminTelegram).toContain("• Region: Attica");
    expect(superadminTelegram).toContain("• City: Athens");

    const superadminEmail = sendEmailDirect.mock.calls[1][0];
    expect(superadminEmail.message).toContain("• Language: ru");
    expect(superadminEmail.message).toContain("• Client IP: 203.0.113.1");
    expect(superadminEmail.message).toContain("🪪 Driver's licence: not uploaded");
  });

  test("CREATE with CDW includes localized insurance line before days in admin/superadmin messages", async () => {
    await notifyOrderAction({
      order: { ...baseOrder, insurance: "CDW", numberOfDays: 2 },
      user: baseUser,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "company@example.com",
      locale: "en",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    const companyMsg = sendEmailDirect.mock.calls[0][0].message;
    const superadminEmailMsg = sendEmailDirect.mock.calls[1][0].message;
    const telegramMsg = sendTelegramDirect.mock.calls[0][0];
    for (const msg of [companyMsg, superadminEmailMsg, telegramMsg]) {
      const daysIdx = msg.indexOf("🗓 Days:");
      const insIdx = msg.indexOf("🛡️ Insurance: CDW");
      expect(insIdx).toBeGreaterThan(-1);
      expect(daysIdx).toBeGreaterThan(-1);
      expect(insIdx).toBeLessThan(daysIdx);
    }
  });

  test("CREATE includes driving licence Cloudinary URLs only for superadmin channels", async () => {
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

    const companyMsg = sendEmailDirect.mock.calls[0][0].message;
    const superadminMsg = sendEmailDirect.mock.calls[1][0].message;
    const telegramMsg = sendTelegramDirect.mock.calls[0][0];
    expect(companyMsg).not.toContain("🪪");
    expect(companyMsg).not.toContain("Driver's licence:");
    expect(companyMsg).not.toContain(licUrl);
    expect(superadminMsg).toContain(licUrl);
    expect(superadminMsg).toContain("🪪 Driver's licence: uploaded");
    expect(telegramMsg).toContain(licUrl);
    expect(telegramMsg).toContain("🪪 Driver's licence: uploaded");
  });

  test("CREATE with driving licences and Russian notify locale does not throw (ru DICT had missing keys)", async () => {
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

    expect(sendEmailDirect).toHaveBeenCalledTimes(3);
    const companyMsg = sendEmailDirect.mock.calls[0][0].message;
    const superadminMsg = sendEmailDirect.mock.calls[1][0].message;
    expect(companyMsg).not.toContain("🪪");
    expect(companyMsg).not.toContain("Водительские права");
    expect(companyMsg).not.toContain(licUrl);
    expect(superadminMsg).toContain(licUrl);
  });

  test("CREATE with TPL does not include insurance line", async () => {
    await notifyOrderAction({
      order: { ...baseOrder, insurance: "TPL", numberOfDays: 2 },
      user: baseUser,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "company@example.com",
      locale: "en",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    const companyMsg = sendEmailDirect.mock.calls[0][0].message;
    expect(companyMsg).not.toContain("🛡️");
    expect(sendTelegramDirect.mock.calls[0][0]).not.toContain("🛡️");
  });

  test("CREATE succeeds when Telegram fails but all emails succeed", async () => {
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

    expect(sendEmailDirect).toHaveBeenCalledTimes(3);
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
  });

  test("throws aggregated error when at least one channel fails, but still attempts all channels", async () => {
    sendEmailDirect
      .mockResolvedValueOnce({ messageId: "ok" })
      .mockRejectedValueOnce(new Error("SMTP down"))
      .mockResolvedValueOnce({ messageId: "ok" });

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

    expect(sendEmailDirect).toHaveBeenCalledTimes(3);
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
});
