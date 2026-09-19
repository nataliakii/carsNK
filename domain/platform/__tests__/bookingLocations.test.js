import {
  canonicalizeBookingLocation,
  isAllowedBookingLocation,
  isAirportBookingLocation,
  locationRequiresAddressDetail,
  resolveBookingLocationOrDefault,
} from "../bookingLocations";

describe("company booking locations", () => {
  const names = ["Airport", "Madrid", "Valencia"];
  const cities = [
    { name: "Airport", kind: "airport" },
    { name: "Madrid", requiresAddressDetail: true },
    { name: "Valencia" },
  ];

  test("allows only company cities", () => {
    expect(isAllowedBookingLocation("madrid", names)).toBe(true);
    expect(isAllowedBookingLocation("Thessaloniki", names)).toBe(false);
    expect(canonicalizeBookingLocation("MADRID", names)).toBe("Madrid");
  });

  test("requires address detail from catalog", () => {
    expect(locationRequiresAddressDetail("Madrid", cities)).toBe(true);
    expect(locationRequiresAddressDetail("Valencia", cities)).toBe(false);
  });

  test("detects airport by kind or name", () => {
    expect(isAirportBookingLocation("Airport", cities)).toBe(true);
    expect(isAirportBookingLocation("Valencia", cities)).toBe(false);
  });

  test("falls back to first company city", () => {
    expect(resolveBookingLocationOrDefault("unknown", names, "Madrid")).toBe(
      "Madrid"
    );
    expect(resolveBookingLocationOrDefault("", names)).toBe("Airport");
  });
});
