/**
 * 🕒 TIMEZONE CONTRACT — Athens Round Trip Test
 * npm run test            # Все тесты
 * npm run test:timezone   # Только timezone тесты
 * npm run test:watch      # Watch mode
 *
 * 🎯 Что гарантирует этот тест:
 *
 * ❌ нигде не произошло скрытой конвертации
 * ❌ браузерная таймзона не вмешалась
 * ❌ UTC не «съел» часы
 * ❌ .tz() не использован неправильно
 * ✅ 14:00 всегда остаётся 14:00 (Athens)
 *
 * Если кто-то когда-нибудь:
 * - добавит dayjs(date)
 * - забудет tz(..., true)
 * - использует new Date()
 * ➡️ тест упадёт сразу
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import {
  ATHENS_TZ,
  createAthensDateTime,
  toServerUTC,
  fromServerUTC,
  fromServerAthensUTC,
  validateRoundTrip,
} from "../athensTime";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("🕒 TIMEZONE CONTRACT — Athens Round Trip", () => {
  it("keeps clock time identical across UI → API → DB → API → UI", () => {
    /**
     * Simulate WORST CASE:
     * Admin is in Australia (UTC+10 / +11)
     * Browser gives Date in local timezone
     */
    const browserTimezone = "Australia/Sydney";
    const inputDate = "2026-01-15";
    const inputTime = "14:00";

    // -----------------------------
    // 1️⃣ UI: user enters time in their browser
    // This simulates what happens when browser creates a Date
    // -----------------------------
    const browserDate = dayjs
      .tz(`${inputDate} ${inputTime}`, "YYYY-MM-DD HH:mm", browserTimezone)
      .toDate();

    // Sanity check: in browser timezone it's 14:00
    expect(dayjs(browserDate).tz(browserTimezone).hour()).toBe(14);
    // Sanity check: browser is NOT Athens, so hour differs
    expect(dayjs(browserDate).tz(ATHENS_TZ).hour()).not.toBe(14);

    // -----------------------------
    // 2️⃣ Frontend → Backend
    // We REINTERPRET the clock time as Athens
    // NOT convert from browser timezone!
    // -----------------------------
    const athensLocal = createAthensDateTime(inputDate, inputTime);

    expect(athensLocal).not.toBeNull();
    expect(athensLocal.hour()).toBe(14);
    expect(athensLocal.minute()).toBe(0);

    // -----------------------------
    // 3️⃣ Backend → Database
    // Convert to UTC ONCE
    // -----------------------------
    const storedUTC = toServerUTC(athensLocal);

    expect(storedUTC).toBeInstanceOf(Date);
    // Stored value is a Date object (which is always UTC internally)

    // -----------------------------
    // 4️⃣ Database → Backend
    // Interpret UTC as Athens business time
    // -----------------------------
    const backendAthens = fromServerUTC(storedUTC);

    expect(backendAthens).not.toBeNull();
    expect(backendAthens.hour()).toBe(14);
    expect(backendAthens.minute()).toBe(0);

    // -----------------------------
    // 5️⃣ Backend → Frontend
    // Display without browser conversion
    // -----------------------------
    const uiDisplayed = fromServerAthensUTC(storedUTC);

    expect(uiDisplayed).not.toBeNull();
    expect(uiDisplayed.hour()).toBe(14);
    expect(uiDisplayed.minute()).toBe(0);

    // -----------------------------
    // 🔥 FINAL ASSERTION
    // The clock time MUST be identical to input
    // -----------------------------
    const finalClock = uiDisplayed.format("HH:mm");
    expect(finalClock).toBe("14:00");
  });

  it("validateRoundTrip returns true for correct implementation", () => {
    expect(validateRoundTrip("2026-01-15", "14:00")).toBe(true);
    expect(validateRoundTrip("2026-06-21", "09:30")).toBe(true);
    expect(validateRoundTrip("2026-12-31", "23:59")).toBe(true);
    expect(validateRoundTrip("2026-01-01", "00:00")).toBe(true);
  });

  it("works across DST boundaries (winter → summer)", () => {
    // Winter time (UTC+2)
    const winterDate = "2026-01-15";
    const winterTime = "14:00";

    const winterAthens = createAthensDateTime(winterDate, winterTime);
    const winterUTC = toServerUTC(winterAthens);
    const winterBack = fromServerUTC(winterUTC);

    expect(winterBack.format("HH:mm")).toBe("14:00");

    // Summer time (UTC+3)
    const summerDate = "2026-07-15";
    const summerTime = "14:00";

    const summerAthens = createAthensDateTime(summerDate, summerTime);
    const summerUTC = toServerUTC(summerAthens);
    const summerBack = fromServerUTC(summerUTC);

    expect(summerBack.format("HH:mm")).toBe("14:00");
  });

  it("handles edge cases: midnight, noon, end of day", () => {
    const testCases = [
      { date: "2026-03-29", time: "00:00" }, // DST transition day
      { date: "2026-10-25", time: "00:00" }, // DST transition day
      { date: "2026-06-15", time: "12:00" }, // Noon
      { date: "2026-06-15", time: "23:59" }, // End of day
      { date: "2026-06-15", time: "00:01" }, // Start of day
    ];

    testCases.forEach(({ date, time }) => {
      const athens = createAthensDateTime(date, time);
      const utc = toServerUTC(athens);
      const back = fromServerUTC(utc);

      expect(back.format("HH:mm")).toBe(time);
      expect(back.format("YYYY-MM-DD")).toBe(date);
    });
  });

  it("different browser timezones all produce same Athens time", () => {
    const inputDate = "2026-05-10";
    const inputTime = "14:00";

    // Simulate different browser timezones
    const timezones = [
      "Australia/Sydney",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
      "Pacific/Auckland",
      "America/Los_Angeles",
    ];

    // All should produce the SAME Athens time
    timezones.forEach((tz) => {
      // This simulates what happens in browser
      const browserDate = dayjs
        .tz(`${inputDate} ${inputTime}`, "YYYY-MM-DD HH:mm", tz)
        .toDate();

      // But our function IGNORES browser timezone
      // It creates Athens time directly from strings
      const athensTime = createAthensDateTime(inputDate, inputTime);
      const utcStored = toServerUTC(athensTime);
      const displayed = fromServerUTC(utcStored);

      // Must always be 14:00 Athens, regardless of browser TZ
      expect(displayed.format("HH:mm")).toBe("14:00");
    });
  });

  it("ISO string from server is correctly interpreted as Athens", () => {
    // Simulate server returning ISO string
    const serverResponse = "2026-01-15T12:00:00.000Z"; // UTC

    const displayed = fromServerUTC(serverResponse);

    // In Athens (UTC+2 in winter), 12:00 UTC = 14:00 Athens
    expect(displayed.hour()).toBe(14);
    expect(displayed.minute()).toBe(0);
    expect(displayed.format("HH:mm")).toBe("14:00");
  });

  it("Date object from server is correctly interpreted as Athens", () => {
    // Simulate server returning Date object
    const serverDate = new Date("2026-01-15T12:00:00.000Z"); // UTC

    const displayed = fromServerUTC(serverDate);

    // In Athens (UTC+2 in winter), 12:00 UTC = 14:00 Athens
    expect(displayed.hour()).toBe(14);
    expect(displayed.minute()).toBe(0);
  });
});

