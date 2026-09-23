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
  default: {
    find: jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve([]) }),
    })),
    findById: jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve(null) }),
    })),
  },
}));

import { connectToDB } from "@lib/database";
import { Car } from "@models/car";
import { getCarById, getCars } from "../carService";

describe("carService getCarById / getCars", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectToDB.mockResolvedValue(undefined);
  });

  test("getCarById returns null for invalid id without querying", async () => {
    expect(await getCarById("getAll")).toBeNull();
    expect(await getCarById("not-an-id")).toBeNull();
    expect(await getCarById("")).toBeNull();
    expect(Car.findById).not.toHaveBeenCalled();
  });

  test("getCars returns empty array when find yields nullish", async () => {
    Car.find.mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(getCars({})).resolves.toEqual([]);
  });

  test("getCars ADMIN filter is passed to a single Car.find (tenant scoped)", async () => {
    const ownerA = "64b7f2c3a1b2c3d4e5f60701";
    Car.find.mockImplementation((filter) => {
      expect(String(filter.$and?.[1]?.ownerId)).toBe(ownerA);
      return {
        lean: () =>
          Promise.resolve([{ _id: "1", ownerId: ownerA, model: "Mine" }]),
      };
    });
    const cars = await getCars({
      session: {
        user: { isAdmin: true, role: 1, ownerId: ownerA },
      },
    });
    expect(cars).toEqual([
      expect.objectContaining({ ownerId: ownerA, model: "Mine" }),
    ]);
    expect(Car.find).toHaveBeenCalledTimes(1);
  });

  test("getCars ADMIN without ownerId sees nothing (safe empty, not all cars)", async () => {
    Car.find.mockImplementation((filter) => {
      expect(filter).toEqual({ _id: null });
      return { lean: () => Promise.resolve([]) };
    });
    const cars = await getCars({
      session: { user: { isAdmin: true, role: 1 } },
    });
    expect(cars).toEqual([]);
  });

  test("getCarById does not throw CastError on getAll alias", async () => {
    await expect(getCarById("getAll")).resolves.toBeNull();
    expect(Car.findById).not.toHaveBeenCalled();
  });
});
