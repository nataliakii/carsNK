import { Order } from "@models/order";
import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
// 🔧 FIXED: Use orderAccessPolicy directly (no legacy shims)
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { ROLE } from "@/domain/orders/admin-rbac";
import { getBusinessRentalDaysByMinutes } from "@/domain/orders/numberOfDays";
import { toBusinessStartOfDay, toStoredBusinessDate } from "@/domain/time/businessDate";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function getBusinessDaySpan(start, end) {
  return getBusinessRentalDaysByMinutes(start, end);
}

// ИСПРАВЛЕННАЯ функция проверки конфликтов
function checkConflictsFixed(allOrders, newStart, newEnd) {
  const conflictingOrders = [];
  const conflictDates = { start: null, end: null };

  for (const existingOrder of allOrders) {
    const existingStart = dayjs(existingOrder.timeIn);
    const existingEnd = dayjs(existingOrder.timeOut);

    // КЛЮЧЕВАЯ ЛОГИКА: заказы НЕ конфликтуют если "касаются" по времени
    const newEndsWhenExistingStarts = newEnd.isSame(existingStart);
    const newStartsWhenExistingEnds = newStart.isSame(existingEnd);

    // Если заказы касаются - это НЕ конфликт
    if (newEndsWhenExistingStarts || newStartsWhenExistingEnds) {
      continue;
    }

    // Проверяем реальное пересечение периодов
    const hasOverlap =
      newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);

    if (hasOverlap) {
      conflictingOrders.push(existingOrder);

      // Определяем конкретные конфликтные времена
      if (newStart.isBefore(existingEnd) && newStart.isAfter(existingStart)) {
        conflictDates.start = existingStart.toISOString();
      }
      if (newEnd.isAfter(existingStart) && newEnd.isBefore(existingEnd)) {
        conflictDates.end = existingEnd.toISOString();
      }
    }
  }

  if (conflictingOrders.length === 0) {
    return { status: null, data: null }; // Нет конфликтов
  }

  // Проверяем подтвержденность конфликтующих заказов
  const confirmedConflicts = conflictingOrders.filter(
    (order) => order.confirmed
  );

  if (confirmedConflicts.length > 0) {
    // Конфликт с подтвержденными заказами - блокируем
    return {
      status: 409,
      data: {
        conflictMessage: `Time has conflict with confirmed bookings`,
        conflictDates,
        conflictingOrders: confirmedConflicts,
      },
    };
  } else {
    // Конфликт только с неподтвержденными заказами
    return {
      status: 202,
      data: {
        conflictMessage: `Time has conflict with unconfirmed bookings`,
        conflictDates,
        conflictOrdersIds: conflictingOrders.map((order) =>
          order._id.toString()
        ),
        conflictingOrders,
      },
    };
  }
}

