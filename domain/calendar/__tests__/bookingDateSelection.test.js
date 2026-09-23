/**
 * @jest-environment node
 */
import dayjs from "dayjs";
import {
  formatValidBookingDate,
  isValidBookingDateValue,
  normalizeBookingDateSelection,
} from "../bookingDateSelection";
import { setTimeToDatejs } from "../functions";

describe("bookingDateSelection", () => {
  test("rejects null, empty, and Invalid Date", () => {
    expect(isValidBookingDateValue(null)).toBe(false);
    expect(isValidBookingDateValue("")).toBe(false);
    expect(isValidBookingDateValue(dayjs("not-a-date"))).toBe(false);
    expect(isValidBookingDateValue("2026-10-01")).toBe(true);
    expect(isValidBookingDateValue(dayjs("2026-10-01"))).toBe(true);
  });

  test("normalizeBookingDateSelection ignores incomplete or inverted ranges", () => {
    expect(normalizeBookingDateSelection(null)).toBeNull();
    expect(normalizeBookingDateSelection({ start: dayjs("2026-10-01") })).toBeNull();
    expect(
      normalizeBookingDateSelection({
        start: dayjs("2026-10-05"),
        end: dayjs("2026-10-01"),
      })
    ).toBeNull();
    const ok = normalizeBookingDateSelection({
      startDate: "2026-10-01",
      endDate: "2026-10-03",
    });
    expect(ok.start.format("YYYY-MM-DD")).toBe("2026-10-01");
    expect(ok.end.format("YYYY-MM-DD")).toBe("2026-10-03");
  });

  test("formatValidBookingDate never returns Invalid Date", () => {
    expect(formatValidBookingDate(null)).toBe("");
    expect(formatValidBookingDate(dayjs("bogus"), "DD.MM.YYYY", "—")).toBe("—");
    expect(formatValidBookingDate("2026-10-01", "DD.MM.YYYY")).toBe("01.10.2026");
  });

  test("setTimeToDatejs returns null for missing/invalid dates (no Invalid Date)", () => {
    expect(setTimeToDatejs(null, null, true)).toBeNull();
    expect(setTimeToDatejs(undefined, "10:00")).toBeNull();
    expect(setTimeToDatejs("not-a-date", "10:00")).toBeNull();
    const ok = setTimeToDatejs("2026-10-01", "14:30", true);
    expect(ok.isValid()).toBe(true);
    expect(ok.format("HH:mm")).toBe("14:30");
  });
});
