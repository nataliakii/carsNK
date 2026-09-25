/**
 * @jest-environment node
 *
 * The canonical market resolver. Market country picks the catalog and the
 * service areas; UI locale only picks the language.
 */
import {
  getDeploymentMarketCountry,
  isSameMarket,
  MARKET_COUNTRY_CODES,
  normalizeMarketCountry,
  resolveMarketCountry,
} from "@/domain/platform/marketCountry";

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

function requestFrom(url) {
  return new Request(url, { method: "GET" });
}

describe("resolveMarketCountry", () => {
  test("the Spain deployment resolves to ES", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    expect(resolveMarketCountry()).toBe("ES");
    expect(getDeploymentMarketCountry()).toBe("ES");
  });

  test("the Greece deployment resolves to GR", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    expect(resolveMarketCountry()).toBe("GR");
  });

  test("known Spanish hosts resolve to ES even on a Greek deployment", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    expect(resolveMarketCountry("rovaro.es")).toBe("ES");
    expect(resolveMarketCountry("www.rovaro.es")).toBe("ES");
    expect(resolveMarketCountry("rovaro.autos")).toBe("ES");
    expect(resolveMarketCountry(requestFrom("https://rovaro.es/transfer"))).toBe(
      "ES"
    );
  });

  test("Greek hosts resolve to GR even on a Spanish deployment", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    expect(resolveMarketCountry("carsnk.gr")).toBe("GR");
    expect(resolveMarketCountry("cars.bbqr.site")).toBe("GR");
  });

  test("an unknown host falls back to the deployment, never to Greece", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    expect(resolveMarketCountry("preview-123.vercel.app")).toBe("ES");
    expect(resolveMarketCountry("localhost:3026")).toBe("ES");
  });

  test("UI locale is not a market: every locale on rovaro.es is still ES", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    for (const locale of ["en", "ca", "es", "fr", "pt", "it", "sv", "no", "el"]) {
      expect(
        resolveMarketCountry(requestFrom(`https://rovaro.es/${locale}/transfer`))
      ).toBe("ES");
    }
  });

  test("the locale in the path never moves the market", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    // "es" is a locale here, not the Spanish market.
    expect(
      resolveMarketCountry(requestFrom("https://carsnk.gr/es/transfer"))
    ).toBe("GR");
    expect(
      resolveMarketCountry(requestFrom("https://carsnk.gr/ca/transfer"))
    ).toBe("GR");
  });

  test("normalizes only markets this platform serves", () => {
    expect(normalizeMarketCountry("es")).toBe("ES");
    expect(normalizeMarketCountry(" gr ")).toBe("GR");
    expect(normalizeMarketCountry("US")).toBe("");
    expect(normalizeMarketCountry("")).toBe("");
    expect(MARKET_COUNTRY_CODES).toEqual(expect.arrayContaining(["GR", "ES"]));
  });

  test("isSameMarket refuses unknown codes on both sides", () => {
    expect(isSameMarket("ES", "es")).toBe(true);
    expect(isSameMarket("ES", "GR")).toBe(false);
    expect(isSameMarket("", "")).toBe(false);
    expect(isSameMarket("PT", "PT")).toBe(false);
  });
});
