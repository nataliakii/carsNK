import {
  normalizeDrivingLicenceUrls,
  MAX_DRIVING_LICENCE_URLS,
} from "../normalizeDrivingLicenceUrls";

describe("normalizeDrivingLicenceUrls", () => {
  it("returns empty for non-array", () => {
    expect(normalizeDrivingLicenceUrls(null)).toEqual([]);
    expect(normalizeDrivingLicenceUrls("x")).toEqual([]);
  });

  it("keeps only https cloudinary URLs", () => {
    const ok = "https://res.cloudinary.com/demo/image/upload/v1/x";
    expect(
      normalizeDrivingLicenceUrls([
        ok,
        "http://evil.com/x",
        "https://evil.com/x",
        1,
        ok,
      ])
    ).toEqual([ok]);
  });

  it("caps count", () => {
    const urls = Array.from(
      { length: 10 },
      (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/p${i}`
    );
    expect(normalizeDrivingLicenceUrls(urls).length).toBe(
      MAX_DRIVING_LICENCE_URLS
    );
  });
});
