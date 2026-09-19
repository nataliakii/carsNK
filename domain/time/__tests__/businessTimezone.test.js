import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  DATETIME_ERROR,
  parseLocalInTimezone,
  fromUtcInTimezone,
} from "../businessInstant";
import {
  LEGACY_FALLBACK_TZ,
  resolveBusinessTimezone,
  canonicalizeTimezone,
} from "../resolveBusinessTimezone";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("resolveBusinessTimezone", () => {
  test("Greece country config is Europe/Athens", () => {
    expect(
      resolveBusinessTimezone({ countryCode: "GR", forNewOrder: true })
    ).toBe("Europe/Athens");
  });

  test("Spain mainland is Europe/Madrid", () => {
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

  test("historical order without snapshot falls back to Athens", () => {
    expect(
      resolveBusinessTimezone({
        order: { _id: "legacy" },
        company: { country: "ES", timezone: "Europe/Madrid" },
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

describe("parseLocalInTimezone", () => {
  test("Greece booking conversion 14:00 Athens → 12:00 UTC in winter", () => {
    const parsed = parseLocalInTimezone("2026-01-15", "14:00", "Europe/Athens");
    expect(parsed.ok).toBe(true);
    expect(parsed.utc.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(fromUtcInTimezone(parsed.utc, "Europe/Athens").format("HH:mm")).toBe(
      "14:00"
    );
  });

  test("Spain booking conversion 14:00 Madrid → 13:00 UTC in winter", () => {
    const parsed = parseLocalInTimezone("2026-01-15", "14:00", "Europe/Madrid");
    expect(parsed.ok).toBe(true);
    expect(parsed.utc.toISOString()).toBe("2026-01-15T13:00:00.000Z");
  });

  test("DST spring-forward nonexistent local time is rejected (Madrid)", () => {
    const parsed = parseLocalInTimezone("2026-03-29", "02:30", "Europe/Madrid");
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe(DATETIME_ERROR.NONEXISTENT_LOCAL_TIME);
  });

  test("pickup and return can land on different UTC dates", () => {
    const pickup = parseLocalInTimezone("2026-06-01", "23:00", "Europe/Madrid");
    const ret = parseLocalInTimezone("2026-06-03", "10:00", "Europe/Madrid");
    expect(pickup.ok).toBe(true);
    expect(ret.ok).toBe(true);
    expect(pickup.utc.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(ret.utc.toISOString().slice(0, 10)).toBe("2026-06-03");
    expect(pickup.utc.toISOString()).toBe("2026-06-01T21:00:00.000Z");
  });

  test("ambiguous DST fall-back times that cannot round-trip are rejected; explicit 01:30 or 03:00 are used instead", () => {
    const ambiguous = parseLocalInTimezone(
      "2026-10-25",
      "02:30",
      "Europe/Madrid"
    );
    expect(ambiguous.ok).toBe(false);

    const dstOccurrence = parseLocalInTimezone(
      "2026-10-25",
      "01:30",
      "Europe/Madrid"
    );
    const standardOccurrence = parseLocalInTimezone(
      "2026-10-25",
      "03:00",
      "Europe/Madrid"
    );
    expect(dstOccurrence.ok).toBe(true);
    expect(standardOccurrence.ok).toBe(true);
    expect(dstOccurrence.utc.toISOString()).not.toBe(
      standardOccurrence.utc.toISOString()
    );
  });
});
