import dayjs from "dayjs";
import {
  fromServerUTC,
  formatDateYYYYMMDD,
  athensStartOfDay,
  formatTimeHHMM,
} from "@/domain/time/athensTime";

function carIdFromOrder(o) {
  if (!o) return "";
  return String(o.car?._id ?? o.car ?? "");
}

/**
 * Снимок полей заказа для сравнения «сервер vs форма» (как после инициализации useEditOrderState).
 */
export function snapshotFromServerOrder(order) {
  if (!order) return null;
  const rentalStartDateAthens = fromServerUTC(order.rentalStartDate);
  const rentalEndDateAthens = fromServerUTC(order.rentalEndDate);
  const startDateAthens = athensStartOfDay(
    formatDateYYYYMMDD(rentalStartDateAthens)
  );
  const endDateAthens = athensStartOfDay(
    formatDateYYYYMMDD(rentalEndDateAthens)
  );
  const ti = fromServerUTC(order.timeIn);
  const to = fromServerUTC(order.timeOut);
  return {
    car: carIdFromOrder(order),
    rentalStart: formatDateYYYYMMDD(startDateAthens),
    rentalEnd: formatDateYYYYMMDD(endDateAthens),
    timeIn: ti?.isValid?.() ? formatTimeHHMM(ti) : "",
    timeOut: to?.isValid?.() ? formatTimeHHMM(to) : "",
    placeIn: String(order.placeIn ?? ""),
    placeOut: String(order.placeOut ?? ""),
    placeInDetail: String(order.placeInDetail ?? ""),
    placeOutDetail: String(order.placeOutDetail ?? ""),
    ChildSeats: Number(order.ChildSeats ?? order.childSeats ?? 0),
    insurance: String(order.insurance || "TPL"),
    franchiseOrder:
      order.franchiseOrder !== undefined && order.franchiseOrder !== null
        ? String(order.franchiseOrder)
        : "",
    totalPrice: Number(order.totalPrice) || 0,
    OverridePrice:
      order.OverridePrice === undefined || order.OverridePrice === null
        ? null
        : Number(order.OverridePrice),
    numberOfDays: Number(order.numberOfDays) || 0,
    customerName: String(order.customerName ?? ""),
    phone: String(order.phone ?? ""),
    email: String(order.email ?? ""),
    secondDriver: Boolean(order.secondDriver),
    Viber: Boolean(order.Viber),
    Whatsapp: Boolean(order.Whatsapp),
    Telegram: Boolean(order.Telegram),
    flightNumber: String(order.flightNumber ?? ""),
    drivingLicenceUrls: JSON.stringify(order.drivingLicenceUrls ?? []),
  };
}

export function snapshotFromEditedOrder(editedOrder, startTime, endTime) {
  if (!editedOrder) return null;
  const rentalStart = editedOrder.rentalStartDate
    ? formatDateYYYYMMDD(editedOrder.rentalStartDate)
    : "";
  const rentalEnd = editedOrder.rentalEndDate
    ? formatDateYYYYMMDD(editedOrder.rentalEndDate)
    : "";
  return {
    car: carIdFromOrder(editedOrder),
    rentalStart,
    rentalEnd,
    timeIn:
      startTime && dayjs.isDayjs(startTime) && startTime.isValid()
        ? formatTimeHHMM(startTime)
        : "",
    timeOut:
      endTime && dayjs.isDayjs(endTime) && endTime.isValid()
        ? formatTimeHHMM(endTime)
        : "",
    placeIn: String(editedOrder.placeIn ?? ""),
    placeOut: String(editedOrder.placeOut ?? ""),
    placeInDetail: String(editedOrder.placeInDetail ?? ""),
    placeOutDetail: String(editedOrder.placeOutDetail ?? ""),
    ChildSeats: Number(editedOrder.ChildSeats ?? 0),
    insurance: String(editedOrder.insurance || "TPL"),
    franchiseOrder:
      editedOrder.franchiseOrder !== undefined &&
      editedOrder.franchiseOrder !== null
        ? String(editedOrder.franchiseOrder)
        : "",
    totalPrice: Number(editedOrder.totalPrice) || 0,
    OverridePrice:
      editedOrder.OverridePrice === undefined ||
      editedOrder.OverridePrice === null
        ? null
        : Number(editedOrder.OverridePrice),
    numberOfDays: Number(editedOrder.numberOfDays) || 0,
    customerName: String(editedOrder.customerName ?? ""),
    phone: String(editedOrder.phone ?? ""),
    email: String(editedOrder.email ?? ""),
    secondDriver: Boolean(editedOrder.secondDriver),
    Viber: Boolean(editedOrder.Viber),
    Whatsapp: Boolean(editedOrder.Whatsapp),
    Telegram: Boolean(editedOrder.Telegram),
    flightNumber: String(editedOrder.flightNumber ?? ""),
    drivingLicenceUrls: JSON.stringify(editedOrder.drivingLicenceUrls ?? []),
  };
}

export function isOrderEditDirty(
  order,
  editedOrder,
  startTime,
  endTime,
  viewOnly
) {
  if (viewOnly) return false;
  if (!order || !editedOrder) return false;
  const a = snapshotFromServerOrder(order);
  const b = snapshotFromEditedOrder(editedOrder, startTime, endTime);
  if (!a || !b) return false;
  return JSON.stringify(a) !== JSON.stringify(b);
}

/**
 * Снимок формы AddOrderModal для сравнения с baseline после открытия.
 */
export function buildAddOrderSnapshot(bookDates, orderDetails, startTime, endTime) {
  const ti = dayjs(startTime);
  const to = dayjs(endTime);
  return {
    start: bookDates?.start || "",
    end: bookDates?.end || "",
    timeIn: ti.isValid() ? formatTimeHHMM(ti) : "",
    timeOut: to.isValid() ? formatTimeHHMM(to) : "",
    placeIn: String(orderDetails.placeIn ?? ""),
    placeOut: String(orderDetails.placeOut ?? ""),
    placeInDetail: String(orderDetails.placeInDetail ?? ""),
    placeOutDetail: String(orderDetails.placeOutDetail ?? ""),
    customerName: String(orderDetails.customerName ?? ""),
    phone: String(orderDetails.phone ?? ""),
    email: String(orderDetails.email ?? ""),
    secondDriver: Boolean(orderDetails.secondDriver),
    Viber: Boolean(orderDetails.Viber),
    Whatsapp: Boolean(orderDetails.Whatsapp),
    Telegram: Boolean(orderDetails.Telegram),
    totalPrice: Number(orderDetails.totalPrice) || 0,
    numberOfDays: Number(orderDetails.numberOfDays) || 0,
    confirmed: Boolean(orderDetails.confirmed),
    my_order: Boolean(orderDetails.my_order),
    ChildSeats: Number(orderDetails.ChildSeats) || 0,
    insurance: String(orderDetails.insurance || ""),
    franchiseOrder:
      orderDetails.franchiseOrder !== undefined &&
      orderDetails.franchiseOrder !== null
        ? String(orderDetails.franchiseOrder)
        : "",
    orderNumber: String(orderDetails.orderNumber ?? ""),
    flightNumber: String(orderDetails.flightNumber ?? ""),
    drivingLicenceUrls: JSON.stringify(orderDetails.drivingLicenceUrls ?? []),
  };
}

export function isAddOrderDirty(currentSnapshot, baselineSnapshot) {
  if (!baselineSnapshot || !currentSnapshot) return false;
  return JSON.stringify(currentSnapshot) !== JSON.stringify(baselineSnapshot);
}
