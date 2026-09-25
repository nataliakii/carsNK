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

  /**
   * Madrid puts its clocks back at 03:00 CEST on 2026-10-25, so local 02:00–02:59
   * happens twice. 02:30 is ambiguous, not nonexistent: refusing it would refuse a
   * time the customer can legitimately read off the clock. It is resolved to the
   * first (still-DST, UTC+02:00) occurrence and displays back as 02:30, so a
   * pickup written on the clock-change day is never shown an hour out.
   */
  test("an ambiguous fall-back time is accepted at its first occurrence and displays unchanged", () => {
    const ambiguous = parseLocalInTimezone(
      "2026-10-25",
      "02:30",
      "Europe/Madrid"
    );

    expect(ambiguous.ok).toBe(true);
    expect(ambiguous.utc.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(ambiguous.local.utcOffset()).toBe(120);
    expect(
      fromUtcInTimezone(ambiguous.utc, "Europe/Madrid").format("YYYY-MM-DD HH:mm")
    ).toBe("2026-10-25 02:30");
  });

  test("every minute of the repeated hour round-trips to the time that was entered", () => {
    for (const time of ["02:00", "02:15", "02:30", "02:45", "02:59"]) {
      const parsed = parseLocalInTimezone("2026-10-25", time, "Europe/Madrid");
      expect(`${time}:${parsed.ok}`).toBe(`${time}:true`);
      expect(
        `${time}:${fromUtcInTimezone(parsed.utc, "Europe/Madrid").format("HH:mm")}`
      ).toBe(`${time}:${time}`);
    }
  });

  test("the hours either side of the fall-back keep their own offsets", () => {
    const beforeChange = parseLocalInTimezone(
      "2026-10-25",
      "01:30",
      "Europe/Madrid"
    );
    const afterChange = parseLocalInTimezone(
      "2026-10-25",
      "03:00",
      "Europe/Madrid"
    );

    expect(beforeChange.ok).toBe(true);
    expect(afterChange.ok).toBe(true);
    expect(beforeChange.utc.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(afterChange.utc.toISOString()).toBe("2026-10-25T02:00:00.000Z");
    expect(beforeChange.local.utcOffset()).toBe(120);
    expect(afterChange.local.utcOffset()).toBe(60);
  });

  /**
   * The spring-forward gap is the case that genuinely has to be refused, and it
   * must stay refused: 02:30 does not exist on 2026-03-29, so accepting it would
   * silently store 03:30 and show the customer an hour they did not choose.
   */
  test("a nonexistent spring-forward time is never quietly shifted into a real one", () => {
    const parsed = parseLocalInTimezone("2026-03-29", "02:30", "Europe/Madrid");

    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe(DATETIME_ERROR.NONEXISTENT_LOCAL_TIME);
    expect(parsed.utc).toBeUndefined();
  });
});
