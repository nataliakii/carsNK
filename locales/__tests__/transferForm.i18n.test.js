const fs = require("fs");
const path = require("path");

/** Strings the public transfer form can put on screen for a market decision. */
const KEYS = ["cityPlaceholder", "locationsUnavailable", "outOfMarket"];

/** Places the Greek business used to own. No market may name them generically. */
const LEGACY_GREEK_REGIONS =
  /halkidiki|chalkidiki|χαλκιδικ|халкидик|халкідік/i;

describe("public transfer form i18n", () => {
  const localeDir = path.join(__dirname, "..");
  const files = fs
    .readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"));

  function load(file) {
    return JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
  }

  test("all ten shipped locales carry every transfer form key", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const transfer = load(file).transfer;
      expect(`${file}:${Boolean(transfer)}`).toBe(`${file}:true`);
      for (const key of KEYS) {
        expect(`${file}:${key}:${typeof transfer[key]}`).toBe(
          `${file}:${key}:string`
        );
        expect(`${file}:${key}:${transfer[key].length > 0}`).toBe(
          `${file}:${key}:true`
        );
      }
    }
  });

  test("no locale carries a transfer key English does not define", () => {
    const reference = Object.keys(load("en.json").transfer).sort();
    for (const file of files) {
      const stray = Object.keys(load(file).transfer)
        .filter((key) => !reference.includes(key))
        .sort();
      expect(`${file}:${stray.join(",")}`).toBe(`${file}:`);
    }
  });

  test("the location placeholder names no country or region", () => {
    for (const file of files) {
      const placeholder = load(file).transfer.cityPlaceholder;
      expect(`${file}:${LEGACY_GREEK_REGIONS.test(placeholder)}`).toBe(
        `${file}:false`
      );
    }
  });
});
