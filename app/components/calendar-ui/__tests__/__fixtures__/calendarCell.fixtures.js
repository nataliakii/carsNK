import dayjs from "dayjs";

// -----------------------
// Base date
// -----------------------
export const baseDate = dayjs("2026-01-10");
export const dateStr = "2026-01-10";

// -----------------------
// Orders
// -----------------------
export const baseCarOrders = [
  {
    _id: "o1",
    rentalStartDate: "2026-01-10T10:00:00Z",
    rentalEndDate: "2026-01-12T10:00:00Z",
    confirmed: true,
  },
];

export const completedCarOrders = [
  {
    _id: "o-completed",
    rentalStartDate: "2025-12-01T10:00:00Z",
    rentalEndDate: "2025-12-05T10:00:00Z",
    confirmed: true,
  },
];

// Date used for completed-order tests (must be within completedCarOrders range)
export const completedDate = dayjs("2025-12-03");
export const completedDateStr = "2025-12-03";

// -----------------------
// Orders per date
// -----------------------
export const ordersForDate = [baseCarOrders[0]];
export const emptyOrdersForDate = [];

// -----------------------
// Dates collections
// -----------------------
export const confirmedDates = ["2026-01-10"];
export const unavailableDates = [];

export const startEndDates = [{ date: "2026-01-10", type: "start", orderId: "o1" }];
export const emptyStartEndDates = [];

export const overlapDates = [];
export const overlapDatesFixture = [{ date: "2026-01-10", confirmed: 2, pending: 1 }];

export const startEndOverlapDates = [];
export const startEndOverlapDatesFixture = [
  {
    date: "2026-01-10",
    startConfirmed: true,
    endConfirmed: true,
  },
];

// -----------------------
// Move mode
// -----------------------
export const selectedOrderDates = ["2026-01-10", "2026-01-11"];

