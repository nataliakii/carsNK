/**
 * @jest-environment node
 */

import {
  applyFlatDailyRateToPricingTiers,
  companyUsesSeasons,
  getFlatDailyRateFromPricingTiers,
} from "../flatDailyRate";

describe("flatDailyRate", () => {
  test("companyUsesSeasons defaults to true", () => {
    expect(companyUsesSeasons(undefined)).toBe(true);
    expect(companyUsesSeasons({})).toBe(true);
    expect(companyUsesSeasons({ useSeasons: true })).toBe(true);
    expect(companyUsesSeasons({ useSeasons: false })).toBe(false);
  });

  test("getFlatDailyRateFromPricingTiers prefers NoSeason key 4", () => {
    expect(
      getFlatDailyRateFromPricingTiers({
        NoSeason: { days: { 4: 50, 7: 40, 14: 30 } },
        HighSeason: { days: { 4: 99 } },
      })
    ).toBe(50);
  });

  test("getFlatDailyRateFromPricingTiers falls back to key 1", () => {
    expect(
      getFlatDailyRateFromPricingTiers({
        NoSeason: { days: { 1: 45, 7: 40 } },
      })
    ).toBe(45);
  });

  test("applyFlatDailyRateToPricingTiers mirrors one rate to all seasons", () => {
    const next = applyFlatDailyRateToPricingTiers(
      { NoSeason: { days: { 4: 10 } } },
      55
    );
    expect(next.NoSeason.days).toEqual({ 4: 55, 7: 55, 14: 55 });
    expect(next.HighSeason.days).toEqual({ 4: 55, 7: 55, 14: 55 });
    expect(next.LowUpSeason.days["4"]).toBe(55);
  });
});
