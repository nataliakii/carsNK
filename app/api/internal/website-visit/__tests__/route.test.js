jest.mock("@/lib/notifications/sendWebsiteVisitTelegram", () => ({
  __esModule: true,
  sendWebsiteVisitTelegramNotification: jest.fn(),
}));

const {
  sendWebsiteVisitTelegramNotification,
} = require("@/lib/notifications/sendWebsiteVisitTelegram");
const { POST } = require("../route");

describe("internal website visit route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("accepts same-origin browser visit requests with a session cookie", async () => {
    sendWebsiteVisitTelegramNotification.mockResolvedValue({
      sent: true,
      saved: true,
      skipped: false,
      reason: null,
    });

    const request = new Request("https://carsnk.gr/api/internal/website-visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://carsnk.gr",
        referer: "https://carsnk.gr/en/cars",
        cookie: "nc_visit_sid=human-session-1",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "x-forwarded-for": "203.0.113.45",
        "x-website-visit-client": "browser",
      },
      body: JSON.stringify({
        url: "https://carsnk.gr/en/cars",
        language: "en-US,en;q=0.9",
        proof: "scroll",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      sent: true,
      saved: true,
      skipped: false,
      reason: null,
    });
    expect(sendWebsiteVisitTelegramNotification).toHaveBeenCalledWith({
      url: "https://carsnk.gr/en/cars",
      ip: "203.0.113.45",
      language: "en",
      sessionId: "human-session-1",
      proof: "scroll",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    });
  });

  test("rejects scripted requests without a valid browser session signal", async () => {
    const request = new Request("https://carsnk.gr/api/internal/website-visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://carsnk.gr",
        referer: "https://carsnk.gr/en/cars",
        "user-agent": "curl/8.7.1",
      },
      body: JSON.stringify({
        url: "https://carsnk.gr/en/cars",
        language: "en",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(sendWebsiteVisitTelegramNotification).not.toHaveBeenCalled();
  });
});
