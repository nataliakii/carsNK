import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  AVAILABILITY_PURPOSE,
  CONFLICT_TYPE,
  evaluateRentalAvailability,
  serializePublicBlockedIntervals,
} from "../availabilityEngine";
import { BOOKING_MODES } from "../bookingMode";
import { BOOKING_STATUS } from "../bookingStatus";
import { isOrderDateBlocking } from "@/domain/orders/isOrderDateBlocking";

dayjs.extend(utc);
dayjs.extend(timezone);

function utcFrom(localDate, localTime, tz) {
  return dayjs.tz(`${localDate} ${localTime}`, "YYYY-MM-DD HH:mm", tz).utc().toDate();
}

const ATHENS = "Europe/Athens";
const CAR_ID = "car-1";

function order({
  id,
  confirmed = false,
  offline = false,
  start = "2026-06-10 10:00",
  end = "2026-06-12 10:00",
  bookingStatus,
  customerName = "Secret Customer",
  email = "secret@example.com",
} = {}) {
  const [sd, st] = start.split(" ");
  const [ed, et] = end.split(" ");
  const timeIn = utcFrom(sd, st, ATHENS);
  const timeOut = utcFrom(ed, et, ATHENS);
  return {
    _id: id,
    car: CAR_ID,
    confirmed,
    offline,
    bookingStatus,
    customerName,
    email,
    timeIn,
    timeOut,
    rentalStartDate: timeIn,
    rentalEndDate: timeOut,
    timezone: ATHENS,
  };
}

function evalAvail(pickup, ret, existing, extra = {}) {
  const [pd, pt] = pickup.split(" ");
  const [rd, rt] = ret.split(" ");
  return evaluateRentalAvailability({
    carId: CAR_ID,
    pickupAtUtc: utcFrom(pd, pt, ATHENS),
    returnAtUtc: utcFrom(rd, rt, ATHENS),
    timezone: ATHENS,
    existingOrders: existing,
    bufferHours: extra.bufferHours ?? 0,
    purpose: extra.purpose || AVAILABILITY_PURPOSE.REQUEST,
    bookingMode: extra.bookingMode || BOOKING_MODES.OPS_CALENDAR,
    excludeOrderId: extra.excludeOrderId,
    minDurationHours: extra.minDurationHours,
  });
}

