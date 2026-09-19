/**
 * @jest-environment node
 */

import {
  carMatchesRegionFilter,
  normalizeSearchDates,
  toSearchDateKey,
} from "../carDateSearch";

describe("carDateSearch helpers", () => {
  test("toSearchDateKey formats valid dates", () => {
    expect(toSearchDateKey("2026-09-20")).toBe("2026-09-20");
    expect(toSearchDateKey(null)).toBeNull();
  });

  test("normalizeSearchDates keeps YYYY-MM-DD", () => {
    expect(
      normalizeSearchDates({ start: "2026-09-20", end: "2026-09-25" })
    ).toEqual({ start: "2026-09-20", end: "2026-09-25" });
  });

  test("carMatchesRegionFilter All / empty map", () => {
    expect(carMatchesRegionFilter("All", "abc", {})).toBe(true);
    expect(carMatchesRegionFilter("Madrid", "abc", {})).toBe(true);
  });

  test("carMatchesRegionFilter matches owner", () => {
    const map = { Madrid: ["owner1"], Barcelona: ["owner2"] };
    expect(carMatchesRegionFilter("Madrid", "owner1", map)).toBe(true);
    expect(carMatchesRegionFilter("Madrid", "owner2", map)).toBe(false);
    expect(carMatchesRegionFilter("Unknown", "owner1", map)).toBe(false);
  });
});
