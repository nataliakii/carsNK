/**
 * @jest-environment node
 */

const GREECE_LEAK = /Halkidiki|Thessaloniki|Kallikratia|Χαλκιδικ/i;

describe("car SEO locations by deployment country", () => {
  const originalCountry = process.env.NEXT_PUBLIC_SITE_COUNTRY;

  afterEach(() => {
    if (originalCountry === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
    } else {
      process.env.NEXT_PUBLIC_SITE_COUNTRY = originalCountry;
    }
    jest.resetModules();
  });

  test("ES uses Barcelona and Costa Brava, never Greece places", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    jest.resetModules();
    const {
      getCarSeoPrimaryLocationName,
      getCarSeoPillarLinks,
      getCarSeoPickupLinks,
      buildCarSeoText,
    } = require("../locationSeoService");

    expect(getCarSeoPrimaryLocationName("en")).toBe("Barcelona");

    const pillars = getCarSeoPillarLinks("en");
    const pillarText = pillars.map((p) => `${p.label} ${p.href}`).join(" ");
    expect(pillarText).not.toMatch(GREECE_LEAK);
    expect(pillarText).toMatch(/Barcelona/i);
    expect(pillarText).toMatch(/Costa Brava/i);
    expect(pillars.every((p) => p.href.includes("/locations/"))).toBe(true);

    const pickup = getCarSeoPickupLinks("en");
    expect(pickup.map((p) => p.label).join(" ")).not.toMatch(GREECE_LEAK);

    const text = buildCarSeoText("en", {
      carModel: "Toyota Yaris",
      locationName: "Barcelona",
      transmission: "Automatic",
    });
    expect(text.h1Text).toBe("Rent Toyota Yaris in Barcelona");
    expect(text.introLongText).toMatch(/Barcelona/);
    expect(text.introLongText).not.toMatch(GREECE_LEAK);
    expect(JSON.stringify(text.faq)).not.toMatch(GREECE_LEAK);
    expect(JSON.stringify(text.whyRentBullets)).not.toMatch(GREECE_LEAK);
  });

  test("GR keeps Halkidiki as the car SEO location", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    jest.resetModules();
    const {
      getCarSeoPrimaryLocationName,
      getCarSeoPillarLinks,
      buildCarSeoText,
    } = require("../locationSeoService");

    expect(getCarSeoPrimaryLocationName("en")).toBe("Halkidiki");
    const pillars = getCarSeoPillarLinks("en");
    expect(pillars.map((p) => p.label).join(" ")).toMatch(/Halkidiki/i);

    const text = buildCarSeoText("en", {
      carModel: "Toyota Yaris",
      locationName: "Halkidiki",
    });
    expect(text.h1Text).toBe("Rent Toyota Yaris in Halkidiki");
    expect(JSON.stringify(text.faq)).toMatch(/Thessaloniki/i);
  });
});
