import { Order } from "@models/order";
import { Car } from "@models/car";
import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { requireAdmin } from "@/lib/adminAuth";
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket, athensNow } from "@/domain/time/athensTime";
import { checkFieldAccess } from "@/middleware/withOrderAccess";
import { ROLE } from "@/domain/orders/admin-rbac";
import { getActionFromChangedFields } from "@/domain/orders/orderNotificationPolicy";
import { notifyOrderAction } from "@/domain/orders/orderNotificationDispatcher";
import { getBusinessRentalDaysByMinutes } from "@/domain/orders/numberOfDays";
import { analyzeConfirmationConflicts } from "@/domain/booking/analyzeConfirmationConflicts";
import { COMPANY_ID } from "@config/company";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import { PriceBreakdown } from "@models/PriceBreakdown";
import { detectPricingDrift } from "@/domain/orders/pricingDrift";
import { toBooleanField, setSecondDriverField } from "@/domain/orders/fieldUtils";
import { normalizeDrivingLicenceUrls } from "@/domain/orders/normalizeDrivingLicenceUrls";
import { buildDeliveryBreakdownSlice } from "@/domain/delivery/buildDeliveryBreakdownSlice";
import { toBusinessStartOfDay, toStoredBusinessDate } from "@/domain/time/businessDate";
import { ORDER_STATUS, isOrderPaidAndClosed } from "@/domain/orders/orderStatus";
import DiscountSetting from "@models/DiscountSetting";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function getBusinessDaySpan(start, end) {
  return getBusinessRentalDaysByMinutes(start, end);
}

function applyDeliveryOverrideFromPayload(order, payload) {
  if (payload.deliveryInOverride !== undefined) {
    order.deliveryInOverride =
      payload.deliveryInOverride === null || payload.deliveryInOverride === ""
        ? null
        : Number(payload.deliveryInOverride);
  }
  if (payload.deliveryOutOverride !== undefined) {
    order.deliveryOutOverride =
      payload.deliveryOutOverride === null || payload.deliveryOutOverride === ""
        ? null
        : Number(payload.deliveryOutOverride);
  }
}

// Restored from pre-refactor conflict logic: ИСПРАВЛЕННАЯ функция проверки конфликтов
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

// Restored from pre-refactor conflict logic: Function to check if existing conflicts are resolved after changing dates
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

// Restored from pre-refactor conflict logic: timeAndDate function
// Важно: используем точные моменты startTime/endTime (из клиента/базы),
// чтобы избежать ошибок из-за локали сервера и DST при пересборке часов.
async function timeAndDate(startDate, endDate, startTime, endTime) {
  return {
    start: dayjs(startTime),
    end: dayjs(endTime),
  };
}

function normalizeBreakdownForSnapshot(rawBreakdown) {
  if (!rawBreakdown) return null;
  return {
    baseRentalTotal: Number(rawBreakdown.baseRentalTotal) || 0,
    kaskoTotal: Number(rawBreakdown.kaskoTotal) || 0,
    childSeatsTotal: Number(rawBreakdown.childSeatsTotal) || 0,
    secondDriverTotal: Number(rawBreakdown.secondDriverTotal) || 0,
    deliveryIn: Number(rawBreakdown.deliveryIn) || 0,
    deliveryOut: Number(rawBreakdown.deliveryOut) || 0,
    deliveryTotal: Number(rawBreakdown.deliveryTotal) || 0,
    dailyRates: Array.isArray(rawBreakdown.dailyRates) ? rawBreakdown.dailyRates : [],
  };
}

async function resolveFullBreakdownForSnapshot(orderDoc) {
  const existing = await PriceBreakdown.findOne({ order: orderDoc._id }).lean();
  const normalizedExisting = normalizeBreakdownForSnapshot(existing);
  if (normalizedExisting && normalizedExisting.dailyRates.length > 0) {
    return normalizedExisting;
  }

  const carId = orderDoc.car?._id ?? orderDoc.car;
  const car = await Car.findById(carId);
  if (!car) return normalizedExisting;

  const { breakdown } = await car.calculateTotalRentalPricePerDay(
    orderDoc.timeIn ?? orderDoc.rentalStartDate,
    orderDoc.timeOut ?? orderDoc.rentalEndDate,
    orderDoc.insurance,
    Number(orderDoc.ChildSeats ?? 0),
    Boolean(orderDoc.secondDriver)
  );

  const deliverySlice = await buildDeliveryBreakdownSlice(orderDoc);
  return normalizeBreakdownForSnapshot({
    ...breakdown,
    ...deliverySlice,
  });
}

