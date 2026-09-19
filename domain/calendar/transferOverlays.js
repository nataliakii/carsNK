/**
 * Map claimed transfers onto rental-fleet cars for calendar overlay.
 *
 * A transfer appears only when `assignedCarId` points to a car that is in the
 * visible rental fleet (same vehicle used for transfer + rentals).
 *
 * Only active claim statuses are shown.
 */

export const CALENDAR_TRANSFER_STATUSES = new Set([
  "CLAIMED",
  "CONFIRMED",
  "COMPLETED",
]);

const DEFAULT_DURATION_MINUTES = 120;

/**
 * @param {object} transfer
 * @param {Array<{_id?: string, ownerId?: string}>} cars
 * @returns {Array<object>} matching cars
 */
export function carsForTransferOverlay(transfer, cars) {
  const list = Array.isArray(cars) ? cars : [];
  if (!transfer || !list.length) return [];

  const assignedId = transfer.assignedCarId
    ? String(transfer.assignedCarId)
    : "";
  if (!assignedId) return [];

  const car = list.find((c) => String(c?._id || "") === assignedId);
  return car ? [car] : [];
}

/**
 * Build read-only pseudo-orders for BigCalendar from transfers + fleet cars.
 *
 * @param {object[]} transfers
 * @param {object[]} cars
 * @returns {object[]}
 */
export function buildTransferCalendarOverlays(transfers, cars) {
  const items = Array.isArray(transfers) ? transfers : [];
  const out = [];

  for (const transfer of items) {
    const status = String(transfer?.status || "").toUpperCase();
    if (!CALENDAR_TRANSFER_STATUSES.has(status)) continue;
    if (!transfer?.datetime) continue;

    const matchedCars = carsForTransferOverlay(transfer, cars);
    if (!matchedCars.length) continue;

    const start = new Date(transfer.datetime);
    if (Number.isNaN(start.getTime())) continue;

    const durationMin =
      Number(transfer.durationMinutes) > 0
        ? Number(transfer.durationMinutes)
        : Number(transfer.quoteSnapshot?.durationMinutes) > 0
          ? Number(transfer.quoteSnapshot.durationMinutes)
          : DEFAULT_DURATION_MINUTES;
    const end = new Date(start.getTime() + durationMin * 60 * 1000);

    const label = [transfer.from || "?", "→", transfer.to || "?"].join(" ");

    for (const car of matchedCars) {
      const carId = String(car._id);
      out.push({
        _id: `transfer:${String(transfer._id)}:${carId}`,
        transferId: String(transfer._id),
        car: carId,
        rentalStartDate: start.toISOString(),
        rentalEndDate: end.toISOString(),
        timeIn: start.toISOString(),
        timeOut: end.toISOString(),
        confirmed: true,
        my_order: false,
        offline: false,
        customerName: `Transfer: ${label}`,
        customerFirstName: transfer.customerFirstName || "",
        customerLastName: transfer.customerLastName || "",
        phone: transfer.phone || "",
        email: transfer.email || "",
        status: status === "COMPLETED" ? "PAID_AND_CLOSED" : "CONFIRMED",
        _calendarKind: "transfer",
        isTransferOverlay: true,
        numberOfDays: 1,
      });
    }
  }

  return out;
}