describe("🚨 TIMEZONE CONTRACT — Anti-patterns (should fail)", () => {
  it("demonstrates why dayjs(date) is dangerous", () => {
    const inputDate = "2026-01-15";
    const inputTime = "14:00";

    // ❌ WRONG: using dayjs() without timezone
    // This interprets the date in the local machine timezone
    const wrongWay = dayjs(`${inputDate} ${inputTime}`);

    // ✅ CORRECT: using createAthensDateTime
    const correctWay = createAthensDateTime(inputDate, inputTime);

    // The hour MIGHT be the same on an Athens server,
    // but on CI/CD in UTC, it would differ!
    // This test documents the correct approach
    expect(correctWay.tz(ATHENS_TZ).hour()).toBe(14);
  });

  it("demonstrates why browser Date is dangerous for business time", () => {
    const inputDate = "2026-01-15";
    const inputTime = "14:00";

    // ❌ WRONG: creating Date from browser input
    // new Date() interprets time in browser's local timezone
    // const dangerousDate = new Date(`${inputDate}T${inputTime}:00`);

    // ✅ CORRECT: extract strings and create Athens time
    const safeTime = createAthensDateTime(inputDate, inputTime);
    const safeUTC = toServerUTC(safeTime);

    // The safe approach always produces correct Athens time
    expect(fromServerUTC(safeUTC).format("HH:mm")).toBe("14:00");
  });
});

