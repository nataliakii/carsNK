import { Order } from "@models/order";
import { Car } from "@models/car";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { ROLE } from "@models/user";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { BUSINESS_TZ } from "@utils/businessTime";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Check for time conflicts when moving order to a new car
 * Uses the same logic as changeDates endpoint
 */
function checkConflictsFixed(allOrders, newStart, newEnd) {
  const conflictingOrders = [];
  const conflictDates = { start: null, end: null };

  // Ensure newStart and newEnd are in BUSINESS_TZ
  const normalizedNewStart = newStart.tz ? newStart : dayjs(newStart).tz(BUSINESS_TZ);
  const normalizedNewEnd = newEnd.tz ? newEnd : dayjs(newEnd).tz(BUSINESS_TZ);

  for (const existingOrder of allOrders) {
    // Use business timezone for conflict checks - normalize ALL dates to BUSINESS_TZ
    const existingStart = dayjs(existingOrder.timeIn).tz(BUSINESS_TZ);
    const existingEnd = dayjs(existingOrder.timeOut).tz(BUSINESS_TZ);

    // КЛЮЧЕВАЯ ЛОГИКА: заказы НЕ конфликтуют если "касаются" по времени
    // Use normalized dates (all in BUSINESS_TZ)
    const newEndsWhenExistingStarts = normalizedNewEnd.isSame(existingStart);
    const newStartsWhenExistingEnds = normalizedNewStart.isSame(existingEnd);

    // Если заказы касаются - это НЕ конфликт
    if (newEndsWhenExistingStarts || newStartsWhenExistingEnds) {
      continue;
    }

    // Проверяем реальное пересечение периодов (all in BUSINESS_TZ)
    const hasOverlap =
      normalizedNewStart.isBefore(existingEnd) && normalizedNewEnd.isAfter(existingStart);

    if (hasOverlap) {
      conflictingOrders.push(existingOrder);

      // Определяем конкретные конфликтные времена (all in BUSINESS_TZ)
      if (normalizedNewStart.isBefore(existingEnd) && normalizedNewStart.isAfter(existingStart)) {
        conflictDates.start = existingStart.toISOString();
      }
      if (normalizedNewEnd.isAfter(existingStart) && normalizedNewEnd.isBefore(existingEnd)) {
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

export const PUT = async (request) => {
  try {
    await connectToDB();

    // Check admin authentication
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    // Parse and validate request body
    const body = await request.json();
    const { orderId, newCarId, newCarNumber } = body;

    // Validation: required fields
    if (!orderId || !newCarId || !newCarNumber) {
      return new Response(
        JSON.stringify({ message: "Missing required fields: orderId, newCarId, newCarNumber" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Authorization: Allow ADMIN and SUPERADMIN
    const userRole = session.user.role;
    if (userRole !== ROLE.ADMIN && userRole !== ROLE.SUPERADMIN) {
      if (process.env.NODE_ENV === "development") {
        console.log("[moveCar] Role check failed:", { userRole, allowed: [ROLE.ADMIN, ROLE.SUPERADMIN] });
      }
      return new Response(
        JSON.stringify({ message: "Forbidden: Only ADMIN and SUPERADMIN can move orders" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Runtime assertion: RBAC guard allows ADMIN
    if (process.env.NODE_ENV === "development") {
      console.log("[moveCar] RBAC check passed:", { userRole, isAdmin: userRole === ROLE.ADMIN, isSuperAdmin: userRole === ROLE.SUPERADMIN });
    }

    // Find order
    const order = await Order.findById(orderId).populate("car");
    if (!order) {
      return new Response(
        JSON.stringify({ message: "Order not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Multi-tenant check (if applicable)
    // If your app has companyId, uncomment and adjust:
    // if (order.companyId && session.user.companyId && order.companyId.toString() !== session.user.companyId.toString()) {
    //   return new Response(
    //     JSON.stringify({ message: "Forbidden: Order belongs to different company" }),
    //     { status: 403, headers: { "Content-Type": "application/json" } }
    //   );
    // }

    // Verify new car exists
    const newCar = await Car.findById(newCarId);
    if (!newCar) {
      return new Response(
        JSON.stringify({ message: "New car not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // No-op check: if order is already on the target car
    if (String(order.car._id || order.car) === String(newCarId)) {
      return new Response(
        JSON.stringify({
          message: "Order is already on this car",
          updatedOrder: order,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check conflicts on target car
    // Get all orders for the target car, excluding current order
    const targetCarOrders = await Order.find({
      car: newCarId,
      _id: { $ne: orderId },
    });

    // Use business timezone for conflict check
    const orderStart = dayjs(order.timeIn).tz(BUSINESS_TZ);
    const orderEnd = dayjs(order.timeOut).tz(BUSINESS_TZ);

    // Check for conflicts
    const { status: conflictStatus, data: conflictData } = checkConflictsFixed(
      targetCarOrders,
      orderStart,
      orderEnd
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[moveCar] Conflict check:", { conflictStatus, conflictData });
    }

    if (conflictStatus === 409) {
      // Blocking conflict with confirmed orders
      return new Response(
        JSON.stringify({
          message: conflictData?.conflictMessage || "Time conflict with confirmed bookings",
          conflictDates: conflictData?.conflictDates,
          conflicts: conflictData?.conflictingOrders,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update order: only car and carNumber (no dates/prices/etc)
    order.car = newCarId;
    order.carNumber = newCarNumber;
    order.updatedAt = new Date();

    const updatedOrder = await order.save();

    if (process.env.NODE_ENV === "development") {
      console.log("[moveCar] Order moved successfully:", {
        orderId,
        oldCar: order.car,
        newCar: newCarId,
      });
    }

    // Return success (201 for created/updated, 200 for no-op)
    return new Response(
      JSON.stringify({
        message: "Order moved successfully",
        updatedOrder: updatedOrder,
        status: conflictStatus === 202 ? 202 : 201, // 202 if pending conflicts, 201 if no conflicts
        conflicts: conflictStatus === 202 ? conflictData?.conflictingOrders : [],
      }),
      {
        status: conflictStatus === 202 ? 202 : 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[moveCar] Error:", error);
    return new Response(
      JSON.stringify({ message: "Internal server error", error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

