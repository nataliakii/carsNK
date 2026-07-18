import {
  buildCanonicalRedirectUrl,
  shouldRedirectToCanonicalHost,
} from "../domainRedirect";

describe("domainRedirect (dual domain)", () => {
  it("redirects www.carsnk.gr → carsnk.gr and preserves path/query", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.carsnk.gr",
        pathname: "/en/cars",
      })
    ).toBe(true);

    expect(
      buildCanonicalRedirectUrl(
        "https://www.carsnk.gr/en/cars?sort=price&currency=eur"
      )
    ).toBe("https://carsnk.gr/en/cars?sort=price&currency=eur");
  });

  it("redirects www.cars.bbqr.site → cars.bbqr.site (not carsnk.gr)", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.cars.bbqr.site",
        pathname: "/en/cars",
      })
    ).toBe(true);

    expect(
      buildCanonicalRedirectUrl("https://www.cars.bbqr.site/ru/contacts")
    ).toBe("https://cars.bbqr.site/ru/contacts");
  });

  it("does not redirect peer apex hosts (both serve the app)", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "carsnk.gr",
        pathname: "/en/cars",
      })
    ).toBe(false);
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "cars.bbqr.site",
        pathname: "/en/cars",
      })
    ).toBe(false);
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
        hostname: "www.carsnk.gr",
        pathname: "/api/internal/cars",
      })
    ).toBe(false);
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.cars.bbqr.site",
        pathname: "/_next/static/chunk.js",
      })
    ).toBe(false);
  });

  it("does not redirect static files", () => {
    expect(
      shouldRedirectToCanonicalHost({
        hostname: "www.carsnk.gr",
        pathname: "/favicon.png",
      })
    ).toBe(false);
  });
});
