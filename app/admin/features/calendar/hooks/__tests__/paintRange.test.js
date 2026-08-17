import { clampPaintRange, isDateInInclusiveRange } from "../paintRange";

describe("clampPaintRange", () => {
  const blocked = new Set(["2026-08-20"]);
  const isPaintable = (d) => !blocked.has(d);

  test("returns origin when hover is origin", () => {
    expect(clampPaintRange("2026-08-18", "2026-08-18", () => true)).toEqual([
      "2026-08-18",
      "2026-08-18",
    ]);
  });

  test("walks forward until hover", () => {
    expect(clampPaintRange("2026-08-18", "2026-08-22", isPaintable)).toEqual([
      "2026-08-18",
      "2026-08-19",
    ]);
  });

  test("includes hover when the whole span is free", () => {
    expect(clampPaintRange("2026-08-18", "2026-08-22", () => true)).toEqual([
      "2026-08-18",
      "2026-08-22",
    ]);
  });

  test("walks backward until hover", () => {
    expect(clampPaintRange("2026-08-22", "2026-08-18", isPaintable)).toEqual([
      "2026-08-21",
      "2026-08-22",
    ]);
  });

  test("returns null when origin is not paintable", () => {
    expect(clampPaintRange("2026-08-20", "2026-08-22", isPaintable)).toBeNull();
  });
});

describe("isDateInInclusiveRange", () => {
  test("includes endpoints", () => {
    expect(isDateInInclusiveRange("2026-08-18", "2026-08-18", "2026-08-23")).toBe(
      true
    );
    expect(isDateInInclusiveRange("2026-08-23", "2026-08-18", "2026-08-23")).toBe(
      true
    );
  });

  test("normalizes reversed bounds", () => {
    expect(isDateInInclusiveRange("2026-08-20", "2026-08-23", "2026-08-18")).toBe(
      true
    );
  });
});
