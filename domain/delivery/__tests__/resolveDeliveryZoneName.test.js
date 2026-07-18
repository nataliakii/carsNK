const { resolveDeliveryZoneName } = require("../resolveDeliveryZoneName");

describe("resolveDeliveryZoneName", () => {
  test("empty / non-string → empty", () => {
    expect(resolveDeliveryZoneName("")).toBe("");
    expect(resolveDeliveryZoneName("   ")).toBe("");
    expect(resolveDeliveryZoneName(undefined)).toBe("");
    expect(resolveDeliveryZoneName(null)).toBe("");
  });

  test("alias airport", () => {
    expect(resolveDeliveryZoneName("airport")).toBe("Thessaloniki Airport");
    expect(resolveDeliveryZoneName("AIRPORT")).toBe("Thessaloniki Airport");
  });

  test("passthrough with trim", () => {
    expect(resolveDeliveryZoneName("  Some Place  ")).toBe("Some Place");
  });
});
