import fc from "fast-check";
import dayjs from "dayjs";

// YYYY-MM-DD strings
export const dateStrArb = fc
  .date({ min: new Date("2025-01-01"), max: new Date("2027-12-31") })
  .map((d) => dayjs(d).format("YYYY-MM-DD"));

// dayjs date
export const dayjsDateArb = dateStrArb.map((d) => dayjs(d));

// Array of unique dates
export const dateArrayArb = fc.uniqueArray(dateStrArb, {
  minLength: 0,
  maxLength: 10,
});

// Boolean
export const boolArb = fc.boolean();

// Overlap date objects
export const overlapDatesArb = fc.array(
  fc.record({
    date: dateStrArb,
    confirmed: fc.integer({ min: 0, max: 5 }),
    pending: fc.integer({ min: 0, max: 5 }),
  }),
  { maxLength: 5 }
);

// Start / End overlap objects
export const startEndOverlapArb = fc.array(
  fc.record({
    date: dateStrArb,
    startConfirmed: boolArb,
    endConfirmed: boolArb,
  }),
  { maxLength: 5 }
);

