/**
 * Create offline order stubs (admin bulk).
 * offline: true, confirmed: true, my_order: false — no client notifications.
 */

import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Car } from "@models/car";
import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { COMPANY_ID } from "@config/company";
import { generateOrderNumber } from "@/domain/time/athensTime";
import {
  getBusinessRentalDaysByMinutes,
} from "@/domain/orders/numberOfDays";
import {
  toBusinessStartOfDay,
  toStoredBusinessDate,
} from "@/domain/time/businessDate";
import { setTimeToDatejs } from "@utils/analyzeDates";
import {
  canAccessOwnedDoc,
  normalizeOwnerId,
} from "@/domain/owners/ownerScope";

dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";

async function resolveUniqueOrderNumber(candidate) {
  let n = String(candidate || "").trim() || generateOrderNumber();
  for (let i = 0; i < 8; i += 1) {
    const exists = await Order.exists({ orderNumber: n });
    if (!exists) return n;
    n = generateOrderNumber();
  }
  return `${generateOrderNumber()}-${Date.now()}`;
}

/**
 * @param {object} row
 * @param {{ user: object }} ctx
 */
export async function createOfflineOrderStub(row, ctx) {
  try {
    const user = ctx.user;
    if (!user?.isAdmin) {
      return { ok: false, error: "Admin only" };
    }

    const carId = String(row?.carId || row?.car || "").trim();
    if (!carId || !mongoose.Types.ObjectId.isValid(carId)) {
      return { ok: false, error: "carId is required" };
    }

    const car = await Car.findById(carId);
    if (!car) return { ok: false, error: "Car not found" };
    if (!canAccessOwnedDoc(user, car)) {
      return { ok: false, error: "Forbidden for this car" };
    }

    const customerName = String(row?.customerName || "").trim();
    const phone = String(row?.phone || "").trim();
    if (!customerName) return { ok: false, error: "customerName is required" };
    if (!phone) return { ok: false, error: "phone is required" };

    const startDate = toBusinessStartOfDay(row?.rentalStartDate);
    const endDate = toBusinessStartOfDay(row?.rentalEndDate);
    if (!startDate || !endDate) {
      return { ok: false, error: "rentalStartDate and rentalEndDate required" };
    }
    const days = getBusinessRentalDaysByMinutes(startDate, endDate);
    if (days <= 0) {
      return { ok: false, error: "End date must be after start date" };
    }

    const companyDefaultStart = "14:00";
    const companyDefaultEnd = "12:00";
    const timeInRaw =
      row?.timeIn ||
      setTimeToDatejs(startDate, row?.timeInHm || companyDefaultStart, true);
    const timeOutRaw =
      row?.timeOut ||
      setTimeToDatejs(endDate, row?.timeOutHm || companyDefaultEnd, false);
    const timeIn = dayjs.isDayjs(timeInRaw)
      ? timeInRaw.toDate()
      : timeInRaw;
    const timeOut = dayjs.isDayjs(timeOutRaw)
      ? timeOutRaw.toDate()
      : timeOutRaw;

    const placeIn = String(row?.placeIn || "Nea Kallikratia").trim();
    const placeOut = String(row?.placeOut || placeIn).trim();
    const totalPrice = Number(row?.totalPrice);
    const orderNumber = await resolveUniqueOrderNumber(row?.orderNumber);

    const createdByAdminId =
      mongoose.Types.ObjectId.isValid(String(user.id))
        ? new mongoose.Types.ObjectId(String(user.id))
        : null;

    const ownerId =
      normalizeOwnerId(car.ownerId) || COMPANY_ID;

    const order = new Order({
      carNumber: car.carNumber,
      regNumber: car.regNumber || "",
      customerName,
      phone,
      email: String(row?.email || "").trim(),
      rentalStartDate: toStoredBusinessDate(startDate),
      rentalEndDate: toStoredBusinessDate(endDate),
      car: car._id,
      carModel: car.model,
      numberOfDays: days,
      totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
      timeIn,
      timeOut,
      placeIn,
      placeOut,
      placeInDetail: String(row?.placeInDetail || "").trim(),
      placeOutDetail: String(row?.placeOutDetail || "").trim(),
      date: dayjs().tz(BUSINESS_TZ).toDate(),
      confirmed: true,
      my_order: false,
      offline: true,
      ChildSeats: Number(row?.ChildSeats) || 0,
      insurance: String(row?.insurance || "TPL").trim() || "TPL",
      franchiseOrder: Number(row?.franchiseOrder) || car.franchise || 0,
      orderNumber,
      flightNumber: String(row?.flightNumber || "").trim(),
      Viber: Boolean(row?.Viber),
      Whatsapp: Boolean(row?.Whatsapp),
      Telegram: Boolean(row?.Telegram),
      createdByRole: Number(user.role) === ROLE.SUPERADMIN ? 1 : 0,
      createdByAdminId,
      ownerId,
      secondDriver: Boolean(row?.secondDriver),
    });

    await order.save();

    if (!car.orders.some((id) => String(id) === String(order._id))) {
      car.orders.push(order._id);
      await car.save();
    }

    return {
      ok: true,
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber,
        carNumber: order.carNumber,
        customerName: order.customerName,
      },
    };
  } catch (error) {
    return { ok: false, error: error?.message || "Failed to create order" };
  }
}