describe("evaluateRentalAvailability", () => {
  test("exact overlap is a hard conflict", () => {
    const existing = [
      order({ id: "a", confirmed: true, start: "2026-06-10 10:00", end: "2026-06-12 10:00" }),
    ];
    const result = evalAvail("2026-06-10 10:00", "2026-06-12 10:00", existing);
    expect(result.hardConflict).toBe(true);
    expect(result.conflictType).toBe(CONFLICT_TYPE.OVERLAP);
  });

  test("containment both directions", () => {
    const inner = [
      order({ id: "a", confirmed: true, start: "2026-06-11 10:00", end: "2026-06-11 18:00" }),
    ];
    expect(evalAvail("2026-06-10 10:00", "2026-06-12 10:00", inner).hardConflict).toBe(true);
    const outer = [
      order({ id: "a", confirmed: true, start: "2026-06-09 10:00", end: "2026-06-13 10:00" }),
    ];
    expect(evalAvail("2026-06-10 10:00", "2026-06-12 10:00", outer).hardConflict).toBe(true);
  });

  test("equal start / equal end overlap", () => {
    const existing = [
      order({ id: "a", confirmed: true, start: "2026-06-10 10:00", end: "2026-06-12 10:00" }),
    ];
    expect(evalAvail("2026-06-10 10:00", "2026-06-11 10:00", existing).hardConflict).toBe(true);
    expect(evalAvail("2026-06-11 10:00", "2026-06-12 10:00", existing).hardConflict).toBe(true);
  });

  test("touching boundaries without buffer are allowed (half-open)", () => {
    const existing = [
      order({ id: "a", confirmed: true, start: "2026-06-10 10:00", end: "2026-06-12 10:00" }),
    ];
    const result = evalAvail("2026-06-12 10:00", "2026-06-14 10:00", existing);
    expect(result.hardConflict).toBe(false);
    expect(result.available).toBe(true);
  });

  test("same-day turnover without buffer is allowed", () => {
    const existing = [
      order({ id: "a", confirmed: true, start: "2026-06-10 10:00", end: "2026-06-12 10:00" }),
    ];
    expect(evalAvail("2026-06-12 10:00", "2026-06-12 18:00", existing).available).toBe(true);
  });

  test("buffer conflict is BOUNDARY_BUFFER and hard", () => {
    const existing = [
      order({ id: "a", confirmed: true, start: "2026-06-10 10:00", end: "2026-06-12 10:00" }),
    ];
    const result = evalAvail("2026-06-12 11:00", "2026-06-14 10:00", existing, {
      bufferHours: 2,
    });
    expect(result.hardConflict).toBe(true);
    expect(result.conflictType).toBe(CONFLICT_TYPE.BOUNDARY_BUFFER);
  });

  test("confirmed order blocks", () => {
    const existing = [order({ id: "a", confirmed: true })];
    expect(evalAvail("2026-06-10 12:00", "2026-06-11 12:00", existing).hardConflict).toBe(true);
  });

  test("offline order blocks", () => {
    const existing = [order({ id: "a", offline: true, confirmed: false })];
    expect(evalAvail("2026-06-10 12:00", "2026-06-11 12:00", existing).hardConflict).toBe(true);
  });

  test("pending marketplace request does not hard-block", () => {
    const existing = [
      order({
        id: "pending",
        confirmed: false,
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      }),
    ];
    const result = evalAvail("2026-06-10 12:00", "2026-06-11 12:00", existing, {
      bookingMode: BOOKING_MODES.MARKETPLACE_REQUEST,
    });
    expect(result.hardConflict).toBe(false);
    expect(result.softConflict).toBe(true);
    expect(result.conflictType).toBe(CONFLICT_TYPE.PENDING_OVERLAP);
  });

  test("cancelled order does not block", () => {
    const existing = [
      order({
        id: "c",
        confirmed: false,
        bookingStatus: BOOKING_STATUS.CUSTOMER_CANCELLED,
      }),
    ];
    expect(evalAvail("2026-06-10 12:00", "2026-06-11 12:00", existing).hardConflict).toBe(false);
  });

  test("edit excludes itself", () => {
    const self = order({ id: "self", confirmed: true });
    const result = evalAvail("2026-06-10 10:00", "2026-06-12 10:00", [self], {
      excludeOrderId: "self",
      purpose: AVAILABILITY_PURPOSE.ADMIN_EDIT,
    });
    expect(result.hardConflict).toBe(false);
  });

  test("old 408 boundary-time case now rejects (does not create)", () => {
    const existing = [
      order({
        id: "a",
        confirmed: true,
        start: "2026-06-10 10:00",
        end: "2026-06-12 18:00",
      }),
    ];
    const result = evalAvail("2026-06-12 17:00", "2026-06-14 10:00", existing);
    expect(result.hardConflict).toBe(true);
    expect(result.available).toBe(false);
  });

  test("no customer PII in conflict response", () => {
    const existing = [
      order({ id: "a", confirmed: true, customerName: "Ivan Petrov", email: "ivan@x.com" }),
    ];
    const result = evalAvail("2026-06-10 12:00", "2026-06-11 12:00", existing);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/Ivan Petrov/);
    expect(blob).not.toMatch(/ivan@x.com/);
    expect(result.blockingRecords[0].customerName).toBeUndefined();
    expect(result.blockingRecords[0].email).toBeUndefined();
  });

  test("pickup must be before return", () => {
    const result = evalAvail("2026-06-12 10:00", "2026-06-10 10:00", []);
    expect(result.hardConflict).toBe(true);
    expect(result.conflictType).toBe(CONFLICT_TYPE.INVALID_RANGE);
  });

  test("serializePublicBlockedIntervals has no PII", () => {
    const intervals = serializePublicBlockedIntervals(
      [order({ id: "a", confirmed: true, customerName: "Hidden" })],
      { timezone: ATHENS }
    );
    expect(JSON.stringify(intervals)).not.toMatch(/Hidden/);
    expect(intervals[0].orderId).toBe("a");
  });
});

describe("isOrderDateBlocking compatibility", () => {
  test("legacy confirmed/offline still block", () => {
    expect(isOrderDateBlocking({ confirmed: true })).toBe(true);
    expect(isOrderDateBlocking({ offline: true, confirmed: false })).toBe(true);
    expect(isOrderDateBlocking({ confirmed: false })).toBe(false);
  });

  test("pending supplier confirmation does not block", () => {
    expect(
      isOrderDateBlocking({
        confirmed: false,
        bookingStatus: BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION,
      })
    ).toBe(false);
  });
});
