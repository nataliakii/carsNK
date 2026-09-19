/**
 * @jest-environment node
 */

process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";

const {
  SPAIN_LOCATIONS,
  SPAIN_SEO_LOCALES,
  getSpainLocationBySlug,
  getSpainLocationGroupsForNav,
  getSpainLocationPath,
  resolveSpainLocationLocale,
} = require("../spainLocations");

describe("spainLocations", () => {
  test("has Barcelona and Costa Brava", () => {
    expect(SPAIN_LOCATIONS.map((l) => l.id)).toEqual([
      "barcelona",
      "costa-brava",
    ]);
  });

  test("supports eight SEO locales", () => {
    expect(SPAIN_SEO_LOCALES).toEqual([
      "en",
      "es",
      "ru",
      "uk",
      "de",
      "fr",
      "sv",
      "no",
    ]);
  });

  test("resolves localized slugs", () => {
    expect(getSpainLocationBySlug("es", "alquiler-coches-barcelona")?.id).toBe(
      "barcelona"
    );
    expect(getSpainLocationBySlug("en", "car-rental-costa-brava")?.id).toBe(
      "costa-brava"
    );
    expect(getSpainLocationBySlug("fr", "location-voiture-barcelone")?.id).toBe(
      "barcelona"
    );
  });

  test("nav groups return both destinations", () => {
    const groups = getSpainLocationGroupsForNav("es");
    expect(groups).toHaveLength(2);
    expect(groups[0].href).toContain("/es/locations/");
    expect(groups.map((g) => g.label)).toEqual(["Barcelona", "Costa Brava"]);
  });

  test("paths are locale-prefixed", () => {
    expect(getSpainLocationPath("sv", "barcelona")).toBe(
      "/sv/locations/hyrbil-barcelona"
    );
  });

  test("locale resolver falls back to en", () => {
    expect(resolveSpainLocationLocale("pt")).toBe("en");
    expect(resolveSpainLocationLocale("no")).toBe("no");
  });
});
