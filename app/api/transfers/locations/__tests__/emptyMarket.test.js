/**
 * @jest-environment node
 *
 * A market with nothing configured says so. It must not borrow a catalog.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/transfers/transferServiceAreas", () => ({
  listTransferLocationsForMarket: jest.fn(async () => []),
}));

import { connectToDB } from "@lib/database";
import { listTransferLocationsForMarket } from "@/domain/transfers/transferServiceAreas";
import { GET } from "../route";

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  connectToDB.mockResolvedValue(undefined);
  listTransferLocationsForMarket.mockResolvedValue([]);
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

test("an unconfigured market answers with an honest empty list", async () => {
  const res = await GET(
    new Request("https://rovaro.es/api/transfers/locations", { method: "GET" })
  );
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.success).toBe(true);
  expect(body.marketCountry).toBe("ES");
  expect(body.items).toEqual([]);
  expect(body.available).toBe(false);
  expect(listTransferLocationsForMarket).toHaveBeenCalledWith("ES");
});

test("a catalog read failure is reported, not papered over with another market", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  listTransferLocationsForMarket.mockRejectedValue(new Error("mongo down"));

  const res = await GET(
    new Request("https://rovaro.es/api/transfers/locations", { method: "GET" })
  );
  const body = await res.json();

  expect(res.status).toBe(503);
  expect(body.success).toBe(false);
  expect(body.items).toEqual([]);
  expect(body.available).toBe(false);
  jest.restoreAllMocks();
});
