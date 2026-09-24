/**
 * @jest-environment node
 */
jest.mock("@/domain/geo/googlePlaces", () => {
  const actual = jest.requireActual("@/domain/geo/googlePlaces");
  return {
    ...actual,
    fetchPlaceDetails: jest.fn(),
  };
});
jest.mock("@/domain/delivery/calculateDeliveryPrice", () => ({
  calculateDeliveryPrice: jest.fn(),
}));

import mongoose from "mongoose";
import { fetchPlaceDetails } from "@/domain/geo/googlePlaces";
import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import {
  LocationQuoteError,
  quoteAuthoritativeLocations,
} from "../authoritativeLocationQuote";
import { persistOfficeShape } from "@/domain/company/officeRecord";

const companyId = new mongoose.Types.ObjectId();
const office = persistOfficeShape(
  {
    name: "Rovaro BCN",
    address: "Carrer de Mallorca 1, Barcelona",
    city: "Barcelona",
    country: "ES",
    locationType: "office",
    status: "active",
    freePickup: true,
    freeReturn: true,
  },
  { assignId: true }
);
const company = {
  _id: companyId,
  country: "ES",
  tel: "+34911",
  offices: [office],
  deliveryPricing: { strategy: "cities", operatingCities: ["Barcelona"] },
};
const car = { ownerId: companyId, officeScope: "all" };

beforeEach(() => {
  jest.clearAllMocks();
  calculateDeliveryPrice.mockResolvedValue({
    deliveryIn: 25,
    deliveryOut: 15,
    deliveryTotal: 40,
    pickupMeta: { distanceKm: 8 },
    returnMeta: { distanceKm: 6 },
  });
});

