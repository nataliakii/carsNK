import { buildOrderDrivingLicenceFolderPath } from "../orderDrivingLicenceFolder";

describe("buildOrderDrivingLicenceFolderPath", () => {
  // Pin the root so the path does not depend on the deployment's
  // CLOUDINARY_ROOT_FOLDER (ES deploys set it to "rovaro").
  const originalRoot = process.env.CLOUDINARY_ROOT_FOLDER;

  beforeAll(() => {
    process.env.CLOUDINARY_ROOT_FOLDER = "carsnk";
  });

  afterAll(() => {
    if (originalRoot === undefined) delete process.env.CLOUDINARY_ROOT_FOLDER;
    else process.env.CLOUDINARY_ROOT_FOLDER = originalRoot;
  });

  it("builds carsnk/orders/{name-startDate}/driving-licence", () => {
    const p = buildOrderDrivingLicenceFolderPath(
      "John Doe",
      "ignored@example.com",
      "2026-03-29"
    );
    expect(p).toBe(
      "carsnk/orders/john-doe-2026-03-29/driving-licence"
    );
  });

  it("ignores email in path", () => {
    const a = buildOrderDrivingLicenceFolderPath("Jane", "a@b.com", "2026-01-15");
    const b = buildOrderDrivingLicenceFolderPath("Jane", "z@y.com", "2026-01-15");
    expect(a).toBe(b);
  });

  it("uses x-unknown-date when missing", () => {
    const p = buildOrderDrivingLicenceFolderPath("", "", null);
    expect(p).toBe("carsnk/orders/x-unknown-date/driving-licence");
  });
});