export const PUT = async (req) => {
  try {
    await connectToDB();
    
    // Check admin authentication
    const { session, errorResponse } = await requireAdmin(req);
    if (errorResponse) return errorResponse;

    const {
      _id,
      rentalStartDate,
      rentalEndDate,
      timeIn,
      timeOut,
      placeIn,
      placeOut,
      placeInDetail,
      placeOutDetail,
      car, // id нового автомобиля
      ChildSeats,
      insurance,
      franchiseOrder,
      totalPrice: totalPriceFromClient,
    } = await req.json();

    console.log("PAYLOAD FROM FRONTEND:", { ChildSeats, insurance });

    // Найти заказ
    const order = await Order.findById(_id).populate("car");

    if (!order) {
      return new Response(JSON.stringify({ message: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // 🔧 FIXED: Check permissions using orderAccessPolicy (SSOT)
    const timeBucket = getTimeBucket(order);
    const isPast = timeBucket === "PAST";
    const access = getOrderAccess({
      role: session.user.role === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN",
      isClientOrder: order.my_order === true,
      confirmed: order.confirmed === true,
      isPast,
      timeBucket,
    });
    
    // Check if user can edit at all
    if (access.isViewOnly) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "У вас нет прав на редактирование этого заказа",
          code: "PERMISSION_DENIED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Check permissions for each field being updated (field-level granularity)
    const fieldsToCheck = [
      { field: "rentalStartDate", inPayload: rentalStartDate !== undefined },
      { field: "rentalEndDate", inPayload: rentalEndDate !== undefined },
      { field: "timeIn", inPayload: timeIn !== undefined },
      { field: "timeOut", inPayload: timeOut !== undefined },
      { field: "car", inPayload: car !== undefined },
      { field: "placeIn", inPayload: placeIn !== undefined },
      { field: "placeOut", inPayload: placeOut !== undefined },
      { field: "placeInDetail", inPayload: placeInDetail !== undefined },
      { field: "placeOutDetail", inPayload: placeOutDetail !== undefined },
      { field: "insurance", inPayload: insurance !== undefined },
      { field: "ChildSeats", inPayload: ChildSeats !== undefined },
      { field: "franchiseOrder", inPayload: franchiseOrder !== undefined },
      { field: "totalPrice", inPayload: totalPriceFromClient !== undefined },
    ];

    for (const { field, inPayload } of fieldsToCheck) {
      if (inPayload) {
        // Check if field is in disabledFields
        const isFieldDisabled = access.disabledFields?.includes(field);
        if (isFieldDisabled) {
          return new Response(
            JSON.stringify({ 
              success: false,
              message: `Нельзя изменить поле ${field} для этого заказа`,
              code: "PERMISSION_DENIED",
              field: field,
            }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Если выбран новый автомобиль, обновляем его в заказе
    if (car && (!order.car || String(order.car._id) !== car)) {
      const newCar = await Car.findById(car);
      if (!newCar) {
        return new Response(JSON.stringify({ message: "Car not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      order.car = newCar._id;
    }

    // Получаем объект автомобиля для расчётов
    let carDoc;
    if (order.car && typeof order.car === "object" && order.car._id) {
      carDoc = order.car;
    } else {
      carDoc = await Car.findById(order.car);
    }

    // Конвертация дат и времени
    const newStartDate = rentalStartDate
      ? toBusinessStartOfDay(rentalStartDate)
      : toBusinessStartOfDay(order.rentalStartDate);

    const newEndDate = rentalEndDate
      ? toBusinessStartOfDay(rentalEndDate)
      : toBusinessStartOfDay(order.rentalEndDate);
    const newTimeIn = timeIn ? dayjs(timeIn) : dayjs(order.timeIn);
    const newTimeOut = timeOut ? dayjs(timeOut) : dayjs(order.timeOut);

    const { start, end } = await timeAndDate(
      newStartDate,
      newEndDate,
      newTimeIn,
      newTimeOut
    );

    // ДОБАВЛЯЕМ ОТЛАДОЧНУЮ ИНФОРМАЦИЮ
    console.log("=== DEBUGGING ORDER UPDATE ===");
    console.log("Order ID:", _id);
    console.log("New time period:", {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    // Ensure rental duration is positive
    if (getBusinessDaySpan(start, end) <= 0) {
      return new Response(
        JSON.stringify({
          message: "Start and end dates cannot be the same.",
        }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if current order already has conflicting dates
    const { resolvedConflicts, stillConflictingOrders } =
      await checkForResolvedConflicts(order, start, end);

    // Remove resolved conflicts from order
    if (resolvedConflicts.length > 0) {
      order.hasConflictDates = order.hasConflictDates.filter(
        (id) => !resolvedConflicts.includes(id.toString())
      );
    }

    // Fetch all orders for the car, excluding the current order
    const allOrders = await Order.find({
      car: order.car,
      _id: { $ne: _id },
    });

    console.log(
      "Existing orders for car:",
      allOrders.map((o) => ({
        id: o._id.toString(),
        timeIn: dayjs(o.timeIn).toISOString(),
        timeOut: dayjs(o.timeOut).toISOString(),
        confirmed: o.confirmed,
      }))
    );

    // ИСПОЛЬЗУЕМ ИСПРАВЛЕННУЮ функцию проверки конфликтов
    const { status, data } = checkConflictsFixed(allOrders, start, end);

    console.log("Conflict check result:", { status, data });

    if (status) {
      switch (status) {
        case 409:
          return new Response(
            JSON.stringify({
              message: data?.conflictMessage,
              conflictDates: data?.conflictDates,
            }),
            {
              status: 409,
              headers: { "Content-Type": "application/json" },
            }
          );
        case 408:
          return new Response(
            JSON.stringify({
              message: data.conflictMessage,
              conflictDates: data.conflictDates,
            }),
            {
              status: 408,
              headers: { "Content-Type": "application/json" },
            }
          );
        case 202:
          // Update the order and add new pending orderConflicts
          let totalPrice202 = order.totalPrice; // 🔧 FIX: Preserve existing price by default
          let days202 = getBusinessDaySpan(start, end);
          
          // Check if dates or price-affecting fields changed (not just time)
          const datesChanged202 =
            rentalStartDate !== undefined || rentalEndDate !== undefined;
          const timesChanged202 =
            timeIn !== undefined || timeOut !== undefined;
          const priceAffectingFieldsChanged202 = insurance !== undefined || ChildSeats !== undefined || car !== undefined;
          
          if (datesChanged202 || timesChanged202 || priceAffectingFieldsChanged202) {
            // Only recalculate if dates or price-affecting fields changed
            if (carDoc && carDoc.calculateTotalRentalPricePerDay) {
              const result = await carDoc.calculateTotalRentalPricePerDay(
                start,
                end,
                insurance ?? order.insurance,
                ChildSeats ?? order.ChildSeats,
                Boolean(order.secondDriver)
              );
              totalPrice202 = result.total;
              days202 = result.days;
            }
          }
          order.rentalStartDate = toStoredBusinessDate(start);
          order.rentalEndDate = toStoredBusinessDate(end);
          order.numberOfDays = days202;
          order.totalPrice = totalPrice202;
          order.timeIn = start.toDate();
          order.timeOut = end.toDate();
          order.placeIn = placeIn || order.placeIn;
          order.placeOut = placeOut || order.placeOut;
          if (placeInDetail !== undefined) {
            order.placeInDetail = String(placeInDetail ?? "").trim();
          }
          if (placeOutDetail !== undefined) {
            order.placeOutDetail = String(placeOutDetail ?? "").trim();
          }
          order.hasConflictDates = [
            ...new Set([
              ...order.hasConflictDates,
              ...data.conflictOrdersIds,
              ...stillConflictingOrders,
            ]),
          ];

          order.ChildSeats =
            typeof ChildSeats !== "undefined" ? ChildSeats : order.ChildSeats;
          order.insurance =
            typeof insurance !== "undefined" ? insurance : order.insurance;

          const updatedOrder = await order.save();

          return new Response(
            JSON.stringify({
              message: data.conflictMessage,
              conflicts: data.conflictDates,
              updatedOrder: updatedOrder,
            }),
            {
              status: 202,
              headers: { "Content-Type": "application/json" },
            }
          );
      }
    }

    // Recalculate the rental details
    let totalPrice = order.totalPrice; // 🔧 FIX: Preserve existing price by default
    let days = getBusinessDaySpan(start, end);
    
    // Check if dates or price-affecting fields changed (not just time)
    const datesChanged = rentalStartDate !== undefined || rentalEndDate !== undefined;
    const timesChanged = timeIn !== undefined || timeOut !== undefined;
    const priceAffectingFieldsChanged = insurance !== undefined || ChildSeats !== undefined || car !== undefined;
    
    if (
      typeof totalPriceFromClient === "number" &&
      !isNaN(totalPriceFromClient)
    ) {
      // Manual price override
      totalPrice = totalPriceFromClient;
    } else if (datesChanged || timesChanged || priceAffectingFieldsChanged) {
      // Only recalculate if dates or price-affecting fields changed
      if (carDoc && carDoc.calculateTotalRentalPricePerDay) {
        const result = await carDoc.calculateTotalRentalPricePerDay(
          start,
          end,
          insurance ?? order.insurance,
          ChildSeats ?? order.ChildSeats,
          Boolean(order.secondDriver)
        );
        totalPrice = result.total;
        days = result.days;
      }
    }
    // Update the order
    order.rentalStartDate = toStoredBusinessDate(start);
    order.rentalEndDate = toStoredBusinessDate(end);
    order.numberOfDays = days;
    order.totalPrice = totalPrice;
    order.timeIn = start.toDate();
    order.timeOut = end.toDate();
    order.placeIn = placeIn || order.placeIn;
    order.placeOut = placeOut || order.placeOut;
    if (placeInDetail !== undefined) {
      order.placeInDetail = String(placeInDetail ?? "").trim();
    }
    if (placeOutDetail !== undefined) {
      order.placeOutDetail = String(placeOutDetail ?? "").trim();
    }

    order.ChildSeats =
      typeof ChildSeats !== "undefined" ? ChildSeats : order.ChildSeats;
    order.insurance =
      typeof insurance !== "undefined" ? insurance : order.insurance;
    order.franchiseOrder =
      typeof franchiseOrder !== "undefined"
        ? franchiseOrder
        : order.franchiseOrder;

    console.log("SERVER: заказ перед сохранением:", {
      rentalStartDate: order.rentalStartDate,
      rentalEndDate: order.rentalEndDate,
      timeIn: order.timeIn,
      timeOut: order.timeOut,
      placeIn: order.placeIn,
      placeOut: order.placeOut,
      ChildSeats: order.ChildSeats,
      insurance: order.insurance,
      franchiseOrder: order.franchiseOrder,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      car: order.car,
      carModel: order.carModel,
      carNumber: order.carNumber,
      confirmed: order.confirmed,
      hasConflictDates: order.hasConflictDates,
      numberOfDays: order.numberOfDays,
      totalPrice: order.totalPrice,
      my_order: order.my_order,
    });

    const savedOrder = await order.save();

    console.log("Order updated successfully");

    // In dev mode, re-read from DB to verify persistence
    if (process.env.NODE_ENV !== "production") {
      const reReadOrder = await Order.findById(_id);
      if (reReadOrder) {
        const requestedFields = { rentalStartDate, rentalEndDate, timeIn, timeOut };
        const persistedFields = {
          rentalStartDate: reReadOrder.rentalStartDate?.toISOString(),
          rentalEndDate: reReadOrder.rentalEndDate?.toISOString(),
          timeIn: reReadOrder.timeIn?.toISOString(),
          timeOut: reReadOrder.timeOut?.toISOString(),
        };
        
        // Check if requested fields match persisted fields
        const mismatches = [];
        if (rentalStartDate && persistedFields.rentalStartDate !== toStoredBusinessDate(rentalStartDate).toISOString()) {
          mismatches.push(`rentalStartDate: requested=${toStoredBusinessDate(rentalStartDate).toISOString()}, persisted=${persistedFields.rentalStartDate}`);
        }
        if (rentalEndDate && persistedFields.rentalEndDate !== toStoredBusinessDate(rentalEndDate).toISOString()) {
          mismatches.push(`rentalEndDate: requested=${toStoredBusinessDate(rentalEndDate).toISOString()}, persisted=${persistedFields.rentalEndDate}`);
        }
        if (timeIn && persistedFields.timeIn !== dayjs(timeIn).utc().toISOString()) {
          mismatches.push(`timeIn: requested=${dayjs(timeIn).utc().toISOString()}, persisted=${persistedFields.timeIn}`);
        }
        if (timeOut && persistedFields.timeOut !== dayjs(timeOut).utc().toISOString()) {
          mismatches.push(`timeOut: requested=${dayjs(timeOut).utc().toISOString()}, persisted=${persistedFields.timeOut}`);
        }
        
        if (mismatches.length > 0) {
          console.warn("[changeDates] Update not persisted correctly:", mismatches);
        } else {
          console.log("[changeDates] Update persisted correctly");
        }
      }
    }

    // Return updated order (use savedOrder which has all calculated fields)
    return new Response(
      JSON.stringify({
        message: `ВСЕ ОТЛИЧНО! Даты изменены.`,
        data: savedOrder,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating order:", error);
    return new Response(
      JSON.stringify({ message: `Failed to update order: ${error.message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// Function to check if existing conflicts are resolved after changing dates
async function checkForResolvedConflicts(order, newStartDate, newEndDate) {
  const existingConflicts = order.hasConflictDates || [];

  const resolvedConflicts = [];
  const stillConflictingOrders = [];

  // Check each existing conflict
  for (const conflictId of existingConflicts) {
    const conflictingOrder = await Order.findById(conflictId);

    if (conflictingOrder) {
      // Compare conflicting order dates with new start/end dates
      const conflictStartDate = dayjs(conflictingOrder.rentalStartDate);
      const conflictEndDate = dayjs(conflictingOrder.rentalEndDate);

      // ИСПРАВЛЕНО: используем правильную логику сравнения
      // Конфликт разрешен если заказы НЕ пересекаются (могут касаться)
      const ordersTouch =
        newEndDate.isSame(conflictStartDate) ||
        newStartDate.isSame(conflictEndDate);
      const ordersDoNotOverlap =
        newEndDate.isBefore(conflictStartDate) ||
        newStartDate.isAfter(conflictEndDate);

      if (ordersDoNotOverlap || ordersTouch) {
        resolvedConflicts.push(conflictingOrder._id); // This conflict is resolved
      } else {
        stillConflictingOrders.push(conflictingOrder._id); // Still conflicting
      }
    }
  }

  return { resolvedConflicts, stillConflictingOrders };
}

async function timeAndDate(startDate, endDate, startTime, endTime) {
  // Важно: используем точные моменты startTime/endTime (из клиента/базы),
  // чтобы избежать ошибок из-за локали сервера и DST при пересборке часов.
  return {
    start: dayjs(startTime),
    end: dayjs(endTime),
  };
}
