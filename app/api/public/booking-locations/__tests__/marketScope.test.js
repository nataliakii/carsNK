/**
 * @jest-environment node
 *
 * A supplier from another market must not publish its pickup points on this
 * site, even when the caller knows its company id.
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/platformCity", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PlatformCity from "@models/platformCity";
import { GET } from "../route";

const COMPANY_ID = "507f1f77bcf86cd799439011";

function findByIdReturning(company) {
  Company.findById.mockImplementation(() => ({
    select: () => ({ lean: async () => company }),
  }));
}

function locationsRequest(host = "rovaro.es") {
  return new Request(
    `https://${host}/api/public/booking-locations?companyId=${COMPANY_ID}`,
    { method: "GET" }
  );
}

const ORIGINAL_COUNTRY = process.env.NEXT_PUBLIC_SITE_COUNTRY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
  connectToDB.mockResolvedValue(undefined);
  PlatformCity.find.mockImplementation(() => ({ lean: async () => [] }));
});

afterEach(() => {
  if (ORIGINAL_COUNTRY === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
  } else {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = ORIGINAL_COUNTRY;
  }
});

test("a Greek supplier is invisible on the Spanish market", async () => {
  findByIdReturning({
    _id: COMPANY_ID,
    country: "GR",
    locations: [{ name: "Kriopigi" }, { name: "Afitos" }],
  });

  const res = await GET(locationsRequest());
  const body = await res.json();

  expect(res.status).toBe(404);
  expect(JSON.stringify(body)).not.toMatch(/Kriopigi|Afitos/);
});

test("a Spanish supplier still publishes its own pickup points", async () => {
  findByIdReturning({
    _id: COMPANY_ID,
    country: "ES",
    locations: [{ name: "Barcelona" }, { name: "Girona" }],
  });

  const res = await GET(locationsRequest());
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.success).toBe(true);
  expect(body.names).toEqual(expect.arrayContaining(["Barcelona", "Girona"]));
});

test("legacy Greek suppliers with no country still work on the Greek market", async () => {
  process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
  findByIdReturning({
    _id: COMPANY_ID,
    country: "GR",
    locations: [{ name: "Kriopigi" }],
  });

  const res = await GET(locationsRequest("carsnk.gr"));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.names).toContain("Kriopigi");
});
