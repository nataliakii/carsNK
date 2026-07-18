jest.mock("@lib/database", () => ({
  __esModule: true,
  connectToDB: jest.fn().mockResolvedValue(true),
}));

jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("@models/WebsiteVisit", () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({ _id: "visit1" }),
  },
}));

jest.mock("@/lib/telegram/sendDirect", () => ({
  __esModule: true,
  sendTelegramDirect: jest.fn(),
}));

const Company = require("@models/company").default;
const WebsiteVisit = require("@models/WebsiteVisit").default;
const { sendTelegramDirect } = require("@/lib/telegram/sendDirect");
const {
  __resetWebsiteVisitTelegramNotificationStateForTests,
  sendWebsiteVisitTelegramNotification,
} = require("../sendWebsiteVisitTelegram");

function mockCompanyDoc(doc) {
  const lean = jest.fn().mockResolvedValue(doc);
  const select = jest.fn().mockReturnValue({ lean });
  Company.findById.mockReturnValue({ select });
}

describe("sendWebsiteVisitTelegramNotification", () => {
  const originalAllowLocal = process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetWebsiteVisitTelegramNotificationStateForTests();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "success",
        country: "Greece",
        regionName: "Central Macedonia",
        city: "Thessaloniki",
      }),
    });
  });

  afterEach(() => {
    if (originalAllowLocal === undefined) {
      delete process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS;
    } else {
      process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS = originalAllowLocal;
    }
  });

  test("does not send telegram when ip is present in company ignore list", async () => {
    mockCompanyDoc({
      notSendIP1: "203.0.113.10",
    });

    const result = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/cars",
      ip: "203.0.113.10",
      language: "en",
      sessionId: "session-ignore",
    });

    expect(result).toEqual({
      sent: false,
      saved: false,
      skipped: true,
      reason: "ignored_ip",
    });
    expect(sendTelegramDirect).not.toHaveBeenCalled();
    expect(WebsiteVisit.create).not.toHaveBeenCalled();
  });

  test("suppresses duplicate notifications for the same session even when urls differ", async () => {
    mockCompanyDoc({});
    sendTelegramDirect.mockResolvedValue(true);

    const first = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/cars",
      ip: "203.0.113.11",
      language: "en",
      sessionId: "session-duplicate",
    });
    const second = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/cars/bmw-x5",
      ip: "203.0.113.11",
      language: "en",
      sessionId: "session-duplicate",
    });

    expect(first).toEqual({
      sent: true,
      saved: true,
      skipped: false,
      reason: null,
    });
    expect(second).toEqual({
      sent: false,
      saved: false,
      skipped: true,
      reason: "duplicate_session_visit",
    });
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
    expect(WebsiteVisit.create).toHaveBeenCalledTimes(1);
  });

  test("keeps visit in DB when telegram fails and does not create a second row", async () => {
    mockCompanyDoc({});
    sendTelegramDirect.mockResolvedValue(false);

    const first = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/cars/bmw-x5",
      ip: "203.0.113.12",
      language: "en",
      sessionId: "session-retry",
    });
    const second = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/cars/bmw-x5",
      ip: "203.0.113.12",
      language: "en",
      sessionId: "session-retry",
    });

    expect(first).toEqual({
      sent: false,
      saved: true,
      skipped: false,
      reason: "telegram_failed",
    });
    expect(second).toEqual({
      sent: false,
      saved: false,
      skipped: true,
      reason: "duplicate_session_visit",
    });
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
    expect(WebsiteVisit.create).toHaveBeenCalledTimes(1);
  });

  test("suppresses bootstrap variants that hit different urls inside one session", async () => {
    mockCompanyDoc({});
    sendTelegramDirect.mockResolvedValue(true);

    const first = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/",
      ip: "203.0.113.22",
      language: "en",
      sessionId: "session-rsc-dedupe",
    });
    const second = await sendWebsiteVisitTelegramNotification({
      url: "https://carsnk.gr/en/locations/thessaloniki-airport",
      ip: "203.0.113.22",
      language: "en",
      sessionId: "session-rsc-dedupe",
    });

    expect(first).toEqual({
      sent: true,
      saved: true,
      skipped: false,
      reason: null,
    });
    expect(second).toEqual({
      sent: false,
      saved: false,
      skipped: true,
      reason: "duplicate_session_visit",
    });
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
  });

  test("allows localhost notifications when the explicit dev flag is enabled", async () => {
    process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS = "1";
    mockCompanyDoc({});
    sendTelegramDirect.mockResolvedValue(true);

    const result = await sendWebsiteVisitTelegramNotification({
      url: "http://localhost:3026/en/cars",
      ip: "127.0.0.1",
      language: "en",
      sessionId: "local-session",
    });

    expect(result).toEqual({
      sent: true,
      saved: true,
      skipped: false,
      reason: null,
    });
    expect(sendTelegramDirect).toHaveBeenCalledTimes(1);
    expect(sendTelegramDirect.mock.calls[0][0]).toContain("Страница: http://localhost:3026/en/cars");
    expect(sendTelegramDirect.mock.calls[0][0]).toContain("IP: 127.0.0.1");
    expect(WebsiteVisit.create).toHaveBeenCalled();
  });
});
