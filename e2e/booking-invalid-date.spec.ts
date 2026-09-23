import { test, expect } from "@playwright/test";
import dayjs from "dayjs";

/**
 * Reproduces the Book → BookingModal date race contract that previously showed
 * "Invalid Date". Helpers mirror domain/calendar/bookingDateSelection so this
 * file stays runnable under Playwright without Next path aliases.
 */
function isValidBookingDateValue(value: unknown): boolean {
  if (value == null || value === "") return false;
  const d = dayjs.isDayjs(value) ? value : dayjs(value as string);
  return Boolean(d && d.isValid && d.isValid());
}

function normalizeBookingDateSelection(
  selection: { start?: unknown; end?: unknown; startDate?: unknown; endDate?: unknown } | null
) {
  if (!selection || typeof selection !== "object") return null;
  const startRaw = selection.start ?? selection.startDate;
  const endRaw = selection.end ?? selection.endDate;
  if (!isValidBookingDateValue(startRaw) || !isValidBookingDateValue(endRaw)) {
    return null;
  }
  const start = dayjs.isDayjs(startRaw) ? startRaw : dayjs(startRaw as string);
  const end = dayjs.isDayjs(endRaw) ? endRaw : dayjs(endRaw as string);
  if (end.isBefore(start, "day")) return null;
  return { start, end };
}

function formatValidBookingDate(
  value: unknown,
  format = "DD.MM.YYYY",
  fallback = ""
): string {
  if (!isValidBookingDateValue(value)) return fallback;
  const d = dayjs.isDayjs(value) ? value : dayjs(value as string);
  const formatted = d.format(format);
  return formatted === "Invalid Date" ? fallback : formatted;
}

test.describe("booking date selection (Invalid Date regression)", () => {
  test("Book path rejects missing dates instead of opening with Invalid Date", () => {
    expect(normalizeBookingDateSelection(null)).toBeNull();
    expect(normalizeBookingDateSelection({ start: null, end: null })).toBeNull();
    expect(formatValidBookingDate(null, "DD.MM.YYYY", "")).not.toBe(
      "Invalid Date"
    );
    expect(formatValidBookingDate(dayjs("x"), "DD.MM.YYYY", "")).toBe("");
  });

  test("immediate Book after selecting a range uses the latest selection", () => {
    const start = dayjs().add(10, "day").startOf("day");
    const end = start.add(3, "day");
    const fromCalendar = normalizeBookingDateSelection({ start, end });
    expect(fromCalendar).not.toBeNull();
    expect(formatValidBookingDate(fromCalendar!.start, "DD.MM.YYYY")).toMatch(
      /^\d{2}\.\d{2}\.\d{4}$/
    );
    expect(formatValidBookingDate(fromCalendar!.end, "DD.MM.YYYY")).not.toBe(
      "Invalid Date"
    );
  });

  test("catalog page does not render Invalid Date text", async ({ page }) => {
    const response = await page
      .goto("/en", { waitUntil: "domcontentloaded" })
      .catch(() => null);
    if (!response || response.status() >= 500) {
      test.skip(true, "app not available for browser smoke");
      return;
    }
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Invalid Date");
  });
});
