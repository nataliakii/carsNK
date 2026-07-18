const {
  buildWebsiteVisitDedupeKey,
  extractClientIp,
  formatWebsiteVisitTelegramMessage,
  getRequestCookieValue,
  getWebsiteVisitIpForHost,
  isAllowedWebsiteVisitHost,
  isAllowedWebsiteVisitIp,
  isLikelyHumanWebsiteVisitClientRequest,
  isPrivateIp,
  matchesIgnoredWebsiteVisitIp,
  normalizeComparableIp,
  normalizeVisitLanguage,
  normalizeWebsiteVisitUrl,
  rememberWebsiteVisit,
  isSuspiciousVisitUserAgent,
  shouldSkipWebsiteVisitRequest,
} = require("../websiteVisitNotification");

describe("websiteVisitNotification helpers", () => {
  const originalAllowLocal = process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS;

  afterEach(() => {
    if (originalAllowLocal === undefined) {
      delete process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS;
    } else {
      process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS = originalAllowLocal;
    }
  });

  test("normalizeComparableIp strips ports and ipv4-mapped ipv6 prefix", () => {
    expect(normalizeComparableIp("203.0.113.9:443")).toBe("203.0.113.9");
    expect(normalizeComparableIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(normalizeComparableIp("[2001:db8::1]")).toBe("2001:db8::1");
  });

  test("extractClientIp prefers the first public x-forwarded-for hop", () => {
    const request = {
      headers: new Headers({
        "x-forwarded-for": "10.0.0.1, 203.0.113.55, 198.51.100.20",
        "x-real-ip": "198.51.100.30",
      }),
    };

    expect(extractClientIp(request)).toBe("203.0.113.55");
  });

  test("isPrivateIp handles localhost, lan, and public addresses", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("192.168.1.25")).toBe(true);
    expect(isPrivateIp("203.0.113.55")).toBe(false);
  });

  test("normalizeVisitLanguage reduces accept-language style values to primary locale", () => {
    expect(normalizeVisitLanguage("en-US,en;q=0.9")).toBe("en");
    expect(normalizeVisitLanguage("ru")).toBe("ru");
    expect(normalizeVisitLanguage("")).toBe("unknown");
  });

  test("shouldSkipWebsiteVisitRequest skips prefetches and bots", () => {
    const prefetchRequest = {
      method: "GET",
      headers: new Headers({
        purpose: "prefetch",
      }),
    };
    expect(shouldSkipWebsiteVisitRequest(prefetchRequest)).toBe(true);

    const botRequest = {
      method: "GET",
      headers: new Headers({
        "user-agent": "Mozilla/5.0 Googlebot/2.1",
      }),
    };
    expect(shouldSkipWebsiteVisitRequest(botRequest)).toBe(true);

    const normalRequest = {
      method: "GET",
      headers: new Headers({
        "sec-fetch-dest": "document",
        "user-agent": "Mozilla/5.0 Safari/537.36",
      }),
    };
    expect(shouldSkipWebsiteVisitRequest(normalRequest)).toBe(false);
  });

  test("shouldSkipWebsiteVisitRequest skips Next.js internal RSC/data requests", () => {
    const nextDataRequest = {
      method: "GET",
      headers: new Headers({
        accept: "text/x-component",
        rsc: "1",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "user-agent": "Mozilla/5.0 Safari/537.36",
      }),
      nextUrl: new URL("https://carsnk.gr/en/cars?_rsc=abc123"),
    };

    expect(shouldSkipWebsiteVisitRequest(nextDataRequest)).toBe(true);
  });

  test("isSuspiciousVisitUserAgent rejects scripted and headless clients", () => {
    expect(isSuspiciousVisitUserAgent("curl/8.7.1")).toBe(true);
    expect(
      isSuspiciousVisitUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HeadlessChrome/124.0.0.0 Safari/537.36"
      )
    ).toBe(true);
    expect(
      isSuspiciousVisitUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });

  test("getRequestCookieValue can read regular Cookie headers", () => {
    const request = {
      headers: new Headers({
        cookie: "foo=bar; nc_visit_sid=session-cookie-1; theme=light",
      }),
    };

    expect(getRequestCookieValue(request, "nc_visit_sid")).toBe("session-cookie-1");
    expect(getRequestCookieValue(request, "missing")).toBe("");
  });

  test("isLikelyHumanWebsiteVisitClientRequest accepts same-origin browser tracker requests", () => {
    const request = new Request("https://carsnk.gr/api/internal/website-visit", {
      method: "POST",
      headers: {
        origin: "https://carsnk.gr",
        referer: "https://carsnk.gr/en/cars",
        cookie: "nc_visit_sid=session-cookie-2",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "x-website-visit-client": "browser",
      },
    });

    expect(isLikelyHumanWebsiteVisitClientRequest(request)).toBe(true);
  });

  test("isLikelyHumanWebsiteVisitClientRequest rejects scripted requests without browser proof", () => {
    const request = new Request("https://carsnk.gr/api/internal/website-visit", {
      method: "POST",
      headers: {
        origin: "https://carsnk.gr",
        referer: "https://carsnk.gr/en/cars",
        cookie: "nc_visit_sid=session-cookie-3",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
        "user-agent": "curl/8.7.1",
      },
    });

    expect(isLikelyHumanWebsiteVisitClientRequest(request)).toBe(false);
  });

  test("matchesIgnoredWebsiteVisitIp compares against all company ignore fields", () => {
    const company = {
      notSendIP1: "198.51.100.10",
      notSendIP2: " ::ffff:203.0.113.8 ",
      notSendIP3: "",
      notSendIP4: undefined,
    };

    expect(matchesIgnoredWebsiteVisitIp(company, "198.51.100.10")).toBe(true);
    expect(matchesIgnoredWebsiteVisitIp(company, "203.0.113.8")).toBe(true);
    expect(matchesIgnoredWebsiteVisitIp(company, "203.0.113.9")).toBe(false);
  });

  test("rememberWebsiteVisit suppresses duplicates inside ttl for one session/ip pair", () => {
    const cache = new Map();
    const key = buildWebsiteVisitDedupeKey({
      sessionId: "session-1",
      url: "https://carsnk.gr/en/cars",
      ip: "203.0.113.9",
    });

    expect(rememberWebsiteVisit(cache, key, 1000, 5000)).toBe(true);
    expect(rememberWebsiteVisit(cache, key, 2000, 5000)).toBe(false);
    expect(rememberWebsiteVisit(cache, key, 7001, 5000)).toBe(true);
  });

  test("buildWebsiteVisitDedupeKey ignores url changes within the same session", () => {
    const first = buildWebsiteVisitDedupeKey({
      sessionId: "session-2",
      url: "https://carsnk.gr/",
      ip: "203.0.113.10",
    });
    const second = buildWebsiteVisitDedupeKey({
      sessionId: "session-2",
      url: "https://carsnk.gr/en/locations/thessaloniki-airport",
      ip: "203.0.113.10",
    });

    expect(first).toBe(second);
    expect(first).toBe("session-2|203.0.113.10");
  });

  test("normalizeWebsiteVisitUrl strips internal Next.js visit params", () => {
    expect(
      normalizeWebsiteVisitUrl(
        "https://carsnk.gr/en/cars?_rsc=abc123&sort=price#details"
      )
    ).toBe("https://carsnk.gr/en/cars?sort=price");
  });

  test("formatWebsiteVisitTelegramMessage keeps multiline readable output", () => {
    const message = formatWebsiteVisitTelegramMessage({
      url: "https://carsnk.gr/en/cars/bmw-x5",
      ip: "203.0.113.9",
      country: "Greece",
      region: "Central Macedonia",
      city: "Thessaloniki",
      language: "en-US,en;q=0.9",
    });

    expect(message).toContain("Новый визит на сайт:");
    expect(message).toContain("Страница: https://carsnk.gr/en/cars/bmw-x5");
    expect(message).toContain("Язык: en");
    expect(message).toContain("IP: 203.0.113.9");
    expect(message).toContain("Страна: Greece");
    expect(message).toContain("Регион: Central Macedonia");
    expect(message).toContain("Город: Thessaloniki");
    expect(message.indexOf("Язык: en")).toBeLessThan(message.indexOf("IP: 203.0.113.9"));
  });

  test("local website visit notifications can be enabled explicitly for localhost", () => {
    process.env.ALLOW_LOCAL_WEBSITE_VISIT_NOTIFICATIONS = "1";

    expect(isAllowedWebsiteVisitHost("localhost")).toBe(true);
    expect(getWebsiteVisitIpForHost("", "localhost")).toBe("127.0.0.1");
    expect(isAllowedWebsiteVisitIp("127.0.0.1")).toBe(true);
  });
});
