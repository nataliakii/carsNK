const { asOffice, officesNeedMigration } = require("../migrateCompanyOffices");

describe("legacy office migration", () => {
  test("is idempotent for already-normalized offices", () => {
    const first = asOffice({ name: "BCN", address: "Mallorca 1" });
    const second = asOffice(first);
    expect(String(second._id)).toBe(String(first._id));
    expect(second.publicName).toBe("BCN");
    expect(officesNeedMigration([second])).toBe(false);
    expect(officesNeedMigration([{ name: "legacy string missing id" }])).toBe(true);
    expect(officesNeedMigration(["legacy string"])).toBe(true);
  });
});
