import {
  canonicalizeTimezone,
  LEGACY_FALLBACK_TZ,
  resolveBusinessTimezone,
  timezoneForCountry,
} from "../resolveBusinessTimezone";
import {
  DATETIME_ERROR,
  formatInTimezone,
  parseLocalInTimezone,
} from "../businessInstant";
import { toBusinessDateTime } from "@/domain/orders/numberOfDays";

describe("resolveBusinessTimezone", () => {
  test("Greece country config is Europe/Athens", () => {
    expect(timezoneForCountry("GR")).toBe("Europe/Athens");
    expect(
      resolveBusinessTimezone({ countryCode: "GR", forNewOrder: true })
    ).toBe("Europe/Athens");
  });

  test("Spain mainland is Europe/Madrid", () => {
    expect(timezoneForCountry("ES")).toBe("Europe/Madrid");
    expect(
      resolveBusinessTimezone({ countryCode: "ES", forNewOrder: true })
    ).toBe("Europe/Madrid");
  });

  test("Europe/Canary aliases to Atlantic/Canary", () => {
    expect(canonicalizeTimezone("Europe/Canary")).toBe("Atlantic/Canary");
  });

  test("company timezone override wins for new orders", () => {
    expect(
      resolveBusinessTimezone({
        company: { country: "ES", timezone: "Atlantic/Canary" },
        countryCode: "ES",
        forNewOrder: true,
      })
    ).toBe("Atlantic/Canary");
  });

  test("historical order without timezone falls back to Athens, not site country", () => {
    expect(
      resolveBusinessTimezone({
        order: { _id: "legacy", orderNumber: "20230101100000" },
        company: { country: "ES", timezone: "Europe/Madrid" },
        countryCode: "ES",
      })
    ).toBe(LEGACY_FALLBACK_TZ);
  });

  test("order snapshot wins", () => {
    expect(
      resolveBusinessTimezone({
        order: { timezone: "Europe/Madrid" },
        company: { timezone: "Europe/Athens" },
      })
    ).toBe("Europe/Madrid");
  });
});

describe("businessInstant conversion", () => {
  test("Greece 14:00 stores UTC instant 12:00 in winter", () => {
    const parsed = parseLocalInTimezone("2026-01-15", "14:00", "Europe/Athens");
    expect(parsed.ok).toBe(true);
    expect(parsed.utc.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(formatInTimezone(parsed.utc, "Europe/Athens", "HH:mm")).toBe("14:00");
  });

  test("Spain 14:00 stores UTC instant 13:00 in winter", () => {
    const parsed = parseLocalInTimezone("2026-01-15", "14:00", "Europe/Madrid");
    expect(parsed.ok).toBe(true);
    expect(parsed.utc.toISOString()).toBe("2026-01-15T13:00:00.000Z");
    expect(formatInTimezone(parsed.utc, "Europe/Madrid", "HH:mm")).toBe("14:00");
  });

  test("pickup and return can fall on different UTC dates", () => {
    const pickup = parseLocalInTimezone("2026-07-10", "23:00", "Europe/Madrid");
    const ret = parseLocalInTimezone("2026-07-11", "10:00", "Europe/Madrid");
    expect(pickup.ok).toBe(true);
    expect(ret.ok).toBe(true);
    expect(pickup.utc.toISOString().slice(0, 10)).toBe("2026-07-10");
    expect(ret.utc.toISOString().slice(0, 10)).toBe("2026-07-11");
  });

  test("DST spring-forward nonexistent local time is rejected", () => {
    // EU last Sunday of March 2026-03-29: 02:00–03:00 does not exist in Madrid.
    const parsed = parseLocalInTimezone("2026-03-29", "02:30", "Europe/Madrid");
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe(DATETIME_ERROR.NONEXISTENT_LOCAL_TIME);
  });

  test("toBusinessDateTime uses explicit timezone", () => {
    const madrid = toBusinessDateTime("2026-01-15T13:00:00.000Z", "Europe/Madrid");
    expect(madrid.format("HH:mm")).toBe("14:00");
    const athens = toBusinessDateTime("2026-01-15T12:00:00.000Z", "Europe/Athens");
    expect(athens.format("HH:mm")).toBe("14:00");
  });
});
