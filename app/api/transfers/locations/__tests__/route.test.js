/**
 * @jest-environment node
 *
 * The public locations endpoint answers for one market only.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/platformCity", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("@models/TransferZone", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

import { connectToDB } from "@lib/database";
import PlatformCity from "@models/platformCity";
import TransferZone from "@models/TransferZone";
import { GET } from "../route";

const REPORTED_GREEK_LEAKS = [
  "Afitos",
  "Agios Nikolaos Halkidiki",
  "Fourka",
  "Halkidiki",
  "Hanioti",
  "Kallithea",
  "Kassandra",
  "Kassandria",
  "Kriopigi",
];

function chainReturning(rows) {
  return { select: () => ({ lean: async () => rows }) };
}

function locationsRequest(url) {
  return new Request(url, { method: "GET" });
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  connectToDB.mockResolvedValue(undefined);
  TransferZone.find.mockImplementation(() => chainReturning([]));
  PlatformCity.find.mockImplementation(() => chainReturning([]));
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

describe("GET /api/transfers/locations", () => {
  test("the Spain deployment returns ES places and no Greek ones", async () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    const res = await GET(locationsRequest("https://rovaro.es/api/transfers/locations"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.marketCountry).toBe("ES");
    const names = body.items.map((item) => item.name);
    expect(names).toEqual(expect.arrayContaining(["Barcelona", "Madrid"]));
    for (const leak of REPORTED_GREEK_LEAKS) {
      expect(names).not.toContain(leak);
    }
    expect(JSON.stringify(body)).not.toMatch(/halkidiki|thessaloniki/i);
  });

  test("a Greek row seeded in the database is excluded, not deleted", async () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    PlatformCity.find.mockImplementation(() =>
      chainReturning([
        { name: "Kriopigi", country: "GR" },
        { name: "Girona", country: "ES" },
      ])
    );
    const res = await GET(locationsRequest("https://rovaro.es/api/transfers/locations"));
    const body = await res.json();
    const names = body.items.map((item) => item.name);

    expect(names).toContain("Girona");
    expect(names).not.toContain("Kriopigi");
    expect(PlatformCity.find).toHaveBeenCalledWith(
      expect.objectContaining({ country: "ES" })
    );
  });

  test("the Greek deployment keeps its own catalog", async () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    const res = await GET(locationsRequest("https://carsnk.gr/api/transfers/locations"));
    const body = await res.json();
    const names = body.items.map((item) => item.name);

    expect(body.marketCountry).toBe("GR");
    expect(names).toEqual(expect.arrayContaining(["Afitos", "Thessaloniki"]));
    expect(names).not.toContain("Barcelona");
  });

  test("the host decides the market, so rovaro.es is ES from a Greek deployment", async () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    const res = await GET(locationsRequest("https://rovaro.es/api/transfers/locations"));
    const body = await res.json();

    expect(body.marketCountry).toBe("ES");
    expect(body.items.map((item) => item.name)).not.toContain("Afitos");
  });

});
