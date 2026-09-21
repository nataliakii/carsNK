/**
 * @jest-environment node
 */

import { resolveDefaultInsurance } from "../defaultInsurance";

describe("resolveDefaultInsurance", () => {
  test("uses CDW when the car has priced CDW", () => {
    expect(resolveDefaultInsurance({ PriceKacko: 5 })).toBe("CDW");
    expect(resolveDefaultInsurance({ PriceKacko: "7.5" })).toBe("CDW");
  });

  test("uses TPL when the car has no CDW price", () => {
    expect(resolveDefaultInsurance({})).toBe("TPL");
    expect(resolveDefaultInsurance({ PriceKacko: 0 })).toBe("TPL");
    expect(resolveDefaultInsurance({ PriceKacko: null })).toBe("TPL");
    expect(resolveDefaultInsurance(undefined)).toBe("TPL");
  });
});
