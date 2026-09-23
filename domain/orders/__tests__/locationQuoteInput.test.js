import { parseLocationQuoteInput } from "../locationQuoteInput";

describe("location quote input trust boundary", () => {
  test("ignores client coordinates, distance and price", () => {
    const parsed = parseLocationQuoteInput({
      location: {
        pickup: {
          kind: "delivery",
          placeId: "ChIJ",
          lat: 1,
          lon: 2,
          fee: 999,
          distanceKm: 3,
        },
        return: { sameAsPickup: true, fee: 50 },
      },
    });
    expect(parsed.pickup.placeId).toBe("ChIJ");
    expect(parsed.pickup.lat).toBeUndefined();
    expect(parsed.pickup.fee).toBeUndefined();
    expect(parsed.pickup.distanceKm).toBeUndefined();
    expect(parsed.dropoff.sameAsPickup).toBe(true);
  });
});