async function appendPriceSnapshot({ orderDoc, payload }) {
  const snapshotTotalPrice = Number(
    payload?.totalPrice ?? orderDoc?.totalPrice ?? 0
  );
  if (!Number.isFinite(snapshotTotalPrice) || snapshotTotalPrice <= 0) {
    throw new Error("Invalid price snapshot");
  }

  const fullBreakdown = await resolveFullBreakdownForSnapshot(orderDoc);
  if (
    !fullBreakdown ||
    !Array.isArray(fullBreakdown.dailyRates) ||
    fullBreakdown.dailyRates.length === 0
  ) {
    throw new Error("Invalid price snapshot breakdown");
  }

  const hasExplicitPriceUpdate =
    typeof payload?.totalPrice === "number" ||
    payload?.isOverridePrice === true ||
    payload?.isOverridePrice === false;

  let snapshotSource = "auto";
  if (payload?.confirmed === true) {
    snapshotSource = "confirmation";
  } else if (payload?.confirmed === false) {
    snapshotSource = "unconfirm";
  } else if (orderDoc?.confirmed === true && hasExplicitPriceUpdate) {
    // For confirmed bookings, explicit recalculation/manual override must be
    // shown as "Изм. подтверждённого" in price history UI.
    snapshotSource = "admin_edit_confirmed";
  } else if (payload?.isOverridePrice === true) {
    snapshotSource = "manual";
  } else if (hasExplicitPriceUpdate) {
    snapshotSource = "admin_edit";
  }

  const snapshot = {
    totalPrice: snapshotTotalPrice,
    breakdown: fullBreakdown,
    source: snapshotSource,
    createdAt: new Date(),
    savedAt: new Date(),
  };

  await PriceBreakdown.updateOne(
    { order: orderDoc._id },
    {
      $push: {
        history: snapshot,
      },
    },
    { upsert: false }
  );
}

