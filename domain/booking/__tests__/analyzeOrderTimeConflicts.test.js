import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { analyzeOrderTimeConflicts } from "../analyzeOrderTimeConflicts";

dayjs.extend(utc);
dayjs.extend(timezone);

const ATHENS_TZ = "Europe/Athens";

function createMockOrder({
  id,
  customerName,
  email,
  confirmed,
  startDate,
  startTime,
  endDate,
  endTime,
  visibility,
}) {
  const timeIn = dayjs
    .tz(`${startDate} ${startTime}`, "YYYY-MM-DD HH:mm", ATHENS_TZ)
    .utc()
    .toDate();
  const timeOut = dayjs
    .tz(`${endDate} ${endTime}`, "YYYY-MM-DD HH:mm", ATHENS_TZ)
    .utc()
    .toDate();

  return {
    _id: id,
    car: "car-1",
    customerName,
    email,
    confirmed,
    timeIn,
    timeOut,
    rentalStartDate: timeIn,
    rentalEndDate: timeOut,
    _visibility: visibility,
  };
}

describe("analyzeOrderTimeConflicts", () => {
  it("показывает отрицательный буфер и email, если имени нет, в warning-сообщении", () => {
    const editingOrder = createMockOrder({
      id: "editing",
      customerName: "Редактируемый",
      confirmed: true,
      startDate: "2026-03-01",
      startTime: "14:00",
      endDate: "2026-03-04",
      endTime: "12:00",
    });

    const conflictingPending = createMockOrder({
      id: "pending-1",
      customerName: undefined,
      email: "pending@example.com",
      confirmed: false,
      startDate: "2026-03-04",
      startTime: "01:58",
      endDate: "2026-03-07",
      endTime: "19:00",
    });

    const result = analyzeOrderTimeConflicts({
      editingOrder,
      orders: [editingOrder, conflictingPending],
      date: "2026-03-04",
      editingPickupTime: "14:00",
      editingReturnTime: "12:00",
      bufferHours: 2,
    });

    expect(result.summary).not.toBeNull();
    expect(result.summary.level).toBe("warning");
    expect(result.summary.message).toContain("«pending@example.com»");
    expect(result.summary.message).toContain("Реальная разница (буфер): -10 ч 2 мин");
  });
  it("does not create a false block when edited return date moves to a new day and the gap equals buffer", () => {
    const editingOrder = createMockOrder({
      id: "editing",
      customerName: "Edited order",
      confirmed: true,
      startDate: "2026-03-15",
      startTime: "14:00",
      endDate: "2026-03-31",
      endTime: "13:00",
    });

    const nextConfirmed = createMockOrder({
      id: "confirmed-1",
      customerName: "Next customer",
      confirmed: true,
      startDate: "2026-04-01",
      startTime: "14:00",
      endDate: "2026-04-05",
      endTime: "10:00",
    });

    const result = analyzeOrderTimeConflicts({
      editingOrder,
      orders: [editingOrder, nextConfirmed],
      date: "2026-04-01",
      editingPickupDate: "2026-03-15",
      editingReturnDate: "2026-04-01",
      editingPickupTime: "14:00",
      editingReturnTime: "13:00",
      bufferHours: 1,
    });

    expect(result.hasBlockingConflict).toBe(false);
    expect(result.summary).toBeNull();
  });

  it("uses the edited return date to calculate the real gap instead of technical 23:59", () => {
    const editingOrder = createMockOrder({
      id: "editing",
      customerName: "Edited order",
      confirmed: true,
      startDate: "2026-03-15",
      startTime: "14:00",
      endDate: "2026-03-31",
      endTime: "13:00",
    });

    const nextConfirmed = createMockOrder({
      id: "confirmed-1",
      customerName: "Next customer",
      confirmed: true,
      startDate: "2026-04-01",
      startTime: "14:00",
      endDate: "2026-04-05",
      endTime: "10:00",
    });

    const result = analyzeOrderTimeConflicts({
      editingOrder,
      orders: [editingOrder, nextConfirmed],
      date: "2026-04-01",
      editingPickupDate: "2026-03-15",
      editingReturnDate: "2026-04-01",
      editingPickupTime: "14:00",
      editingReturnTime: "13:00",
      bufferHours: 2,
    });

    expect(result.hasBlockingConflict).toBe(true);
    expect(result.summary).not.toBeNull();
    expect(result.summary.message).toContain("Возврат в 13:00 конфликтует с забором в 14:00");
    expect(result.summary.message).toContain("Реальная разница (буфер): 1 ч");
    expect(result.summary.message).not.toContain("-9 ч 59 мин");
  });

  it("ignores the current order even when ids come in with different runtime types", () => {
    const editingOrder = createMockOrder({
      id: "editing",
      customerName: "Edited order",
      confirmed: true,
      startDate: "2026-03-15",
      startTime: "14:00",
      endDate: "2026-03-16",
      endTime: "13:00",
    });

    const sameOrderFromList = {
      ...editingOrder,
      _id: {
        toString: () => "editing",
      },
    };

    const result = analyzeOrderTimeConflicts({
      editingOrder,
      orders: [sameOrderFromList],
      date: "2026-03-16",
      editingPickupTime: "14:00",
      editingReturnTime: "13:00",
      bufferHours: 1,
    });

    expect(result.hasBlockingConflict).toBe(false);
    expect(result.summary).toBeNull();
  });

  it("uses pickup-side day boundaries for a start-day overlap with another multi-day order", () => {
    const editingOrder = createMockOrder({
      id: "editing",
      customerName: "Edited order",
      confirmed: true,
      startDate: "2026-04-01",
      startTime: "14:00",
      endDate: "2026-04-05",
      endTime: "12:00",
    });

    const ongoingConfirmed = createMockOrder({
      id: "confirmed-2",
      customerName: "Vadym Kirieiev",
      email: "ntf.elcor@gmail.com",
      confirmed: true,
      startDate: "2026-03-30",
      startTime: "14:00",
      endDate: "2026-04-02",
      endTime: "12:00",
    });

    const result = analyzeOrderTimeConflicts({
      editingOrder,
      orders: [editingOrder, ongoingConfirmed],
      date: "2026-03-31",
      editingPickupDate: "2026-03-31",
      editingReturnDate: "2026-04-05",
      editingPickupTime: "14:00",
      editingReturnTime: "12:00",
      bufferHours: 1,
    });

    expect(result.hasBlockingConflict).toBe(true);
    expect(result.summary).not.toBeNull();
    expect(result.summary.message).toContain("Забор в 14:00 конфликтует с возвратом в 23:59");
    expect(result.summary.message).toContain("Реальная разница (буфер): -9 ч 59 мин");
    expect(result.summary.message).not.toContain("Возврат в 12:00 конфликтует с забором в 14:00");
    expect(result.summary.message).not.toContain("-23 ч 59 мин");
  });
});
