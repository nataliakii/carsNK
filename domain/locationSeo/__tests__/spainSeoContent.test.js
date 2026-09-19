/**
 * @jest-environment node
 */

process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";

const {
  getSpainHubSeo,
  getSpainPrimaryLocationForJsonLd,
  resolveSpainSeoLang,
} = require("../spainSeoContent");

describe("spain SEO content", () => {
  test("resolves es vs en", () => {
    expect(resolveSpainSeoLang("es")).toBe("es");
    expect(resolveSpainSeoLang("en")).toBe("en");
    expect(resolveSpainSeoLang("de")).toBe("en");
  });

  test("EN hub mentions Spain and brand", () => {
    const hub = getSpainHubSeo("en");
    expect(hub.seoTitle.toLowerCase()).toContain("spain");
    expect(hub.seoDescription.toLowerCase()).toContain("spain");
    expect(hub.seoTitle.toLowerCase()).toContain("rovaro");
  });

  test("ES hub is Spanish", () => {
    const hub = getSpainHubSeo("es");
    expect(hub.seoTitle.toLowerCase()).toContain("españa");
    expect(hub.seoDescription.toLowerCase()).toContain("españa");
    expect(hub.h1.toLowerCase()).toContain("españa");
  });

  test("JSON-LD primary location is Spain-scoped", () => {
    const loc = getSpainPrimaryLocationForJsonLd("es");
    expect(loc.areaServed).toContain("Spain");
    expect(loc.pickupLocation).toBe("España");
  });
});