async function attachOrderToActiveDiscount(orderDoc) {
  if (!orderDoc?._id) return;

  const activeDiscount = await DiscountSetting.findOne({ active: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!activeDiscount?.startDate || !activeDiscount?.endDate) return;

  const orderStart = toBusinessStartOfDay(orderDoc.rentalStartDate ?? orderDoc.timeIn);
  const orderEnd = toBusinessStartOfDay(orderDoc.rentalEndDate ?? orderDoc.timeOut);
  const discountStart = toBusinessStartOfDay(activeDiscount.startDate);
  const discountEnd = toBusinessStartOfDay(activeDiscount.endDate);
  if (!orderStart || !orderEnd || !discountStart || !discountEnd) return;

  const intersects =
    !orderEnd.isBefore(discountStart, "day") &&
    !orderStart.isAfter(discountEnd, "day");
  if (!intersects) return;

  await DiscountSetting.updateOne(
    { _id: activeDiscount._id },
    { $addToSet: { appliedOrderIds: orderDoc._id } }
  );
}

export const PATCH = async (request, { params }) => {
  try {
    await connectToDB();

      console.log("HEADERS", Object.fromEntries(request.headers.entries()));

  console.log("COOKIES", request.headers.get("cookie"));

    // Check admin authentication
    const { session, errorResponse } = await requireAdmin(request);
    if (errorResponse) return errorResponse;

    

    const { orderId } = params;
    const payload = await request.json();

    // Find the order
    const order = await Order.findById(orderId).populate("car");

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const previousOrderSnapshot = order.toObject
      ? order.toObject()
      : { ...order };

    // Determine which fields are being updated
    const hasDateTimeChanges =
      payload.rentalStartDate !== undefined ||
      payload.rentalEndDate !== undefined ||
      payload.timeIn !== undefined ||
      payload.timeOut !== undefined ||
      payload.car !== undefined ||
      payload.placeIn !== undefined ||
      payload.placeOut !== undefined ||
      payload.placeInDetail !== undefined ||
      payload.placeOutDetail !== undefined ||
      payload.insurance !== undefined ||
      payload.ChildSeats !== undefined ||
      payload.franchiseOrder !== undefined ||
      payload.totalPrice !== undefined ||
      payload.numberOfDays !== undefined ||
      payload.deliveryInOverride !== undefined ||
      payload.deliveryOutOverride !== undefined;

    const hasCustomerChanges =
      payload.customerName !== undefined ||
      payload.phone !== undefined ||
      payload.email !== undefined ||
      payload.secondDriver !== undefined ||
      payload.Viber !== undefined ||
      payload.Whatsapp !== undefined ||
      payload.Telegram !== undefined ||
      payload.flightNumber !== undefined ||
      payload.drivingLicenceUrls !== undefined;

    const hasConfirmationChange = payload.confirmed !== undefined;
    const hasStatusChange = payload.status !== undefined;

    // ════════════════════════════════════════════════════════════════
    // ЕДИНАЯ ЛОГИКА ПРАВ: используем orderAccessPolicy напрямую
    // ════════════════════════════════════════════════════════════════
    const isSuperAdmin = session.user.role === ROLE.SUPERADMIN;
    const isPast = order.rentalEndDate
      ? dayjs(order.rentalEndDate).tz("Europe/Athens").isBefore(dayjs().tz("Europe/Athens"), "day")
      : false;
    const timeBucket = getTimeBucket(order);

    const access = getOrderAccess({
      role: isSuperAdmin ? "SUPERADMIN" : "ADMIN",
      isClientOrder: order.my_order === true,
      confirmed: order.confirmed === true,
      isPast,
      isClosed: isOrderPaidAndClosed(order.status),
      timeBucket,
    });

    // Проверяем все поля из payload через единую логику
    const fieldsToUpdate = Object.keys(payload).filter(key => payload[key] !== undefined);
    const fieldCheck = checkFieldAccess(access, fieldsToUpdate);
    
    if (!fieldCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Cannot edit fields: ${fieldCheck.deniedFields.join(", ")}`,
          code: "PERMISSION_DENIED",
          deniedFields: fieldCheck.deniedFields,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (payload.phone !== undefined) {
      const phoneTrim =
        typeof payload.phone === "string"
          ? payload.phone.trim()
          : String(payload.phone ?? "").trim();
      if (phoneTrim && !isValidInternationalPhone(phoneTrim)) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Invalid phone number",
            code: "INVALID_PHONE",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      payload.phone = phoneTrim;
    }

    // Handle terminal close status transition (PAID_AND_CLOSED)
    if (hasStatusChange) {
      if (payload.status !== ORDER_STATUS.PAID_AND_CLOSED) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unsupported order status transition",
            code: "INVALID_STATUS_TRANSITION",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (order.status === ORDER_STATUS.PAID_AND_CLOSED) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Order is already closed",
            updatedOrder: order,
            data: order,
            status: 200,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const nowAthens = athensNow();
      const rentalStartAthens = dayjs(order.rentalStartDate).tz("Europe/Athens");
      const canClose =
        rentalStartAthens.isBefore(nowAthens, "day") ||
        rentalStartAthens.isSame(nowAthens, "day");

      if (!canClose) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Нельзя закрыть заказ до начала аренды",
            code: "CLOSE_ORDER_TOO_EARLY",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      order.status = ORDER_STATUS.PAID_AND_CLOSED;
      const closedOrder = await order.save();
      await appendPriceSnapshot({ orderDoc: closedOrder, payload });
      await attachOrderToActiveDiscount(closedOrder);

      try {
        const action = getActionFromChangedFields(fieldsToUpdate, payload);
        const orderPlain = closedOrder.toObject
          ? closedOrder.toObject()
          : { ...closedOrder };
        await notifyOrderAction({
          order: orderPlain,
          previousOrder: previousOrderSnapshot,
          user: session.user,
          action,
          actorName: session.user?.name || session.user?.email,
          source: "BACKEND",
        });
      } catch (notifyErr) {
        console.error("[update order] notifyOrderAction failed:", notifyErr?.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Заказ успешно закрыт",
          updatedOrder: closedOrder,
          data: closedOrder,
          status: 200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Дополнительная проверка для подтверждения (требует конфликт-анализа)
    if (hasConfirmationChange) {
      if (!access.canConfirm) {
        const company = await Company.findById(COMPANY_ID);
        const bufferHours = company?.bufferTime != null ? Number(company.bufferTime) : undefined;

        return new Response(
          JSON.stringify({
            success: false,
            data: null,
            message: "Only superadmin can confirm or unconfirm orders",
            level: "block",
            conflicts: [],
            affectedOrders: [],
            bufferHours: bufferHours,
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Handle confirmation toggle
    if (hasConfirmationChange) {
      const isConfirming = payload.confirmed === true && !order.confirmed;

      if (isConfirming) {
        // Get all orders for this car
        const allOrdersForCar = await Order.find({
          car: order.car,
        });

        const company = await Company.findById(COMPANY_ID);
        const bufferHours = company?.bufferTime != null ? Number(company.bufferTime) : undefined;

        // Analyze conflicts
        const conflictAnalysis = analyzeConfirmationConflicts({
          orderToConfirm: order,
          allOrders: allOrdersForCar,
          bufferHours: bufferHours,
        });

        if (!conflictAnalysis.canConfirm) {
          const normalized = {
            success: false,
            data: null,
            message: conflictAnalysis.message,
            level: "block",
            conflicts: conflictAnalysis.blockedByConfirmed ?? [],
            affectedOrders: conflictAnalysis.affectedPendingOrders ?? [],
            bufferHours: conflictAnalysis.bufferHours ?? bufferHours,
          };

          return new Response(JSON.stringify(normalized), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Can confirm (possibly with warning)
        order.confirmed = true;
        const updatedOrder = await order.save();
        await appendPriceSnapshot({ orderDoc: updatedOrder, payload });
        await attachOrderToActiveDiscount(updatedOrder);

        try {
          const action = getActionFromChangedFields(fieldsToUpdate, payload);
          const orderPlain = updatedOrder.toObject ? updatedOrder.toObject() : { ...updatedOrder };
          await notifyOrderAction({
            order: orderPlain,
            previousOrder: previousOrderSnapshot,
            user: session.user,
            action,
            actorName: session.user?.name || session.user?.email,
            source: "BACKEND",
            companyEmail: company?.email,
          });
        } catch (notifyErr) {
          console.error("[update order] notifyOrderAction failed:", notifyErr?.message);
        }

        const responseStatus = conflictAnalysis.level === "warning" ? 202 : 200;
        const responseMessage =
          conflictAnalysis.message || "Заказ успешно подтверждён";

        return new Response(
          JSON.stringify({
            success: true,
            data: updatedOrder,
            message: responseMessage,
            level: conflictAnalysis.level ?? null,
            conflicts: [],
            affectedOrders: conflictAnalysis.affectedPendingOrders ?? [],
            bufferHours: conflictAnalysis.bufferHours ?? bufferHours,
            updatedOrder: updatedOrder,
          }),
          {
            status: responseStatus,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        order.confirmed = false;
        const updatedOrder = await order.save();
        await appendPriceSnapshot({ orderDoc: updatedOrder, payload });
        await attachOrderToActiveDiscount(updatedOrder);

        const company = await Company.findById(COMPANY_ID);
        const bufferHours = company?.bufferTime != null ? Number(company.bufferTime) : undefined;

        return new Response(
          JSON.stringify({
            success: true,
            data: updatedOrder,
            message: "Подтверждение заказа снято",
            level: null,
            conflicts: [],
            affectedOrders: [],
            bufferHours: bufferHours,
            updatedOrder: updatedOrder,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle date/time/pricing/extras updates
    if (hasDateTimeChanges) {
      // Handle car change
      if (payload.car && (!order.car || String(order.car._id || order.car) !== String(payload.car))) {
        const newCar = await Car.findById(payload.car);
        if (!newCar) {
          return new Response(
            JSON.stringify({ message: "Car not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        order.car = newCar._id;
      }

      // Get car document for calculations
      let carDoc;
      if (order.car && typeof order.car === "object" && order.car._id) {
        carDoc = order.car;
      } else {
        carDoc = await Car.findById(order.car);
      }

      // Convert dates and times
      const newStartDate = payload.rentalStartDate
        ? toBusinessStartOfDay(payload.rentalStartDate)
        : toBusinessStartOfDay(order.rentalStartDate);
      const newEndDate = payload.rentalEndDate
        ? toBusinessStartOfDay(payload.rentalEndDate)
        : toBusinessStartOfDay(order.rentalEndDate);
      const newTimeIn = payload.timeIn
        ? dayjs(payload.timeIn)
        : dayjs(order.timeIn);
      const newTimeOut = payload.timeOut
        ? dayjs(payload.timeOut)
        : dayjs(order.timeOut);

      const { start, end } = await timeAndDate(
        newStartDate,
        newEndDate,
        newTimeIn,
        newTimeOut
      );

      // Restored from pre-refactor conflict logic: Debug logging for time period
      if (process.env.NODE_ENV !== "production") {
        console.log("=== DEBUGGING ORDER UPDATE ===");
        console.log("Order ID:", orderId);
        console.log("New time period:", {
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }

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
        _id: { $ne: orderId },
      });

      // Restored from pre-refactor conflict logic: Debug logging for conflict checks
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Existing orders for car:",
          allOrders.map((o) => ({
            id: o._id.toString(),
            timeIn: dayjs(o.timeIn).toISOString(),
            timeOut: dayjs(o.timeOut).toISOString(),
            confirmed: o.confirmed,
          }))
        );
      }

      // Restored from pre-refactor conflict logic: Check for conflicts
      const { status: conflictStatus, data: conflictData } =
        checkConflictsFixed(allOrders, start, end);

      // Restored from pre-refactor conflict logic: Debug logging
      if (process.env.NODE_ENV !== "production") {
        console.log("Conflict check result:", { status: conflictStatus, data: conflictData });
      }

      if (conflictStatus) {
        switch (conflictStatus) {
          case 409:
            // Restored from pre-refactor conflict logic: Confirmed conflicts (blocking)
            return new Response(
              JSON.stringify({
                message: conflictData?.conflictMessage,
                conflictDates: conflictData?.conflictDates,
              }),
              {
                status: 409,
                headers: { "Content-Type": "application/json" },
              }
            );
          case 408:
            // Restored from pre-refactor conflict logic: Blocking time conflicts
            return new Response(
              JSON.stringify({
                message: conflictData.conflictMessage,
                conflictDates: conflictData.conflictDates,
              }),
              {
                status: 408,
                headers: { "Content-Type": "application/json" },
              }
            );
          case 202:
            // Restored from pre-refactor conflict logic: Update with pending conflicts (warning, but proceed)
            let totalPrice202 = order.totalPrice; // 🔧 FIX: Preserve existing price by default
            let days202 = getBusinessDaySpan(start, end);
            
            // ============================================
            // PRICE ARCHITECTURE LOGIC (202 status with conflicts)
            // ============================================
            const isConfirmedOrder202 = order.confirmed === true;

            if (payload.isOverridePrice === true && typeof payload.totalPrice === "number") {
              order.OverridePrice = payload.totalPrice;
            } else if (payload.isOverridePrice === false) {
              order.OverridePrice = null;
            }
            
            const datesChanged202 =
              payload.rentalStartDate !== undefined ||
              payload.rentalEndDate !== undefined;
            const timesChanged202 =
              payload.timeIn !== undefined || payload.timeOut !== undefined;
            const priceAffectingFieldsChanged202 =
              payload.insurance !== undefined ||
              payload.ChildSeats !== undefined ||
              payload.secondDriver !== undefined ||
              payload.car !== undefined;

            // Detect drift for confirmed orders
            if (isConfirmedOrder202 && (datesChanged202 || timesChanged202 || priceAffectingFieldsChanged202)) {
              const frozenBreakdown202 = await PriceBreakdown.findOne({ order: orderId }).lean();
              const drift202 = detectPricingDrift({
                order,
                payload,
                breakdown: frozenBreakdown202,
                existingDrift: order.pricingDrift,
              });
              order.pricingDrift = drift202;
            }

            // NEVER auto-recalculate. Only accept explicit totalPrice from frontend.
            if (
              typeof payload.totalPrice === "number" &&
              !isNaN(payload.totalPrice) &&
              payload.isOverridePrice !== true
            ) {
              totalPrice202 = payload.totalPrice;
            }
            order.totalPrice = totalPrice202;

            order.rentalStartDate = toStoredBusinessDate(start);
            order.rentalEndDate = toStoredBusinessDate(end);
            order.numberOfDays = days202;
            
            order.timeIn = start.toDate();
            order.timeOut = end.toDate();
            // Restored from pre-refactor conflict logic: Use || operator for placeIn/placeOut to preserve existing values
            order.placeIn = payload.placeIn !== undefined ? payload.placeIn : order.placeIn;
            order.placeOut = payload.placeOut !== undefined ? payload.placeOut : order.placeOut;
            order.placeInDetail =
              payload.placeInDetail !== undefined
                ? String(payload.placeInDetail ?? "").trim()
                : order.placeInDetail;
            order.placeOutDetail =
              payload.placeOutDetail !== undefined
                ? String(payload.placeOutDetail ?? "").trim()
                : order.placeOutDetail;

            applyDeliveryOverrideFromPayload(order, payload);

            // Restored from pre-refactor conflict logic: Update hasConflictDates with new conflicts and still-conflicting orders
            order.hasConflictDates = [
              ...new Set([
                ...order.hasConflictDates,
                ...conflictData.conflictOrdersIds,
                ...stillConflictingOrders,
              ]),
            ];

            // Restored from pre-refactor conflict logic: Update extras fields
            order.ChildSeats =
              payload.ChildSeats !== undefined ? payload.ChildSeats : order.ChildSeats;
            order.insurance =
              payload.insurance !== undefined ? payload.insurance : order.insurance;

            // 🔧 FIX: Also update customer fields if they are in payload (even in conflict case 202)
            if (hasCustomerChanges) {
              if (payload.customerName !== undefined)
                order.customerName = payload.customerName;
              if (payload.phone !== undefined) order.phone = payload.phone;
              if (payload.email !== undefined) order.email = payload.email;
              if (payload.secondDriver !== undefined)
                setSecondDriverField(order, payload.secondDriver);
              if (payload.Viber !== undefined) order.Viber = payload.Viber;
              if (payload.Whatsapp !== undefined) order.Whatsapp = payload.Whatsapp;
              if (payload.Telegram !== undefined) order.Telegram = payload.Telegram;
              if (payload.offline !== undefined) {
                order.offline = Boolean(payload.offline);
                if (order.offline) {
                  order.confirmed = true;
                  order.my_order = false;
                }
              }
              if (payload.flightNumber !== undefined)
                order.flightNumber = payload.flightNumber;
              if (payload.drivingLicenceUrls !== undefined) {
                order.drivingLicenceUrls = normalizeDrivingLicenceUrls(
                  payload.drivingLicenceUrls
                );
              }
            }

            const updatedOrder = await order.save();
            await appendPriceSnapshot({ orderDoc: updatedOrder, payload });
            await attachOrderToActiveDiscount(updatedOrder);

            try {
              const company = await Company.findById(COMPANY_ID);
              const action = getActionFromChangedFields(fieldsToUpdate, payload);
              const orderPlain = updatedOrder.toObject ? updatedOrder.toObject() : { ...updatedOrder };
              await notifyOrderAction({
                order: orderPlain,
                previousOrder: previousOrderSnapshot,
                user: session.user,
                action,
                actorName: session.user?.name || session.user?.email,
                source: "BACKEND",
                companyEmail: company?.email,
              });
            } catch (notifyErr) {
              console.error("[update order] notifyOrderAction failed:", notifyErr?.message);
            }

            // Restored from pre-refactor conflict logic: Return response with conflict info (exact format match)
            return new Response(
              JSON.stringify({
                message: conflictData.conflictMessage,
                conflicts: conflictData.conflictDates,
                updatedOrder: updatedOrder,
                data: updatedOrder, // Added for unified API compatibility
              }),
              {
                status: 202,
                headers: { "Content-Type": "application/json" },
              }
            );
        }
      }

      // Restored from pre-refactor conflict logic: No conflicts - proceed with update
      let totalPrice = order.totalPrice;
      let days = getBusinessDaySpan(start, end);

      const datesChanged =
        payload.rentalStartDate !== undefined ||
        payload.rentalEndDate !== undefined;
      const timesChanged =
        payload.timeIn !== undefined || payload.timeOut !== undefined;
      const priceAffectingFieldsChanged =
        payload.insurance !== undefined ||
        payload.ChildSeats !== undefined ||
        payload.secondDriver !== undefined ||
        payload.car !== undefined;

      // Handle manual price override (isOverridePrice flag)
      if (payload.isOverridePrice === true && typeof payload.totalPrice === "number") {
        order.OverridePrice = payload.totalPrice;
      } else if (payload.isOverridePrice === false) {
        order.OverridePrice = null;
      }

      // Detect drift for confirmed orders
      if (order.confirmed === true && (datesChanged || timesChanged || priceAffectingFieldsChanged)) {
        const frozenBreakdown = await PriceBreakdown.findOne({ order: orderId }).lean();
        const drift = detectPricingDrift({
          order,
          payload,
          breakdown: frozenBreakdown,
          existingDrift: order.pricingDrift,
        });
        order.pricingDrift = drift;
      }

      // NEVER auto-recalculate. Only accept explicit totalPrice from frontend
      // (admin clicked "Recalculate" or manually entered a price).
      if (
        typeof payload.totalPrice === "number" &&
        !isNaN(payload.totalPrice) &&
        payload.isOverridePrice !== true
      ) {
        totalPrice = payload.totalPrice;
      }
      order.totalPrice = totalPrice;

      order.rentalStartDate = toStoredBusinessDate(start);
      order.rentalEndDate = toStoredBusinessDate(end);
      order.numberOfDays = days;
      order.timeIn = start.toDate();
      order.timeOut = end.toDate();
      // Restored from pre-refactor conflict logic: Use || operator to preserve existing values
      order.placeIn = payload.placeIn !== undefined ? payload.placeIn : order.placeIn;
      order.placeOut = payload.placeOut !== undefined ? payload.placeOut : order.placeOut;
      order.placeInDetail =
        payload.placeInDetail !== undefined
          ? String(payload.placeInDetail ?? "").trim()
          : order.placeInDetail;
      order.placeOutDetail =
        payload.placeOutDetail !== undefined
          ? String(payload.placeOutDetail ?? "").trim()
          : order.placeOutDetail;

      applyDeliveryOverrideFromPayload(order, payload);

      // Restored from pre-refactor conflict logic: Update extras fields
      order.ChildSeats =
        payload.ChildSeats !== undefined ? payload.ChildSeats : order.ChildSeats;
      order.insurance =
        payload.insurance !== undefined ? payload.insurance : order.insurance;
      order.franchiseOrder =
        payload.franchiseOrder !== undefined
          ? payload.franchiseOrder
          : order.franchiseOrder;

      // 🔧 FIX: Also update customer fields if they are in payload (even if hasDateTimeChanges is true)
      if (hasCustomerChanges) {
        if (payload.customerName !== undefined)
          order.customerName = payload.customerName;
        if (payload.phone !== undefined) order.phone = payload.phone;
        if (payload.email !== undefined) order.email = payload.email;
        if (payload.secondDriver !== undefined)
          setSecondDriverField(order, payload.secondDriver);
        if (payload.Viber !== undefined) order.Viber = payload.Viber;
        if (payload.Whatsapp !== undefined) order.Whatsapp = payload.Whatsapp;
        if (payload.Telegram !== undefined) order.Telegram = payload.Telegram;
        if (payload.offline !== undefined) {
          order.offline = Boolean(payload.offline);
          if (order.offline) {
            order.confirmed = true;
            order.my_order = false;
          }
        }
        if (payload.flightNumber !== undefined)
          order.flightNumber = payload.flightNumber;
        if (payload.drivingLicenceUrls !== undefined) {
          order.drivingLicenceUrls = normalizeDrivingLicenceUrls(
            payload.drivingLicenceUrls
          );
        }
      }

      // Restored from pre-refactor conflict logic: Debug logging before save
      if (process.env.NODE_ENV !== "production") {
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
          secondDriver: order.secondDriver,
          car: order.car,
          carModel: order.carModel,
          carNumber: order.carNumber,
          confirmed: order.confirmed,
          hasConflictDates: order.hasConflictDates,
          numberOfDays: order.numberOfDays,
          totalPrice: order.totalPrice,
          OverridePrice: order.OverridePrice,
          my_order: order.my_order,
          isOverridePrice: payload.isOverridePrice,
        });
      }

      const savedOrder = await order.save();
      await appendPriceSnapshot({ orderDoc: savedOrder, payload });
      await attachOrderToActiveDiscount(savedOrder);

      try {
        const action = getActionFromChangedFields(fieldsToUpdate, payload);
        const orderPlain = savedOrder.toObject ? savedOrder.toObject() : { ...savedOrder };
        await notifyOrderAction({
          order: orderPlain,
          previousOrder: previousOrderSnapshot,
          user: session.user,
          action,
          actorName: session.user?.name || session.user?.email,
          source: "BACKEND",
        });
      } catch (notifyErr) {
        console.error("[update order] notifyOrderAction failed:", notifyErr?.message);
      }

      // Restored from pre-refactor conflict logic: Success logging
      if (process.env.NODE_ENV !== "production") {
        console.log("Order updated successfully");
      }

      return new Response(
        JSON.stringify({
          message: `ВСЕ ОТЛИЧНО! Даты изменены.`,
          data: savedOrder,
          updatedOrder: savedOrder,
          status: 201,
          success: true,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle customer info updates
    if (hasCustomerChanges) {
      if (payload.customerName !== undefined)
        order.customerName = payload.customerName;
      if (payload.phone !== undefined) order.phone = payload.phone;
      if (payload.email !== undefined) order.email = payload.email;
      let secondDriverChanged = false;
      if (payload.secondDriver !== undefined) {
        setSecondDriverField(order, payload.secondDriver);
        secondDriverChanged = true;
      }
      if (payload.Viber !== undefined) order.Viber = payload.Viber;
      if (payload.Whatsapp !== undefined) order.Whatsapp = payload.Whatsapp;
      if (payload.Telegram !== undefined) order.Telegram = payload.Telegram;
      if (payload.offline !== undefined) {
        order.offline = Boolean(payload.offline);
        if (order.offline) {
          order.confirmed = true;
          order.my_order = false;
        }
      }
      if (payload.flightNumber !== undefined)
        order.flightNumber = payload.flightNumber;
      if (payload.drivingLicenceUrls !== undefined) {
        order.drivingLicenceUrls = normalizeDrivingLicenceUrls(
          payload.drivingLicenceUrls
        );
      }

      if (secondDriverChanged) {
        // Detect drift for confirmed orders
        if (order.confirmed === true) {
          const frozenBreakdownSD = await PriceBreakdown.findOne({ order: orderId }).lean();
          const driftSD = detectPricingDrift({
            order,
            payload,
            breakdown: frozenBreakdownSD,
            existingDrift: order.pricingDrift,
          });
          order.pricingDrift = driftSD;
        }
        // NEVER auto-recalculate price on secondDriver change.
        // Price only changes when admin explicitly clicks "Recalculate".
      }

      const updatedOrder = await order.save();
      await appendPriceSnapshot({ orderDoc: updatedOrder, payload });
      await attachOrderToActiveDiscount(updatedOrder);

      try {
        const company = await Company.findById(COMPANY_ID);
        const action = getActionFromChangedFields(fieldsToUpdate, payload);
        const orderPlain = updatedOrder.toObject ? updatedOrder.toObject() : { ...updatedOrder };
        await notifyOrderAction({
          order: orderPlain,
          previousOrder: previousOrderSnapshot,
          user: session.user,
          action,
          actorName: session.user?.name || session.user?.email,
          source: "BACKEND",
          companyEmail: company?.email,
        });
      } catch (notifyErr) {
        console.error("[update order] notifyOrderAction failed:", notifyErr?.message);
      }

      return new Response(
        JSON.stringify({
          updatedOrder: updatedOrder,
          data: updatedOrder,
          message: "Данные клиента обновлены успешно",
          status: 200,
          success: true,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // No changes detected
    return new Response(
      JSON.stringify({
        message: "No changes detected",
        updatedOrder: order,
        status: 200,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating order:", error);
    return new Response(
      JSON.stringify({
        message: `Failed to update order: ${error.message}`,
        status: 500,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
