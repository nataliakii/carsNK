/**
 * @jest-environment node
 */
import {
  toMinorUnits,
  fromMinorUnits,
  addMinor,
  mulMinor,
  roundToIncrement,
} from "../minorUnits";

describe("minorUnits", () => {
  test("converts EUR major ↔ minor", () => {
    expect(toMinorUnits(12.34)).toBe(1234);
    expect(fromMinorUnits(1234)).toBe(12.34);
  });

  test("addMinor and mulMinor stay integer-safe", () => {
    expect(addMinor(100, 50, 25)).toBe(175);
    expect(mulMinor(1000, 1.5)).toBe(1500);
  });

  test("roundToIncrement", () => {
    expect(roundToIncrement(1234, 100)).toBe(1200);
    expect(roundToIncrement(1250, 100)).toBe(1300);
  });
});
