import {
  buildCalendarDays,
  buildOrderDateRange,
  getDayRangeEnd,
  SHORT_PERIOD_DAYS,
} from "../calendarDays";

describe("buildOrderDateRange timezone", () => {
  test("maps summer UTC midnight representation to Athens day range", () => {
    const order = {
      rentalStartDate: "2026-05-05T21:00:00.000Z",
      rentalEndDate: "2026-05-08T21:00:00.000Z",
    };

    expect(buildOrderDateRange(order)).toEqual([
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
      "2026-05-09",
    ]);
  });

  test("maps winter UTC midnight representation to Athens day range", () => {
    const order = {
      rentalStartDate: "2026-01-14T22:00:00.000Z",
      rentalEndDate: "2026-01-16T22:00:00.000Z",
    };

    expect(buildOrderDateRange(order)).toEqual([
      "2026-01-15",
      "2026-01-16",
      "2026-01-17",
    ]);
  });
});

describe("short period (15d)", () => {
  test("renders 15 consecutive days from the 15th", () => {
    const days = buildCalendarDays({
      month: 1,
      year: 2027,
      viewMode: "range15",
      rangeDirection: "forward",
      calendarDayRange: "15d",
    });
    expect(days).toHaveLength(SHORT_PERIOD_DAYS);
    expect(SHORT_PERIOD_DAYS).toBe(15);
    expect(days[0].dayjs.format("YYYY-MM-DD")).toBe("2027-02-15");
    expect(days[days.length - 1].dayjs.format("YYYY-MM-DD")).toBe("2027-03-01");
  });
});

describe("month-span periods", () => {
  const spans = [
    { calendarDayRange: "1m", lastDay: "2027-02-28", length: 28 },
    { calendarDayRange: "2m", lastDay: "2027-03-31", length: 59 },
    { calendarDayRange: "3m", lastDay: "2027-04-30", length: 89 },
    { calendarDayRange: "6m", lastDay: "2027-07-31", length: 181 },
  ];

  test.each(spans)(
    "$calendarDayRange spans whole calendar months from the selected month",
    ({ calendarDayRange, lastDay, length }) => {
      const days = buildCalendarDays({
        month: 1,
        year: 2027,
        viewMode: "full",
        calendarDayRange,
      });

      expect(days).toHaveLength(length);
      expect(days[0].dayjs.format("YYYY-MM-DD")).toBe("2027-02-01");
      expect(days[days.length - 1].dayjs.format("YYYY-MM-DD")).toBe(lastDay);
      expect(getDayRangeEnd({ year: 2027, month: 1, calendarDayRange }).format(
        "YYYY-MM-DD"
      )).toBe(lastDay);
    }
  );

  test("keeps the last day of a DST-crossing span", () => {
    // Europe DST starts inside this window; a diff("day") based length would
    // drop 2027-08-31.
    const days = buildCalendarDays({
      month: 2,
      year: 2027,
      viewMode: "full",
      calendarDayRange: "6m",
    });

    expect(days[days.length - 1].dayjs.format("YYYY-MM-DD")).toBe("2027-08-31");
  });

  test("spans rolling into the next year keep counting months", () => {
    const days = buildCalendarDays({
      month: 10,
      year: 2027,
      viewMode: "full",
      calendarDayRange: "3m",
    });

    expect(days[0].dayjs.format("YYYY-MM-DD")).toBe("2027-11-01");
    expect(days[days.length - 1].dayjs.format("YYYY-MM-DD")).toBe("2028-01-31");
  });
});
