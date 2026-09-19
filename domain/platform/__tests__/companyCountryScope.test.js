import {
  buildSiteCountryCompanyFilter,
  isCompanyInSiteCountry,
  withSiteCountry,
} from "../companyCountryScope";

describe("companyCountryScope", () => {
  test("ES filter is strict", () => {
    expect(buildSiteCountryCompanyFilter("ES")).toEqual({ country: "ES" });
  });

  test("GR filter keeps legacy empty country", () => {
    const filter = buildSiteCountryCompanyFilter("GR");
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { country: "GR" },
        { country: { $exists: false } },
      ])
    );
  });

  test("isCompanyInSiteCountry", () => {
    expect(isCompanyInSiteCountry({ country: "ES" }, "ES")).toBe(true);
    expect(isCompanyInSiteCountry({ country: "GR" }, "ES")).toBe(false);
    expect(isCompanyInSiteCountry({ country: "" }, "GR")).toBe(true);
    expect(isCompanyInSiteCountry({ country: "" }, "ES")).toBe(false);
  });

  test("withSiteCountry stamps deployment country", () => {
    expect(withSiteCountry({ name: "A" }, "ES")).toEqual({
      name: "A",
      country: "ES",
    });
  });
});
