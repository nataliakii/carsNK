/**
 * @jest-environment node
 */
import {
  buildLocationSnapshot,
  locationCacheKeyPart,
} from "@/domain/transfers/locationSnapshot";
import { toGooglePlaceQuery } from "@/domain/transfers/transferLocations";

describe("transfer location cache keys", () => {
  test("missing lat/lng use name keys, not Null Island geo:0,0", () => {
    const snap = buildLocationSnapshot({
      placeName: "Malaga Airport",
      country: "ES",
    });
    expect(snap.lat).toBeNull();
    expect(snap.lng).toBeNull();
    expect(locationCacheKeyPart(snap)).toBe("name:malaga airport");
    expect(locationCacheKeyPart(snap)).not.toMatch(/geo:0/);
  });

  test("explicit 0,0 coords still fall back to name", () => {
    const snap = buildLocationSnapshot({
      placeName: "Unknown",
      lat: 0,
      lng: 0,
    });
    expect(locationCacheKeyPart(snap)).toBe("name:unknown");
  });

  test("real coordinates use geo keys", () => {
    const snap = buildLocationSnapshot({
      placeName: "Barcelona",
      lat: 41.3874,
      lng: 2.1686,
    });
    expect(locationCacheKeyPart(snap)).toBe("geo:41.38740,2.16860");
  });
});

describe("toGooglePlaceQuery country bias", () => {
  test("Spanish places are not rewritten to Halkidiki", () => {
    expect(toGooglePlaceQuery("Malaga Airport", "ES")).toBe(
      "Malaga Airport, Spain"
    );
    expect(toGooglePlaceQuery("Marbella", "ES")).toBe("Marbella, Spain");
    expect(toGooglePlaceQuery("Malaga Airport", "ES")).not.toMatch(
      /Thessaloniki|Halkidiki/i
    );
  });

  test("Greek airport shortcut still maps SKG", () => {
    expect(toGooglePlaceQuery("Thessaloniki Airport", "GR")).toBe(
      "Thessaloniki Airport SKG, Greece"
    );
    expect(toGooglePlaceQuery("Nikiti", "GR")).toBe("Nikiti, Halkidiki, Greece");
  });

  test("lat,lng queries are not country-suffixed", () => {
    expect(toGooglePlaceQuery("41.3874, 2.1686", "ES")).toBe("41.3874,2.1686");
    expect(toGooglePlaceQuery("36.675,-4.499", "GR")).toBe("36.675,-4.499");
  });

  test("unknown country does not invent Halkidiki", () => {
    expect(toGooglePlaceQuery("Malaga Airport", "XX")).toBe("Malaga Airport");
    expect(toGooglePlaceQuery("Malaga Airport", "XX")).not.toMatch(/Halkidiki/i);
  });
});
