const fs = require("fs");
const path = require("path");

/** Every string the public booking panel can put on screen. */
const KEYS = [
  "selectDates",
  "calculatingPrice",
  "book",
  "approxPrice",
  "totalPrice",
  "rentalDay",
  "rentalDays",
  "rangeUnavailable",
  "quoteFailed",
  "retry",
  "showCalendar",
  "hideCalendar",
  "clearDates",
  "previousMonth",
  "nextMonth",
  "legendAvailable",
  "legendUnavailable",
  "legendSelected",
  "sortLabel",
  "sortPriceAsc",
  "sortPriceDesc",
];

describe("public booking panel i18n", () => {
  const localeDir = path.join(__dirname, "..");
  const files = fs
    .readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"));

  function load(file) {
    return JSON.parse(fs.readFileSync(path.join(localeDir, file), "utf8"));
  }

  test("all ten shipped locales carry every booking panel key", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const booking = load(file).catalog?.booking;
      expect(`${file}:${Boolean(booking)}`).toBe(`${file}:true`);
      for (const key of KEYS) {
        expect(`${file}:${key}:${typeof booking[key]}`).toBe(`${file}:${key}:string`);
        expect(`${file}:${key}:${booking[key].length > 0}`).toBe(`${file}:${key}:true`);
      }
    }
  });

  test("no locale is missing a booking key another locale has", () => {
    const reference = Object.keys(load("en.json").catalog.booking).sort();
    for (const file of files) {
      const keys = Object.keys(load(file).catalog.booking).sort();
      expect(`${file}:${keys.join(",")}`).toBe(`${file}:${reference.join(",")}`);
    }
  });

  test("the book CTA never carries an exclamation or question mark", () => {
    for (const file of files) {
      const booking = load(file).catalog.booking;
      expect(`${file}:${booking.book}`).not.toMatch(/[!?]/);
      expect(`${file}:${booking.selectDates}`).not.toMatch(/[!?]/);
      expect(`${file}:${booking.calculatingPrice}`).not.toMatch(/[!?]/);
    }
  });

  test("price and day copy keeps its interpolation placeholder", () => {
    for (const file of files) {
      const booking = load(file).catalog.booking;
      expect(`${file}:${booking.approxPrice.includes("{{price}}")}`).toBe(
        `${file}:true`
      );
      expect(`${file}:${booking.totalPrice.includes("{{price}}")}`).toBe(
        `${file}:true`
      );
      expect(`${file}:${booking.rentalDays.includes("{{days}}")}`).toBe(
        `${file}:true`
      );
      // The singular form is a fixed "1", so it must not interpolate.
      expect(`${file}:${booking.rentalDay.includes("{{days}}")}`).toBe(
        `${file}:false`
      );
    }
  });

  test("the booking fee percentage is never baked into customer copy", () => {
    for (const file of files) {
      const booking = JSON.stringify(load(file).catalog.booking);
      expect(`${file}:${/\d+\s?%/.test(booking)}`).toBe(`${file}:false`);
    }
  });
});
