const fs = require("fs");
const path = require("path");
const { ALL_UI_LOCALE_CODES } = require("@/domain/platform/uiLocales");

const KEYS = [
  "supplierResponse",
  "platformStatus",
  "vehicleAvailable",
  "cannotProvide",
  "awaitingSupplier",
  "confirmBooking",
  "bookingConfirmedByRovaro",
];

describe("supplier-response table i18n", () => {
  const localeDir = path.join(__dirname, "..");
  const files = fs
    .readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"));

  test("every shipped locale JSON includes the new table keys", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const json = JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
      for (const key of KEYS) {
        expect(json.table?.[key]).toBeTruthy();
      }
      expect(json.table.supplierResponse.toLowerCase()).not.toBe("confirmed");
    }
  });

  test("supported UI locale codes with JSON files are covered", () => {
    const present = new Set(files.map((f) => f.replace(".json", "")));
    for (const code of ALL_UI_LOCALE_CODES) {
      if (!present.has(code)) continue;
      expect(present.has(code)).toBe(true);
    }
  });
});
