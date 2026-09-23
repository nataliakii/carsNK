/**
 * @jest-environment node
 */
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/domain/platform/platformSettingsService", () => ({
  getPlatformMarketplaceFeeSettings: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("@models/car", () => ({
  Car: {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { find: jest.fn(), findById: jest.fn() },
}));
jest.mock("@config/siteCountry", () => ({
  getSiteCountryCode: jest.fn(() => "ES"),
}));
jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  isMarketplaceOperatingCompany: jest.fn(
    (company) => String(company?.country || "").toUpperCase() === "ES"
  ),
  isPublicMarketplaceCarAllowed: jest.fn(async ({ company }) => {
    if (String(company?.country || "").toUpperCase() !== "ES") return true;
    return company?.listedOnMarketplace !== false && company?.compliant === true;
  }),
  ownerIdsHiddenFromPublicMarketplace: jest.fn(async (companies) =>
    (companies || [])
      .filter(
        (row) =>
          String(row.country || "").toUpperCase() === "ES" &&
          (row.listedOnMarketplace === false || row.compliant !== true)
      )
      .map((row) => row._id)
  ),
}));

import mongoose from "mongoose";
import { Car } from "@models/car";
import Company from "@models/company";
import { getSiteCountryCode } from "@config/siteCountry";
import { getCarById, getCars } from "../carService";

const ES_OWNER = "64b7f2c3a1b2c3d4e5f60711";
const GR_OWNER = "64b7f2c3a1b2c3d4e5f60722";
const CAR_ID = "64b7f2c3a1b2c3d4e5f60801";

function leanFind(docs) {
  return { lean: () => Promise.resolve(docs) };
}

describe("carService marketplace compliance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Company.find.mockReturnValue({
      select: () =>
        leanFind([
          {
            _id: new mongoose.Types.ObjectId(ES_OWNER),
            country: "ES",
            listedOnMarketplace: true,
            compliant: false,
          },
          {
            _id: new mongoose.Types.ObjectId(GR_OWNER),
            country: "GR",
            listedOnMarketplace: true,
            compliant: false,
          },
        ]),
    });
    Company.findById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            _id: ES_OWNER,
            country: "ES",
            listedOnMarketplace: true,
            compliant: false,
          }),
      }),
    });
  });

  test("2. pending/non-compliant Spain cars are excluded from public search", async () => {
    getSiteCountryCode.mockReturnValue("ES");
    Car.find.mockImplementation((filter) => {
      const clauses = filter.$and ? filter.$and : [filter];
      const hide = clauses.find((row) => row.ownerId?.$nin) || filter;
      const nin = hide.ownerId?.$nin || [];
      expect(nin.map(String)).toContain(ES_OWNER);
      return leanFind([]);
    });
    await getCars({ marketplaceOnly: true });
    expect(Car.find).toHaveBeenCalled();
  });

  test("7. direct hidden-car request returns null (404)", async () => {
    Car.findById.mockReturnValue({
      populate: () => ({
        lean: () =>
          Promise.resolve({
            _id: CAR_ID,
            ownerId: ES_OWNER,
            isActive: true,
            testingCar: false,
          }),
      }),
    });
    await expect(getCarById(CAR_ID)).resolves.toBeNull();
  });

  test("14. Greece cars stay visible on a Greece-site public search", async () => {
    getSiteCountryCode.mockReturnValue("GR");
    Car.find.mockImplementation((filter) => {
      const clauses = filter.$and ? filter.$and : [filter];
      const hide = clauses.find((row) => row.ownerId?.$nin) || filter;
      const nin = hide.ownerId?.$nin || [];
      expect(nin.map(String)).not.toContain(GR_OWNER);
      return leanFind([{ _id: "gr-car", ownerId: GR_OWNER }]);
    });
    const cars = await getCars({ marketplaceOnly: true });
    expect(cars).toEqual([
      expect.objectContaining({ ownerId: GR_OWNER }),
    ]);
  });
});
