/**
 * confirmOrderFlow.js
 *
 * SAFE EXTRACTION: Order confirmation / unconfirmation logic.
 * Contract: confirmOrderFlow({ order, sessionUser, bufferHours }) → { status, body }
 *
 * Order of operations (DO NOT CHANGE):
 * 1. timeBucket via getTimeBucket(order)
 * 2. OrderContext built inline (no createOrderContext dependency)
 * 3. getOrderAccess(ctx)
 * 4. isConfirming = !order.confirmed
 * 5. If UNCONFIRMING internal → allow immediately
 * 6. If !access.canConfirm → return 403
 * 7. If CONFIRMING: fetch orders, analyzeConfirmationConflicts, 409 or save+notify+200/202
 * 8. If UNCONFIRMING: save+notify+200
 */

import { Order } from "@models/order";
import { ROLE } from "@models/user";
import { getOrderAccess } from "@/domain/orders/orderAccessPolicy";
import { getTimeBucket } from "@/domain/time/athensTime";
import { notifyOrderAction } from "@/domain/orders/orderNotificationDispatcher";
import { orderMessages } from "@/domain/messages";
import { analyzeConfirmationConflicts } from "@/domain/booking/analyzeConfirmationConflicts";

/**
 * @param {Object} params
 * @param {import("mongoose").Document} params.order - Order document (will be mutated and saved)
 * @param {Object} params.sessionUser - session.user
 * @param {number} params.bufferHours
 * @param {string} [params.companyEmail] - optional, for UNCONFIRM notification (preserves existing behavior)
 * @returns {{ status: number, body: { success: boolean, data: object|null, message: string, level: string|null, conflicts: Array, affectedOrders: Array, bufferHours: number } }}
 */
export async function confirmOrderFlow({ order, sessionUser, bufferHours, companyEmail }) {
  const orderId = order._id?.toString?.() ?? order.id;

  // 1. Compute timeBucket via getTimeBucket(order)
  const timeBucket = getTimeBucket(order);

  // 2. Build OrderContext inline (no createOrderContext signature dependency)
  const ctx = !order || !sessionUser
    ? { role: "ADMIN", isClientOrder: false, confirmed: false, isPast: false, timeBucket: "FUTURE" }
    : {
        role: sessionUser.role === ROLE.SUPERADMIN ? "SUPERADMIN" : "ADMIN",
        isClientOrder: order.my_order === true,
        confirmed: order.confirmed === true,
        timeBucket,
        isPast: timeBucket === "PAST",
      };

  // 3. Call getOrderAccess(ctx)
  const access = getOrderAccess(ctx);

  // 4. Determine isConfirming = !order.confirmed
  const isConfirming = !order.confirmed;
  // Internal = not client (matches policy: isClientOrder = order.my_order === true; undefined/false = internal)
  const isInternal = order.my_order !== true;

  // 5. If UNCONFIRMING internal order → allow immediately (exact same logic)
  if (!isConfirming && isInternal) {
    // allow: no check needed
  } else if (!access.canConfirm) {
    // 6. If access.canConfirm === false → return 403 response (exact payload)
    const normalized = {
      success: false,
      data: null,
      message: orderMessages.CONFIRM_PERMISSION_DENIED,
      level: "block",
      conflicts: [],
      affectedOrders: [],
      bufferHours: bufferHours,
    };
    console.log(`[switchConfirm] 403 PERMISSION_DENIED orderId=${orderId} canConfirm=false`);
    return { status: 403, body: normalized };
  }

  // Если пытаемся подтвердить (переключить с false на true)
  console.log("isConfirming:", isConfirming);

  if (isConfirming) {
    // 7. If CONFIRMING: Fetch all orders for the same car
    const allOrdersForCar = await Order.find({
      car: order.car,
    });

    // Call analyzeConfirmationConflicts(...)
    const conflictAnalysis = analyzeConfirmationConflicts({
      orderToConfirm: order,
      allOrders: allOrdersForCar,
      bufferHours: bufferHours,
    });

    console.log("[switchConfirm] Conflict analysis result:", {
      orderId: order._id,
      canConfirm: conflictAnalysis.canConfirm,
      level: conflictAnalysis.level,
      message: conflictAnalysis.message,
      blockedByConfirmed: conflictAnalysis.blockedByConfirmed?.length || 0,
      affectedPendingOrders: conflictAnalysis.affectedPendingOrders?.length || 0,
    });

    // If canConfirm === false → return 409 block response
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

      console.log(`[switchConfirm] 409 BLOCK orderId=${orderId} success=false level=block`);

      return { status: 409, body: normalized };
    }

    // Else: Set order.confirmed = true, save, notify, return 200 or 202
    order.confirmed = true;
    const updatedOrder = await order.save();

    try {
      const orderPlain = updatedOrder.toObject ? updatedOrder.toObject() : { ...updatedOrder };
      await notifyOrderAction({
        order: orderPlain,
        user: sessionUser,
        action: "CONFIRM",
        actorName: sessionUser?.name || sessionUser?.email,
        source: "BACKEND",
      });
    } catch (notifyErr) {
      console.error("[switchConfirm] notifyOrderAction failed:", notifyErr?.message);
    }

    const responseStatus = conflictAnalysis.level === "warning" ? 202 : 200;
    const responseMessage = conflictAnalysis.message || orderMessages.CONFIRM_SUCCESS;

    const normalized = {
      success: true,
      data: updatedOrder,
      message: responseMessage,
      level: conflictAnalysis.level ?? null,
      conflicts: [],
      affectedOrders: conflictAnalysis.affectedPendingOrders ?? [],
      bufferHours: conflictAnalysis.bufferHours ?? bufferHours,
    };

    console.log(`[switchConfirm] ${responseStatus} SUCCESS orderId=${orderId} success=true level=${normalized.level || "null"}`);

    return { status: responseStatus, body: normalized };
  } else {
    // 8. If UNCONFIRMING: Set order.confirmed = false, save, notify, return 200
    order.confirmed = false;
    const updatedOrder = await order.save();

    try {
      const orderPlain = updatedOrder.toObject ? updatedOrder.toObject() : { ...updatedOrder };
      await notifyOrderAction({
        order: orderPlain,
        user: sessionUser,
        action: "UNCONFIRM",
        actorName: sessionUser?.name || sessionUser?.email,
        source: "BACKEND",
        companyEmail: companyEmail,
      });
    } catch (notifyErr) {
      console.error("[switchConfirm] notifyOrderAction failed:", notifyErr?.message);
    }

    const normalized = {
      success: true,
      data: updatedOrder,
      message: orderMessages.UNCONFIRM_SUCCESS,
      level: null,
      conflicts: [],
      affectedOrders: [],
      bufferHours: bufferHours,
    };

    console.log(`[switchConfirm] 200 SUCCESS orderId=${orderId} success=true level=null (unconfirmed)`);

    return { status: 200, body: normalized };
  }
}
