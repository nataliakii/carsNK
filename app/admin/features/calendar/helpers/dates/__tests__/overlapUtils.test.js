import { getStartEndInfo } from "../overlapUtils";

describe("getStartEndInfo", () => {
  test("marks start and end independently when both exist on the same date", () => {
    const dateStr = "2026-10-29";
    const startEndDates = [
      { date: dateStr, type: "end", orderId: "ending" },
      { date: dateStr, type: "start", orderId: "starting" },
    ];

    const info = getStartEndInfo(startEndDates, dateStr);
    expect(info.isStartDate).toBe(true);
    expect(info.isEndDate).toBe(true);
    // Prefer end entry when both match (overlap CASE 3).
    expect(info.info).toMatchObject({ type: "end", orderId: "ending" });
  });

  test("flags only the end day for a multi-day rental", () => {
    const startEndDates = [
      { date: "2026-10-27", type: "start", orderId: "o1" },
      { date: "2026-10-29", type: "end", orderId: "o1" },
    ];

    expect(getStartEndInfo(startEndDates, "2026-10-27")).toEqual({
      isStartDate: true,
      isEndDate: false,
      info: startEndDates[0],
    });
    expect(getStartEndInfo(startEndDates, "2026-10-29")).toEqual({
      isStartDate: false,
      isEndDate: true,
      info: startEndDates[1],
    });
    expect(getStartEndInfo(startEndDates, "2026-10-28")).toEqual({
      isStartDate: false,
      isEndDate: false,
      info: null,
    });
  });

  test("handles empty or missing arrays", () => {
    expect(getStartEndInfo(undefined, "2026-10-01")).toEqual({
      isStartDate: false,
      isEndDate: false,
      info: null,
    });
    expect(getStartEndInfo([], "2026-10-01")).toEqual({
      isStartDate: false,
      isEndDate: false,
      info: null,
    });
  });
});
