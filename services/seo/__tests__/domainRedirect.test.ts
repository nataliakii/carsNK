import { buildCanonicalRedirectUrl, shouldRedirectToCanonicalHost } from "../domainRedirect";

describe("domainRedirect", () => {
  it("redirects configured non-canonical domain and preserves path/query", () => {
    const shouldRedirect = shouldRedirectToCanonicalHost({
      hostname: "www.natali-cars.com",
      pathname: "/en/cars",
    });
    expect(shouldRedirect).toBe(true);

    const target = buildCanonicalRedirectUrl(
      "https://www.natali-cars.com/en/cars?sort=price&currency=eur"
    );
    expect(target).toBe("https://natali-cars.com/en/cars?sort=price&currency=eur");
  });

  it("does not redirect localhost", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "localhost",
        pathname: "/en/cars",
      })
    ).toBe(false);
  });

  it("does not redirect API and Next assets", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.natali-cars.com",
        pathname: "/api/internal/cars",
      })
    ).toBe(false);
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.natali-cars.com",
        pathname: "/_next/static/chunk.js",
      })
    ).toBe(false);
  });

  it("does not redirect static files", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.natali-cars.com",
        pathname: "/favicon.png",
      })
    ).toBe(false);
  });

  it("does not redirect canonical host (loop guard)", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "natali-cars.com",
        pathname: "/en/cars",
      })
    ).toBe(false);
  });
});
