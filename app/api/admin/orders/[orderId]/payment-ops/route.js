import { NextResponse } from "next/server";

import { requireAdmin, requireSuperAdmin } from "@lib/adminAuth";
import { ROLE } from "@models/user";
import { connectToDB } from "@lib/database";
import { Order } from "@models/order";
import MailLog from "@models/MailLog";
import { MAIL_STATUS, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { resendMailLog } from "@/domain/mail/resendOutboundMail";
import { extractAuditContext, recordAuditEvent } from "@/domain/legal/auditTrail";
import { buildMarketplacePaymentOpsView } from "@/domain/orders/marketplacePaymentVisibility";
import {
  evaluatePaymentLinkReissue,
  reissueMarketplacePaymentLink,
} from "@/domain/orders/reissueMarketplacePaymentLink";
import { sendCustomerPaymentRequestEmail } from "@/domain/orders/marketplaceBookingEmails";
import {
  assertPartnerCanOperate,
  auditPartnerComplianceBlock,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import {
  invalidateMarketplaceCheckoutsForOrderRecord,
  retryCheckoutInvalidationForOrder,
} from "@/domain/orders/invalidateMarketplaceCheckout";
import { issueMarketplaceBookingFeeRefund } from "@/domain/orders/marketplaceBookingFeeRefund";
import { applyMarketplacePriceCorrection } from "@/domain/orders/applyMarketplacePriceCorrection";
import { toMinorUnits } from "@/domain/money/minorUnits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function loadOrder(orderId) {
  await connectToDB();
  return Order.findById(orderId);
}

/** Superadmin visibility snapshot. ADMIN may not issue links. */
export async function GET(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  const order = await loadOrder(orderId);
  if (!order) return json({ success: false, message: "Order not found" }, 404);

  const view = await buildMarketplacePaymentOpsView(order);
  const isSuper = Number(session.user?.role) === ROLE.SUPERADMIN;
  return json({
    success: true,
    superadmin: isSuper,
    canIssueNewLink: isSuper && view.canIssueNewLink,
    canResendExisting: isSuper && view.canResendExisting,
    view,
  });
}

export async function POST(request, { params }) {
  const { session, errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  const { ipAddress, userAgent } = extractAuditContext(request);

  const order = await loadOrder(orderId);
  if (!order) return json({ success: false, message: "Order not found" }, 404);

  if (action === "resend") {
    if (isMarketplaceRequestMode(order.bookingMode)) {
      const resendGate = await assertPartnerCanOperate(order.ownerId, {
        purpose: PARTNER_OPERATION_PURPOSE.CHECKOUT,
        audit: { orderId: order._id, ipAddress, userAgent },
      });
      if (!resendGate.allowed) {
        await auditPartnerComplianceBlock({
          purpose: PARTNER_OPERATION_PURPOSE.CHECKOUT,
          result: resendGate,
          actorEmail: session.user?.email || "",
          actorRole: "superadmin",
          ipAddress,
          userAgent,
          orderId: order._id,
        });
        await invalidateMarketplaceCheckoutsForOrderRecord(order, {
          reason: resendGate.code || resendGate.error,
          actorEmail: session.user?.email || "",
          actorRole: "superadmin",
          ipAddress,
          userAgent,
        });
        return json(
          {
            success: false,
            code: resendGate.code,
            error: resendGate.error,
            message: resendGate.partnerMessage,
          },
          403
        );
      }
    }
    const guard = evaluatePaymentLinkReissue(order);
    if (!guard.canResend && !order.payment?.checkoutUrl) {
      return json(
        {
          success: false,
          code: "cannot_resend",
          message: "There is no active payment link to resend.",
        },
        409
      );
    }
    const sessionId = String(order.payment?.providerPaymentId || "");
    const existing = sessionId
      ? await MailLog.findOne({
          orderId: order._id,
          status: MAIL_STATUS.SENT,
          type: {
            $in: [MAIL_TYPE.ORDER_PAYMENT, MAIL_TYPE.ORDER_PAYMENT_REISSUED],
          },
          "payload.stripeSessionId": sessionId,
        })
          .sort({ sentAt: -1 })
          .lean()
      : null;
    let mailed;
    if (existing?._id) {
      mailed = await resendMailLog(existing._id);
    } else {
      mailed = await sendCustomerPaymentRequestEmail({
        order: order.toObject(),
        paymentUrl: order.payment.checkoutUrl,
        expiresAt: order.payment.expiresAt,
        stripeSessionId: sessionId,
      });
    }
    await recordAuditEvent({
      action: "RENTAL_PAYMENT_EMAIL_RESENT",
      userRole: "superadmin",
      userEmail: session.user?.email || "",
      ipAddress,
      userAgent,
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { sessionId, mailLogId: existing?._id || "" },
    });
    return json({ success: Boolean(mailed?.ok), mailed });
  }

  if (action === "reissue") {
    const result = await reissueMarketplacePaymentLink({
      orderId,
      reason: body?.reason,
      reasonNote: body?.reasonNote,
      actorEmail: session.user?.email || "",
      actorRole: "superadmin",
      ipAddress,
      userAgent,
      idempotencyKey: String(body?.idempotencyKey || ""),
      complianceOverride: body?.complianceOverride === true,
      complianceOverrideReason: String(body?.complianceOverrideReason || ""),
    });
    if (!result.ok) {
      return json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        result.status || 400
      );
    }
    const view = await buildMarketplacePaymentOpsView(
      result.order ? await loadOrder(orderId) : order
    );
    return json({
      success: true,
      url: result.url,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      idempotent: Boolean(result.idempotent),
      view,
    });
  }

  if (action === "retry_invalidation") {
    const summary = await retryCheckoutInvalidationForOrder(order, {
      reason: String(body?.reason || order.payment?.invalidatedReason || "PROFILE_NOT_VERIFIED"),
      actorEmail: session.user?.email || "",
      actorRole: "superadmin",
      ipAddress,
      userAgent,
    });
    await recordAuditEvent({
      action: "RENTAL_CHECKOUT_INVALIDATE_RETRY",
      userRole: "superadmin",
      userEmail: session.user?.email || "",
      ipAddress,
      userAgent,
      orderData: { orderId: order._id, orderNumber: order.orderNumber },
      metadata: { trigger: "superadmin_manual", ...summary },
    });
    const view = await buildMarketplacePaymentOpsView(await loadOrder(orderId));
    return json({
      success: true,
      ...summary,
      view,
    });
  }

  if (action === "correct_price") {
    const revisedGrossMinor =
      body?.revisedGrossMinor != null
        ? Math.round(Number(body.revisedGrossMinor))
        : toMinorUnits(
            body?.totalPrice,
            order.authoritativePrice?.currency || order.currency || "EUR"
          );
    const result = await applyMarketplacePriceCorrection({
      orderId,
      revisedGrossMinor,
      reason: body?.reason || body?.reasonNote,
      actorEmail: session.user?.email || "",
      actorRole: "SUPERADMIN",
      actorUserId: session.user?.id || session.user?._id || "",
      confirmZeroSupplierBalance: body?.confirmZeroSupplierBalance === true,
      ipAddress,
      userAgent,
    });
    if (!result.ok) {
      return json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        result.status || 400
      );
    }
    const view = await buildMarketplacePaymentOpsView(await loadOrder(orderId));
    return json({
      success: true,
      revision: result.revision,
      view,
    });
  }

  if (action === "refund") {
    const result = await issueMarketplaceBookingFeeRefund({
      orderId,
      reason: body?.reason || body?.reasonNote,
      actorEmail: session.user?.email || "",
      actorRole: "superadmin",
      ipAddress,
      userAgent,
      idempotencyKey: String(body?.idempotencyKey || ""),
    });
    if (!result.ok) {
      return json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        result.status || 400
      );
    }
    const view = await buildMarketplacePaymentOpsView(await loadOrder(orderId));
    return json({
      success: true,
      stripeRefundId: result.stripeRefundId,
      amountMinor: result.amountMinor,
      mailed: result.mailed,
      view,
    });
  }

  return json({ success: false, message: "Unknown action" }, 400);
}
