/**
 * @jest-environment node
 */
import {
  buildCarTitle,
  getMinPriceFromTiers,
  mapCarToAggregatorDto,
} from "@/domain/aggregator/mapCarToAggregatorDto";

describe("aggregator car DTO", () => {
  test("buildCarTitle capitalizes model and transmission", () => {
    expect(buildCarTitle("toyota yaris", "automatic")).toBe(
      "Toyota Yaris Automatic"
    );
  });

  test("getMinPriceFromTiers finds minimum", () => {
    expect(
      getMinPriceFromTiers({
        NoSeason: { days: { 4: 50, 7: 40 } },
        HighSeason: { days: { 4: 80, 7: 70 } },
      })
    ).toBe(40);
  });

  test("mapCarToAggregatorDto maps core fields", () => {
    const dto = mapCarToAggregatorDto(
      {
        _id: "670bb226223dd911f059528a",
        carNumber: "3",
        model: "Opel Karl",
        transmission: "manual",
        slug: "opel-karl-manual",
        class: "economy",
        fueltype: "petrol",
        seats: 4,
        photoUrl: "carsnk/cars/opel",
        pricingTiers: { NoSeason: { days: { 4: 35 } } },
      },
      { includePricing: true }
    );
    expect(dto.id).toBe("670bb226223dd911f059528a");
    expect(dto.title).toBe("Opel Karl Manual");
    expect(dto.priceFrom).toBe(35);
    expect(dto.pricingTiers.NoSeason["4"]).toBe(35);
    expect(dto.bookingUrl).toBe(
      "https://carsnk.gr/en/cars/opel-karl-manual"
    );
  });
});
