const {
  normalizeRequestHostname,
  isLocalhostHostname,
  isOrderBookingRequestFromLocalhost,
} = require("../orderRequestLocalhost");

describe("orderRequestLocalhost", () => {
  test("normalizeRequestHostname strips port and first forwarded host", () => {
    expect(normalizeRequestHostname("localhost:3026")).toBe("localhost");
    expect(normalizeRequestHostname("127.0.0.1:3000")).toBe("127.0.0.1");
    expect(normalizeRequestHostname("example.com, other")).toBe("example.com");
  });

  test("isLocalhostHostname", () => {
    expect(isLocalhostHostname("localhost")).toBe(true);
    expect(isLocalhostHostname("127.0.0.1")).toBe(true);
    expect(isLocalhostHostname("::1")).toBe(true);
    expect(isLocalhostHostname("[::1]")).toBe(true);
    expect(isLocalhostHostname("natali-cars.com")).toBe(false);
  });

  test("isOrderBookingRequestFromLocalhost reads Host", () => {
    const req = {
      headers: {
        get: (name) => {
          if (name === "host") return "localhost:3026";
          return null;
        },
      },
    };
    expect(isOrderBookingRequestFromLocalhost(req)).toBe(true);
  });

  test("isOrderBookingRequestFromLocalhost false for production host", () => {
    const req = {
      headers: {
        get: (name) => {
          if (name === "host") return "natali-cars.com";
          return null;
        },
      },
    };
    expect(isOrderBookingRequestFromLocalhost(req)).toBe(false);
  });
});
