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
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
} from "@/domain/booking/availabilityEngine";
import { isMarketplaceRequestMode, resolveBookingMode } from "@/domain/booking/bookingMode";
import { LEGACY_FALLBACK_TZ } from "@/domain/time/resolveBusinessTimezone";
import AuditLog from "@models/auditLog";
import Company from "@models/company";
import { isStripeConfigured } from "@config/stripe";
import {
  resolveCompanyRentalPaymentPolicy,
  isRentalConfirmBlockedByPayment,
  shouldChargeRentalOnConfirm,
} from "@/domain/orders/companyRentalPaymentPolicy";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  partnerComplianceJson,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

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
    // Reload so confirmation does not rely on a stale frontend check.
    // MongoDB transactions are not used in this deployment; this is
    // check-then-set, not atomic. See docs/RENTAL_FOUNDATION.md.
    const reloaded = await Order.findById(order._id);
    if (!reloaded) {
      return {
        status: 404,
        body: {
          success: false,
          data: null,
          message: orderMessages.CONFIRM_PERMISSION_DENIED,
          level: "block",
          conflicts: [],
          affectedOrders: [],
          bufferHours,
        },
      };
    }

    const allOrdersForCar = await Order.find({
      car: reloaded.car,
    });

    const timezone = reloaded.timezone || LEGACY_FALLBACK_TZ;
    const bookingMode = resolveBookingMode({ order: reloaded });
    if (isMarketplaceRequestMode(bookingMode)) {
      const confirmGate = await assertPartnerCanOperate(reloaded.ownerId, {
        purpose: PARTNER_OPERATION_PURPOSE.CONFIRM,
      });
      if (!confirmGate.allowed) {
        await auditPartnerComplianceBlock({
          purpose: PARTNER_OPERATION_PURPOSE.CONFIRM,
          result: confirmGate,
          actorEmail: sessionUser?.email || "",
          actorRole:
            sessionUser?.role === ROLE.SUPERADMIN ? "superadmin" : "admin",
          orderId: reloaded._id,
        });
        const denial = partnerComplianceJson(confirmGate);
        return {
          status: 403,
          body: {
            success: false,
            data: null,
            message: denial.message,
            error: denial.error,
            code: denial.code,
            level: "block",
            conflicts: [],
            affectedOrders: [],
            bufferHours,
          },
        };
      }
    }
    const pickupAtUtc = reloaded.pickupAtUtc || reloaded.timeIn;
    const returnAtUtc = reloaded.returnAtUtc || reloaded.timeOut;

    const availability = evaluateRentalAvailability({
      carId: reloaded.car,
      pickupAtUtc,
      returnAtUtc,
      timezone,
      excludeOrderId: String(reloaded._id),
      existingOrders: allOrdersForCar,
      bufferHours,
      purpose: AVAILABILITY_PURPOSE.CONFIRM,
      bookingMode,
    });

    const conflictAnalysis = analyzeConfirmationConflicts({
      orderToConfirm: reloaded,
      allOrders: allOrdersForCar,
      bufferHours: bufferHours,
    });

    console.log("[switchConfirm] Conflict analysis result:", {
      orderId: reloaded._id,
      engineAvailable: availability.available,
      engineHard: availability.hardConflict,
      canConfirm: conflictAnalysis.canConfirm,
      level: conflictAnalysis.level,
      message: conflictAnalysis.message,
      blockedByConfirmed: conflictAnalysis.blockedByConfirmed?.length || 0,
      affectedPendingOrders: conflictAnalysis.affectedPendingOrders?.length || 0,
    });

    if (availability.hardConflict || !conflictAnalysis.canConfirm) {
      const normalized = {
        success: false,
        data: null,
        message:
          conflictAnalysis.message ||
          availability.userSafeReason ||
          orderMessages.CONFIRM_PERMISSION_DENIED,
        level: "block",
        conflicts: conflictAnalysis.blockedByConfirmed ?? [],
        affectedOrders: conflictAnalysis.affectedPendingOrders ?? [],
        bufferHours: conflictAnalysis.bufferHours ?? bufferHours,
        conflictType: availability.conflictType,
      };

      try {
        await AuditLog.create({
          action: "OTHER",
          userRole: sessionUser?.role === ROLE.SUPERADMIN ? "superadmin" : "admin",
          userEmail:
            typeof sessionUser?.email === "string" ? sessionUser.email : undefined,
          orderData: {
            orderId: reloaded._id,
            orderNumber: reloaded.orderNumber
              ? String(reloaded.orderNumber)
              : undefined,
          },
          metadata: {
            kind: "CONFIRM_AVAILABILITY_REJECTED",
            conflictType: availability.conflictType,
            blockingCount: availability.blockingRecords.length,
          },
          severity: "medium",
          result: "failure",
        });
      } catch (auditErr) {
        console.error("[switchConfirm] audit failed:", auditErr?.message);
      }

      console.log(`[switchConfirm] 409 BLOCK orderId=${orderId} success=false level=block`);

      return { status: 409, body: normalized };
    }

    // Per-company: block confirm until Stripe prepayment is paid (before_confirm).
    try {
      const ownerCompany = reloaded.ownerId
        ? await Company.findById(reloaded.ownerId)
            .select("rentalPayments")
            .lean()
        : null;
      const payPolicy = resolveCompanyRentalPaymentPolicy(ownerCompany, {
        stripeConfigured: isStripeConfigured(),
        bookingMode: reloaded.bookingMode,
      });
      if (isRentalConfirmBlockedByPayment(reloaded, payPolicy)) {
        return {
          status: 402,
          body: {
            success: false,
            data: null,
            message:
              "Customer must complete online prepayment before this order can be confirmed.",
            level: "block",
            conflicts: [],
            affectedOrders: [],
            bufferHours,
            paymentRequired: true,
            paymentCheckoutUrl: reloaded.payment?.checkoutUrl || null,
          },
        };
      }
    } catch (payErr) {
      console.error("[switchConfirm] payment gate failed:", payErr?.message);
    }

    reloaded.confirmed = true;
    const updatedOrder = await reloaded.save();

    let paymentUrl = null;
    try {
      const ownerCompany = updatedOrder.ownerId
        ? await Company.findById(updatedOrder.ownerId)
            .select("name email rentalPayments prepaymentPercent")
            .lean()
        : null;
      const payPolicy = resolveCompanyRentalPaymentPolicy(ownerCompany, {
        stripeConfigured: isStripeConfigured(),
        bookingMode: updatedOrder.bookingMode,
      });
      if (
        shouldChargeRentalOnConfirm(payPolicy, {
          bookingMode: updatedOrder.bookingMode,
        })
      ) {
        const pay = await createRentalCheckoutSession(String(updatedOrder._id), {
          company: ownerCompany,
          emailCustomer: true,
        });
        if (pay.ok) paymentUrl = pay.url || null;
      }
    } catch (payErr) {
      console.error("[switchConfirm] rental checkout failed:", payErr?.message);
    }

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
      paymentUrl,
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
