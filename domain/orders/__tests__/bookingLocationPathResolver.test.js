import { LOCATION_IDS } from "@domain/locationSeo/locationSeoKeys";
import {
  getLocationById,
  getLocationPathFromLocation,
} from "@domain/locationSeo/locationSeoService";
import {
  resolveBookingLocationFromPathname,
  resolveBookingLocationFromPickupParam,
} from "../bookingLocationPathResolver";
import { DEFAULT_BOOKING_LOCATION } from "../locationOptions";

function getExpectedBookingLocation(locationId) {
  if (locationId === LOCATION_IDS.THESSALONIKI_AIRPORT) {
    return "Airport";
  }
  if (locationId === LOCATION_IDS.HALKIDIKI) {
    return DEFAULT_BOOKING_LOCATION;
  }

  return getLocationById("en", locationId)?.shortName ?? null;
}

describe("resolveBookingLocationFromPathname", () => {
  test.each(Object.values(LOCATION_IDS))(
    "resolves canonical English location path for %s",
    (locationId) => {
      const location = getLocationById("en", locationId);
      const pathname = getLocationPathFromLocation("en", location);

      expect(resolveBookingLocationFromPathname(pathname)).toBe(
        getExpectedBookingLocation(locationId)
      );
    }
  );

  test.each([
    ["de", LOCATION_IDS.NIKITI],
    ["de", LOCATION_IDS.AFITOS],
    ["el", LOCATION_IDS.THESSALONIKI_AIRPORT],
    ["ru", LOCATION_IDS.NEA_MOUDANIA],
  ])(
    "resolves localized canonical path for %s %s",
    (locale, locationId) => {
      const location = getLocationById(locale, locationId);
      const pathname = getLocationPathFromLocation(locale, location);

      expect(resolveBookingLocationFromPathname(pathname)).toBe(
        getExpectedBookingLocation(locationId)
      );
    }
  );

  test("returns null for non-location paths", () => {
    expect(resolveBookingLocationFromPathname("/en/cars")).toBeNull();
    expect(resolveBookingLocationFromPathname("/en")).toBeNull();
  });
});

describe("resolveBookingLocationFromPickupParam", () => {
  test("resolves airport and city canonical ids", () => {
    expect(
      resolveBookingLocationFromPickupParam(LOCATION_IDS.THESSALONIKI_AIRPORT)
    ).toBe("Airport");
    expect(resolveBookingLocationFromPickupParam(LOCATION_IDS.NIKITI)).toBe(
      "Nikiti"
    );
    expect(resolveBookingLocationFromPickupParam(LOCATION_IDS.HALKIDIKI)).toBe(
      DEFAULT_BOOKING_LOCATION
    );
  });

  test("returns null for empty / unknown", () => {
    expect(resolveBookingLocationFromPickupParam("")).toBeNull();
    expect(resolveBookingLocationFromPickupParam("not-a-place")).toBeNull();
  });

  test("resolves Spain SEO ids and slugs", () => {
    expect(resolveBookingLocationFromPickupParam("barcelona")).toBe(
      "Barcelona"
    );
    expect(resolveBookingLocationFromPickupParam("costa-brava")).toBe(
      "Costa Brava"
    );
  });
});

describe("resolveBookingLocationFromPathname Spain", () => {
  test("resolves Spain SEO landing paths", () => {
    expect(
      resolveBookingLocationFromPathname("/en/locations/car-rental-barcelona")
    ).toBe("Barcelona");
    expect(
      resolveBookingLocationFromPathname(
        "/es/locations/alquiler-coches-barcelona"
      )
    ).toBe("Barcelona");
    expect(
      resolveBookingLocationFromPathname("/en/locations/car-rental-costa-brava")
    ).toBe("Costa Brava");
  });
});
