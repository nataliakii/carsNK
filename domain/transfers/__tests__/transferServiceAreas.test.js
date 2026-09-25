/**
 * @jest-environment node
 *
 * Service areas are read with the market in the query and checked again in
 * memory. Legacy Greek rows stay in the database and simply never surface.
 */
jest.mock("@models/platformCity", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("@models/TransferZone", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

import PlatformCity from "@models/platformCity";
import TransferZone from "@models/TransferZone";
import {
  listTransferLocationsForMarket,
  loadTransferServiceAreaNames,
} from "@/domain/transfers/transferServiceAreas";

function chainReturning(rows) {
  return {
    select: () => ({ lean: async () => rows }),
  };
}

function stub({ zones = [], cities = [] } = {}) {
  TransferZone.find.mockImplementation(() => chainReturning(zones));
  PlatformCity.find.mockImplementation(() => chainReturning(cities));
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("loadTransferServiceAreaNames", () => {
  test("queries both collections scoped to the market", async () => {
    stub({
      zones: [{ name: "Costa Brava", country: "ES" }],
      cities: [{ name: "Girona", country: "ES" }],
    });
    const names = await loadTransferServiceAreaNames("ES");
    expect(names).toEqual(["Costa Brava", "Girona"]);
    for (const model of [TransferZone, PlatformCity]) {
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ country: "ES" })
      );
    }
  });

  test("drops rows whose country does not match, even if the driver returns them", async () => {
    stub({
      zones: [
        { name: "Kassandra", country: "GR" },
        { name: "Costa Brava", country: "ES" },
      ],
      cities: [{ name: "Halkidiki", country: "GR" }],
    });
    expect(await loadTransferServiceAreaNames("ES")).toEqual(["Costa Brava"]);
  });

  test("an unserved market never reaches the database", async () => {
    stub({ zones: [{ name: "Anything", country: "PT" }] });
    expect(await loadTransferServiceAreaNames("PT")).toEqual([]);
    expect(TransferZone.find).not.toHaveBeenCalled();
    expect(PlatformCity.find).not.toHaveBeenCalled();
  });
});

describe("listTransferLocationsForMarket", () => {
  test("merges curated Spanish places with ES service areas and no Greek ones", async () => {
    stub({
      zones: [{ name: "Costa Brava", country: "ES" }],
      cities: [
        { name: "Girona", country: "ES" },
        { name: "Kriopigi", country: "GR" },
      ],
    });
    const names = (await listTransferLocationsForMarket("ES")).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Barcelona", "Costa Brava"]));
    for (const leak of [
      "Afitos",
      "Agios Nikolaos Halkidiki",
      "Fourka",
      "Halkidiki",
      "Hanioti",
      "Kallithea",
      "Kassandra",
      "Kassandria",
      "Kriopigi",
    ]) {
      expect(names).not.toContain(leak);
    }
  });

  test("a market with no catalog and no service areas returns nothing", async () => {
    stub();
    expect(await listTransferLocationsForMarket("PT")).toEqual([]);
  });

  test("a failed service-area read narrows to the curated market list", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    TransferZone.find.mockImplementation(() => {
      throw new Error("mongo down");
    });
    PlatformCity.find.mockImplementation(() => chainReturning([]));
    const names = (await listTransferLocationsForMarket("ES")).map((r) => r.name);
    expect(names).toContain("Barcelona");
    expect(names).not.toContain("Afitos");
  });

  test("Greece still gets its own catalog", async () => {
    stub({ cities: [{ name: "Nea Kallikratia", country: "GR" }] });
    const names = (await listTransferLocationsForMarket("GR")).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Afitos", "Nea Kallikratia"]));
    expect(names).not.toContain("Barcelona");
  });
});
