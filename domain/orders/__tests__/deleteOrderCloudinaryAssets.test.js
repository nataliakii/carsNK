jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: {
    api: {
      delete_resources: jest.fn().mockResolvedValue({}),
    },
  },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));

import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import {
  publicIdsFromOrderDrivingLicenceUrls,
  deleteCloudinaryImagesByPublicIds,
  deleteOrderCloudinaryAssets,
} from "../deleteOrderCloudinaryAssets";

describe("publicIdsFromOrderDrivingLicenceUrls", () => {
  it("returns empty for missing or invalid order", () => {
    expect(publicIdsFromOrderDrivingLicenceUrls(null)).toEqual([]);
    expect(publicIdsFromOrderDrivingLicenceUrls({})).toEqual([]);
    expect(
      publicIdsFromOrderDrivingLicenceUrls({ drivingLicenceUrls: "x" })
    ).toEqual([]);
  });

  it("extracts unique public ids from HTTPS Cloudinary URLs", () => {
    const url =
      "https://res.cloudinary.com/x/image/upload/v1/car/orders/guest/driving-licence/abc.jpg";
    expect(
      publicIdsFromOrderDrivingLicenceUrls({
        drivingLicenceUrls: [url, url, "https://example.com/nope"],
      })
    ).toEqual(["car/orders/guest/driving-licence/abc"]);
  });
});

describe("deleteCloudinaryImagesByPublicIds", () => {
  beforeEach(() => {
    cloudinary.api.delete_resources.mockClear();
    ensureCloudinaryConfigured.mockReturnValue({ ok: true });
  });

  it("returns skipped when Cloudinary is not configured", async () => {
    ensureCloudinaryConfigured.mockReturnValue({
      ok: false,
      message: "not configured",
    });
    const r = await deleteCloudinaryImagesByPublicIds(["a/b"]);
    expect(r).toEqual({ deleted: 0, skipped: true });
    expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
  });

  it("calls delete_resources with options", async () => {
    await deleteCloudinaryImagesByPublicIds(["p/one", "p/two"]);
    expect(cloudinary.api.delete_resources).toHaveBeenCalledTimes(1);
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(
      ["p/one", "p/two"],
      expect.objectContaining({
        resource_type: "image",
        invalidate: true,
      })
    );
  });

  it("chunks public ids into batches of 100", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `folder/img-${i}`);
    const r = await deleteCloudinaryImagesByPublicIds(ids);
    expect(r.deleted).toBe(101);
    expect(cloudinary.api.delete_resources).toHaveBeenCalledTimes(2);
    expect(cloudinary.api.delete_resources.mock.calls[0][0]).toHaveLength(100);
    expect(cloudinary.api.delete_resources.mock.calls[1][0]).toHaveLength(1);
  });
});

describe("deleteOrderCloudinaryAssets", () => {
  beforeEach(() => {
    cloudinary.api.delete_resources.mockClear();
    ensureCloudinaryConfigured.mockReturnValue({ ok: true });
  });

  it("returns deleted 0 when no URLs", async () => {
    const r = await deleteOrderCloudinaryAssets({ drivingLicenceUrls: [] });
    expect(r).toEqual({ deleted: 0 });
    expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
  });

  it("deletes assets derived from drivingLicenceUrls", async () => {
    const url =
      "https://res.cloudinary.com/x/image/upload/v99/car/o/dl/z.png";
    await deleteOrderCloudinaryAssets({ drivingLicenceUrls: [url] });
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(
      ["car/o/dl/z"],
      expect.any(Object)
    );
  });
});
