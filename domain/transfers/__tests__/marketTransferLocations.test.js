/**
 * @jest-environment node
 *
 * Transfer locations are per market. The Spanish market must never show or
 * accept the legacy Halkidiki catalog this codebase started with.
 */
import {
  assertTransferPlacesInMarket,
  curatedTransferLocationsForMarket,
  curatedDistanceKmForMarket,
  isTransferLocationAllowedInMarket,
  OUT_OF_MARKET_CODE,
  transferLocationMarketCountry,
} from "@/domain/transfers/marketTransferLocations";
import { getTransferLocationOptions } from "@/domain/transfers/transferLocations";

/** The exact names the Spain deployment was reported to be leaking. */
const REPORTED_GREEK_LEAKS = [
  "Afitos",
  "Agios Nikolaos",
  "Agios Nikolaos Halkidiki",
  "Fourka",
  "Halkidiki",
  "Hanioti",
  "Kallithea",
  "Kassandra",
  "Kassandria",
  "Kriopigi",
];

describe("Spanish market never returns a Greek location", () => {
  const names = curatedTransferLocationsForMarket("ES").map((row) => row.name);

  test.each(REPORTED_GREEK_LEAKS)("%s is absent from the ES catalog", (leak) => {
    expect(names).not.toContain(leak);
    expect(
      names.some((name) => name.toLowerCase() === leak.toLowerCase())
    ).toBe(false);
  });

  test("no ES option mentions Halkidiki or Thessaloniki at all", () => {
    for (const name of names) {
      expect(name).not.toMatch(/halkidiki|chalkidiki|thessaloniki/i);
    }
  });

  test.each(REPORTED_GREEK_LEAKS)("%s is rejected as an ES place", (leak) => {
    expect(isTransferLocationAllowedInMarket(leak, "ES")).toBe(false);
    expect(transferLocationMarketCountry(leak)).toBe("GR");
  });

  test("the ES catalog is a real Spanish list", () => {
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual(expect.arrayContaining(["Barcelona", "Madrid"]));
  });
});

describe("curatedTransferLocationsForMarket", () => {
  test("GR keeps the legacy Halkidiki catalog", () => {
    const names = curatedTransferLocationsForMarket("GR").map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Afitos", "Halkidiki"]));
    expect(names).not.toContain("Barcelona");
  });

  test("a market with no configured catalog gets nothing, not another market's data", () => {
    for (const unconfigured of ["PT", "FR", "", null, undefined, "ALL"]) {
      expect(curatedTransferLocationsForMarket(unconfigured)).toEqual([]);
    }
  });

  test("curated distances stay inside their market", () => {
    expect(curatedDistanceKmForMarket("Thessaloniki", "GR")).toBe(17);
    expect(curatedDistanceKmForMarket("Thessaloniki", "ES")).toBeNull();
    expect(curatedDistanceKmForMarket("Afitos", "ES")).toBeNull();
  });

  test("getTransferLocationOptions honours an explicit market", () => {
    expect(getTransferLocationOptions("ES").map((r) => r.name)).not.toContain(
      "Kriopigi"
    );
    expect(getTransferLocationOptions("GR").map((r) => r.name)).toContain(
      "Kriopigi"
    );
  });
});

describe("transferLocationMarketCountry", () => {
  test("recognises Spanish places", () => {
    expect(transferLocationMarketCountry("Barcelona")).toBe("ES");
    expect(transferLocationMarketCountry("Lloret de Mar")).toBe("ES");
    expect(transferLocationMarketCountry("Girona Airport")).toBe("ES");
  });

  test("leaves free text and generic labels unclaimed", () => {
    expect(transferLocationMarketCountry("Carrer de Mallorca 401")).toBe("");
    expect(transferLocationMarketCountry("Airport")).toBe("");
    expect(transferLocationMarketCountry("")).toBe("");
  });

  test("free text stays bookable in its market", () => {
    expect(isTransferLocationAllowedInMarket("Hotel Arts, Barcelona", "ES")).toBe(
      true
    );
    expect(isTransferLocationAllowedInMarket("Afitos Beach Hotel", "ES")).toBe(
      false
    );
  });

  test("nothing at all is allowed in an unconfigured market", () => {
    expect(isTransferLocationAllowedInMarket("Barcelona", "PT")).toBe(false);
  });
});

describe("assertTransferPlacesInMarket", () => {
  test("accepts an in-market trip", () => {
    expect(
      assertTransferPlacesInMarket(
        { from: "Barcelona Airport", to: "Lloret de Mar" },
        "ES"
      )
    ).toEqual({ ok: true });
  });

  test("rejects a Greek pickup on the Spanish market", () => {
    const result = assertTransferPlacesInMarket(
      { from: "Kassandra", to: "Barcelona" },
      "ES"
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe(OUT_OF_MARKET_CODE);
    expect(result.field).toBe("from");
  });

  test("rejects a Greek name smuggled through nested fields", () => {
    expect(
      assertTransferPlacesInMarket(
        {
          from: "Barcelona",
          to: "Madrid",
          origin: { placeName: "Barcelona", city: "Hanioti" },
        },
        "ES"
      ).ok
    ).toBe(false);

    expect(
      assertTransferPlacesInMarket(
        {
          from: "Barcelona",
          to: "Madrid",
          destination: { placeName: "Pefkohori" },
        },
        "ES"
      ).ok
    ).toBe(false);

    expect(
      assertTransferPlacesInMarket(
        {
          from: "Barcelona",
          to: "Madrid",
          additionalStops: [{ placeName: "Nea Moudania" }],
        },
        "ES"
      ).ok
    ).toBe(false);
  });

  test("rejects a Greek stop written in the modelled location shape", () => {
    const byPlaceName = assertTransferPlacesInMarket(
      {
        from: "Barcelona",
        to: "Madrid",
        additionalStops: [{ location: { placeName: "Nea Moudania" } }],
      },
      "ES"
    );
    expect(byPlaceName.ok).toBe(false);
    expect(byPlaceName.field).toBe("additionalStops.0.location");

    const byCity = assertTransferPlacesInMarket(
      {
        from: "Barcelona",
        to: "Madrid",
        additionalStops: [
          { location: { placeName: "A hotel", city: "Kriopigi" } },
        ],
      },
      "ES"
    );
    expect(byCity.ok).toBe(false);
    expect(byCity.field).toBe("additionalStops.0.location.city");
  });

  test("an in-market stop in either shape is accepted", () => {
    expect(
      assertTransferPlacesInMarket(
        {
          from: "Barcelona",
          to: "Madrid",
          additionalStops: [
            { location: { placeName: "Sitges", city: "Sitges" } },
            { placeName: "Tarragona" },
            "Girona",
          ],
        },
        "ES"
      )
    ).toEqual({ ok: true });
  });

  test("rejects everything when the market is unknown", () => {
    const result = assertTransferPlacesInMarket(
      { from: "Barcelona", to: "Madrid" },
      "PT"
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe(OUT_OF_MARKET_CODE);
  });

  test("the Greek market still works where it is legitimately used", () => {
    expect(
      assertTransferPlacesInMarket(
        { from: "Thessaloniki Airport", to: "Kriopigi" },
        "GR"
      )
    ).toEqual({ ok: true });
  });
});
