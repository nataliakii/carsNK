import {
  INDEXING_MODE,
  INDEXABLE_PATHS,
  getRobotsForPath,
  shouldIndexPath,
} from "../indexingPolicy";

describe("indexingPolicy", () => {
  test("always keeps the explicit allowlist indexable", () => {
    expect(shouldIndexPath("/en/locations/car-rental-thessaloniki")).toBe(true);
    expect(shouldIndexPath("/ru/locations/arenda-avto-saloniki")).toBe(true);
    expect(shouldIndexPath("/de/locations/mietwagen-thessaloniki")).toBe(true);
    expect(shouldIndexPath("/el/locations/enoikiasi-autokinitou-thessaloniki")).toBe(true);
  });

  test("applies the current indexing mode to non-allowlisted pages", () => {
    const blockedPath = "/en/cars";

    if (INDEXING_MODE === "allowlist") {
      expect(shouldIndexPath(blockedPath)).toBe(false);
      expect(shouldIndexPath("/en/locations/car-rental-halkidiki")).toBe(false);
      expect(getRobotsForPath(blockedPath)).toEqual({
        index: false,
        follow: true,
      });
      expect(INDEXABLE_PATHS.size).toBe(4);
      return;
    }

    expect(shouldIndexPath(blockedPath)).toBe(true);
    expect(getRobotsForPath(blockedPath)).toEqual({
      index: true,
      follow: true,
    });
  });
});
