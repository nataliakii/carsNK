import {
  haversineKm,
  isWithinOrderRadius,
  parseLatLon,
} from "../haversineKm";
import { filterPlacesByOrderRadius } from "../../platform/companyBookingCities";

describe("haversineKm", () => {
  test("returns null for incomplete coords", () => {
    expect(haversineKm({ lat: 1 }, { lat: 2, lon: 3 })).toBeNull();
  });

  test("measures short Madrid–Barajas style distance", () => {
    const km = haversineKm(
      { lat: 40.4168, lon: -3.7038 },
      { lat: 40.4722, lon: -3.5608 }
    );
    expect(km).toBeGreaterThan(10);
    expect(km).toBeLessThan(20);
  });
});

describe("isWithinOrderRadius", () => {
  test("unlimited when radius empty", () => {
    expect(isWithinOrderRadius(null, 999)).toBe(true);
    expect(isWithinOrderRadius("", 999)).toBe(true);
  });

  test("enforces radius", () => {
    expect(isWithinOrderRadius(30, 29)).toBe(true);
    expect(isWithinOrderRadius(30, 31)).toBe(false);
  });
});

describe("filterPlacesByOrderRadius", () => {
  const company = {
    orderRadiusKm: 50,
    coords: { lat: "40.4", lon: "-3.7" },
  };

  test("keeps places without coords", () => {
    const places = [{ name: "Unknown" }, { name: "Near", coords: { lat: 40.45, lon: -3.7 } }];
    expect(filterPlacesByOrderRadius(places, company).map((p) => p.name)).toEqual([
      "Unknown",
      "Near",
    ]);
  });

  test("drops places far outside radius", () => {
    const places = [
      { name: "Near", coords: { lat: 40.45, lon: -3.7 } },
      { name: "Far", coords: { lat: 41.4, lon: -2.0 } },
    ];
    expect(filterPlacesByOrderRadius(places, company).map((p) => p.name)).toEqual([
      "Near",
    ]);
  });

  test("parseLatLon", () => {
    expect(parseLatLon({ lat: "1.5", lon: "2.5" })).toEqual({ lat: 1.5, lon: 2.5 });
    expect(parseLatLon({ lat: "x", lon: "2" })).toBeNull();
  });
});
