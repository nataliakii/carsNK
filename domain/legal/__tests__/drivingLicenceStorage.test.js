/**
 * @jest-environment node
 */
jest.mock("@utils/cloudinary", () => ({
  __esModule: true,
  default: { api: { delete_resources: jest.fn() } },
  ensureCloudinaryConfigured: jest.fn(() => ({ ok: true })),
}));

import cloudinary, { ensureCloudinaryConfigured } from "@utils/cloudinary";
import { deleteDrivingLicenceAssets } from "@/domain/legal/drivingLicenceStorage";

beforeEach(() => {
  jest.clearAllMocks();
  ensureCloudinaryConfigured.mockReturnValue({ ok: true });
});

it("reports each asset Cloudinary confirmed", async () => {
  cloudinary.api.delete_resources.mockResolvedValue({
    deleted: { "a/one": "deleted", "a/two": "deleted" },
  });

  const result = await deleteDrivingLicenceAssets(["a/one", "a/two"]);

  expect(result).toEqual({
    configured: true,
    gone: ["a/one", "a/two"],
    failed: [],
    errorMessage: "",
  });
});

it("treats not_found as already gone so a half-finished run can complete", async () => {
  cloudinary.api.delete_resources.mockResolvedValue({
    deleted: { "a/one": "not_found" },
  });

  const result = await deleteDrivingLicenceAssets(["a/one"]);

  expect(result.gone).toEqual(["a/one"]);
  expect(result.failed).toEqual([]);
});

it("does not claim an asset is gone when Cloudinary says otherwise", async () => {
  cloudinary.api.delete_resources.mockResolvedValue({
    deleted: { "a/one": "deleted" },
  });

  const result = await deleteDrivingLicenceAssets(["a/one", "a/two"]);

  expect(result.gone).toEqual(["a/one"]);
  expect(result.failed).toEqual(["a/two"]);
  expect(result.errorMessage).toBeTruthy();
});

it("fails the whole batch when the API throws", async () => {
  cloudinary.api.delete_resources.mockRejectedValue(new Error("network down"));

  const result = await deleteDrivingLicenceAssets(["a/one"]);

  expect(result.failed).toEqual(["a/one"]);
  expect(result.errorMessage).toBe("network down");
});

it("deletes nothing when storage is not configured", async () => {
  ensureCloudinaryConfigured.mockReturnValue({ ok: false, message: "no creds" });

  const result = await deleteDrivingLicenceAssets(["a/one"]);

  expect(result).toMatchObject({ configured: false, gone: [], failed: ["a/one"] });
  expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
});

it("chunks large deletions", async () => {
  cloudinary.api.delete_resources.mockImplementation(async (ids) => ({
    deleted: Object.fromEntries(ids.map((id) => [id, "deleted"])),
  }));
  const ids = Array.from({ length: 101 }, (_, i) => `a/${i}`);

  const result = await deleteDrivingLicenceAssets(ids);

  expect(cloudinary.api.delete_resources).toHaveBeenCalledTimes(2);
  expect(result.gone).toHaveLength(101);
});