describe("authoritative location quote", () => {
  test("official free office produces a zero location fee", async () => {
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: { kind: "office", officeId: office._id },
      dropoff: { kind: "office", officeId: office._id, sameAsPickup: true },
    });
    expect(quote.snapshot.pickup.feeMajor).toBe(0);
    expect(quote.snapshot.return.feeMajor).toBe(0);
    expect(quote.snapshot.pickup.address).toContain("Mallorca");
    expect(calculateDeliveryPrice).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: String(companyId) })
    );
  });

  test("verified custom address produces a server-calculated fee", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: true,
      configured: true,
      placeId: "ChIJhotel",
      address: "Hotel Arts, Barcelona",
      lat: 41.387,
      lon: 2.17,
      locality: "Barcelona",
      country: "ES",
    });
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: { kind: "delivery", placeId: "ChIJhotel", lat: 9, lon: 9, fee: 1, distanceKm: 1 },
      dropoff: { sameAsPickup: true },
    });
    expect(quote.snapshot.pickup.kind).toBe("delivery");
    expect(quote.snapshot.pickup.feeMajor).toBe(25);
    expect(quote.snapshot.pickup.placeId).toBe("ChIJhotel");
    expect(quote.snapshot.pickup.lat).toBe(41.387);
    expect(fetchPlaceDetails).toHaveBeenCalledWith(
      expect.objectContaining({ placeId: "ChIJhotel" })
    );
  });

  test("Google country long name Spain matches company country ES", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: true,
      configured: true,
      placeId: "ChIJhotel",
      address: "Hotel Arts, Barcelona",
      lat: 41.387,
      lon: 2.17,
      locality: "Barcelona",
      country: "Spain",
    });
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: { kind: "delivery", placeId: "ChIJhotel" },
      dropoff: { sameAsPickup: true },
    });
    expect(quote.snapshot.pickup.feeMajor).toBe(25);
    expect(quote.snapshot.pickup.placeId).toBe("ChIJhotel");
  });

  test("raw unverified address is rejected", async () => {
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "UNVERIFIED_ADDRESS" });
    expect(calculateDeliveryPrice).not.toHaveBeenCalled();
  });

  test("manual typed address is accepted when Places cannot verify", async () => {
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: {
        kind: "delivery",
        placeId: "manual:" + encodeURIComponent("Carrer de Provença 100, Barcelona"),
        address: "Carrer de Provença 100, Barcelona",
        cityName: "Barcelona",
      },
      dropoff: { sameAsPickup: true },
    });
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
    expect(quote.snapshot.pickup.address).toContain("Provença");
    expect(quote.snapshot.pickup.placeId.startsWith("manual:")).toBe(true);
    expect(calculateDeliveryPrice).toHaveBeenCalled();
  });

  test("client-supplied coordinates, distance and price are ignored", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: true,
      configured: true,
      placeId: "ChIJstreet",
      address: "Carrer Provença 100",
      lat: 41.4,
      lon: 2.16,
      locality: "Barcelona",
      country: "ES",
    });
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: {
        kind: "delivery",
        placeId: "ChIJstreet",
        lat: 1,
        lon: 1,
        fee: 999,
        distanceKm: 0,
      },
      dropoff: { sameAsPickup: true },
    });
    expect(quote.snapshot.pickup.lat).toBe(41.4);
    expect(quote.snapshot.pickup.feeMajor).toBe(25);
    expect(quote.snapshot.pickup.feeMajor).not.toBe(999);
  });

  test("unsupported country/city/service area is rejected", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: true,
      configured: true,
      placeId: "ChIJparis",
      address: "Paris",
      lat: 48.8,
      lon: 2.3,
      locality: "Paris",
      country: "FR",
    });
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "ChIJparis" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "LOCATION_COUNTRY_MISMATCH" });
  });

  test("pickup and return fees are calculated separately", async () => {
    fetchPlaceDetails
      .mockResolvedValueOnce({
        ok: true,
        configured: true,
        placeId: "p1",
        address: "Hotel A",
        lat: 41.39,
        lon: 2.16,
        locality: "Barcelona",
        country: "ES",
      })
      .mockResolvedValueOnce({
        ok: true,
        configured: true,
        placeId: "p2",
        address: "Hotel B",
        lat: 41.4,
        lon: 2.17,
        locality: "Barcelona",
        country: "ES",
      });
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: { kind: "delivery", placeId: "p1" },
      dropoff: { kind: "delivery", placeId: "p2" },
    });
    expect(quote.snapshot.pickup.feeMajor).toBe(25);
    expect(quote.snapshot.return.feeMajor).toBe(15);
    expect(quote.snapshot.pickup.placeId).toBe("p1");
    expect(quote.snapshot.return.placeId).toBe("p2");
  });

  test("Places unavailable is an error, not a zero fee", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: false,
      configured: false,
    });
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "x" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toBeInstanceOf(LocationQuoteError);
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "x" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      message: expect.stringMatching(/could not verify this address automatically/i),
    });
  });

  test("Places referer-denied / unavailable flag is recoverable PLACES_UNAVAILABLE", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: false,
      configured: true,
      unavailable: true,
      reason: "referer_restricted",
      message: "Places server key is blocked by HTTP-referrer restrictions",
    });
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "ChIJanything" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({
      code: "PLACES_UNAVAILABLE",
      message: expect.stringMatching(/try again or choose an office/i),
    });
  });

  test("official office booking works when Places is unavailable", async () => {
    fetchPlaceDetails.mockResolvedValue({
      ok: false,
      configured: false,
    });
    const quote = await quoteAuthoritativeLocations({
      car,
      company,
      pickup: { kind: "office", officeId: office._id },
      dropoff: { kind: "office", officeId: office._id, sameAsPickup: true },
    });
    expect(quote.snapshot.pickup.feeMajor).toBe(0);
    expect(quote.snapshot.return.feeMajor).toBe(0);
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
  });

  test("Spain delivery without placeId is rejected before Places is called", async () => {
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "delivery", placeId: "" },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "UNVERIFIED_ADDRESS" });
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
  });

  test("another company's office id is rejected", async () => {
    await expect(
      quoteAuthoritativeLocations({
        car,
        company,
        pickup: { kind: "office", officeId: new mongoose.Types.ObjectId() },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "UNKNOWN_OFFICE" });
  });

  test("same or different eligible offices of the same owner stay free", async () => {
    const officeB = persistOfficeShape(
      {
        name: "Airport desk",
        address: "BCN T1",
        city: "El Prat",
        country: "ES",
        status: "active",
      },
      { assignId: true }
    );
    const multi = {
      ...company,
      offices: [office, officeB],
    };
    const same = await quoteAuthoritativeLocations({
      car,
      company: multi,
      pickup: { kind: "office", officeId: office._id },
      dropoff: { kind: "office", officeId: office._id },
    });
    expect(same.snapshot.pickup.feeMajor).toBe(0);
    expect(same.snapshot.return.feeMajor).toBe(0);

    const different = await quoteAuthoritativeLocations({
      car,
      company: multi,
      pickup: { kind: "office", officeId: office._id },
      dropoff: { kind: "office", officeId: officeB._id },
    });
    expect(different.snapshot.pickup.feeMajor).toBe(0);
    expect(different.snapshot.return.feeMajor).toBe(0);
    expect(different.snapshot.return.officeId).toBe(String(officeB._id));
  });

  test("inactive, ineligible and archived offices are rejected", async () => {
    const archived = persistOfficeShape(
      {
        name: "Old desk",
        address: "X",
        country: "ES",
        status: "archived",
      },
      { assignId: true }
    );
    const inactiveCompany = {
      ...company,
      offices: [office, archived],
    };
    await expect(
      quoteAuthoritativeLocations({
        car,
        company: inactiveCompany,
        pickup: { kind: "office", officeId: archived._id },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "UNKNOWN_OFFICE" });

    await expect(
      quoteAuthoritativeLocations({
        car: {
          ownerId: companyId,
          officeScope: "selected",
          officeIds: [office._id],
        },
        company: {
          ...company,
          offices: [
            office,
            persistOfficeShape(
              {
                name: "Not on car",
                address: "Y",
                country: "ES",
                status: "active",
              },
              { assignId: true }
            ),
          ],
        },
        pickup: {
          kind: "office",
          officeId: company.offices?.[0]?._id || office._id,
        },
        dropoff: { sameAsPickup: true },
      })
    ).resolves.toMatchObject({ ok: true });

    const otherOffice = persistOfficeShape(
      {
        name: "Not eligible",
        address: "Z",
        country: "ES",
        status: "active",
      },
      { assignId: true }
    );
    await expect(
      quoteAuthoritativeLocations({
        car: {
          ownerId: companyId,
          officeScope: "selected",
          officeIds: [office._id],
        },
        company: { ...company, offices: [office, otherOffice] },
        pickup: { kind: "office", officeId: otherOffice._id },
        dropoff: { sameAsPickup: true },
      })
    ).rejects.toMatchObject({ code: "UNKNOWN_OFFICE" });
  });
});
