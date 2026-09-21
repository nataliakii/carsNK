import { normalizeBookingTimeHm } from "../locationOptions";

describe("normalizeBookingTimeHm", () => {
  test("keeps valid HH:mm", () => {
    expect(normalizeBookingTimeHm("09:30")).toBe("09:30");
    expect(normalizeBookingTimeHm("23:59")).toBe("23:59");
  });

  test("pads a single-digit hour", () => {
    expect(normalizeBookingTimeHm("9:05")).toBe("09:05");
  });

  test("strips optional seconds", () => {
    expect(normalizeBookingTimeHm("14:00:00")).toBe("14:00");
  });

  test("returns empty for invalid values", () => {
    expect(normalizeBookingTimeHm("")).toBe("");
    expect(normalizeBookingTimeHm(null)).toBe("");
    expect(normalizeBookingTimeHm("25:00")).toBe("");
    expect(normalizeBookingTimeHm("10:60")).toBe("");
    expect(normalizeBookingTimeHm("noon")).toBe("");
  });
});
