/**
 * @jest-environment node
 */

import { toGoogleTranslateTarget } from "../googleTranslate";

describe("toGoogleTranslateTarget", () => {
  it("maps Norwegian variants to Google's `no`", () => {
    expect(toGoogleTranslateTarget("nb")).toBe("no");
    expect(toGoogleTranslateTarget("nn-NO")).toBe("no");
  });

  it("keeps our UI codes that Google already uses", () => {
    expect(toGoogleTranslateTarget("es")).toBe("es");
    expect(toGoogleTranslateTarget("uk")).toBe("uk");
    expect(toGoogleTranslateTarget("el")).toBe("el");
    expect(toGoogleTranslateTarget("sr")).toBe("sr");
  });
});

describe("translateToLocales", () => {
  const originalTranslate = process.env.GOOGLE_TRANSLATE_API_KEY;
  const originalMaps = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_TRANSLATE_API_KEY = "test-translate-key";
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    process.env.GOOGLE_TRANSLATE_API_KEY = originalTranslate;
    process.env.GOOGLE_MAPS_API_KEY = originalMaps;
    jest.restoreAllMocks();
  });

  it("fills every target and reports a failed language without aborting", async () => {
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.target === "ru") {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "bad target" } }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            translations: [{ translatedText: `${body.target}:${body.q}` }],
          },
        }),
      };
    });

    const { translateToLocales } = await import("../googleTranslate");
    const result = await translateToLocales({
      text: "Hello",
      targets: ["es", "ru", "en"],
      concurrency: 2,
    });

    expect(result.translations.es).toBe("es:Hello");
    expect(result.translations.en).toBeUndefined();
    expect(result.failed).toEqual([
      { language: "ru", message: "bad target" },
    ]);
  });

  it("uses GOOGLE_TRANSLATE_API_KEY before the Maps key", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "maps-key";
    global.fetch = jest.fn(async (url) => {
      expect(String(url)).toContain("test-translate-key");
      expect(String(url)).not.toContain("maps-key");
      return {
        ok: true,
        json: async () => ({
          data: { translations: [{ translatedText: "Hola" }] },
        }),
      };
    });
    const { translateText } = await import("../googleTranslate");
    await expect(
      translateText({ text: "Hello", target: "es" })
    ).resolves.toBe("Hola");
  });
});
