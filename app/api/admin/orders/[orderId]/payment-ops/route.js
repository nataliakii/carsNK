import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
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
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
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

function isSuperadminSession(session) {
  return Number(session?.user?.role) === ROLE.SUPERADMIN;
}

function sessionOwnsOrder(session, order) {
  const actorOwner = String(
    session?.user?.viewAsCompanyId || session?.user?.ownerId || ""
  ).trim();
  const orderOwner = String(order?.ownerId || "").trim();
  return Boolean(actorOwner && orderOwner && actorOwner === orderOwner);
}

function redactCompanyAdminView(view) {
  if (!view) return view;
  return {
    ...view,
    payment: view.payment
      ? {
          ...view.payment,
          checkoutUrl: "",
          currentSessionId: "",
          paymentIntentId: "",
          chargeId: "",
          sessionHistory: [],
        }
      : view.payment,
    emails: (view.emails || []).map((row) => ({
      ...row,
      stripeSessionId: "",
    })),
  };
}

function superadminOnly() {
  return json(
    {
      success: false,
      code: "superadmin_only",
      message: "Forbidden — superadmin only",
    },
    403
  );
}

/** Payment operation visibility snapshot for superadmin or the owning company. */
export async function GET(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { orderId } = await params;
  const order = await loadOrder(orderId);
  if (!order) return json({ success: false, message: "Order not found" }, 404);
  const isSuper = isSuperadminSession(session);
  const ownsOrder = sessionOwnsOrder(session, order);
  if (!isSuper && !ownsOrder) {
    return json(
      { success: false, code: "ORDER_NOT_FOUND", message: "Order not found" },
      404
    );
  }

  if (!isPlatformBooking(order)) {
    return json({
      success: true,
      internalCompanyBooking: true,
      superadmin: isSuper,
      canIssueNewLink: false,
      canResendExisting: false,
      message: "Internal company booking — not a Rovaro payment.",
      view: null,
    });
  }

  const view = await buildMarketplacePaymentOpsView(order);
  const canManagePayment = isSuper || ownsOrder;
  return json({
    success: true,
    superadmin: isSuper,
    canIssueNewLink: canManagePayment && view.canIssueNewLink,
    canResendExisting: isSuper && view.canResendExisting,
    view: isSuper ? view : redactCompanyAdminView(view),
  });
}

export async function POST(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;
  const isSuper = isSuperadminSession(session);

  const { orderId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  const { ipAddress, userAgent } = extractAuditContext(request);

  const order = await loadOrder(orderId);
  if (!order) return json({ success: false, message: "Order not found" }, 404);
  const ownsOrder = sessionOwnsOrder(session, order);
  if (!isSuper && !ownsOrder) {
    return json(
      { success: false, code: "ORDER_NOT_FOUND", message: "Order not found" },
      404
    );
  }

  if (!isPlatformBooking(order)) {
    return json(
      {
        success: false,
        code: "internal_company_booking",
        message: "Internal company booking — not a Rovaro payment.",
      },
      403
    );
  }

  if (action === "resend") {
    if (!isSuper) return superadminOnly();
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
    if (!isSuper && !ownsOrder) {
      return json(
        { success: false, code: "ORDER_NOT_FOUND", message: "Order not found" },
        404
      );
    }
    const result = await reissueMarketplacePaymentLink({
      orderId,
      reason: isSuper ? body?.reason : "payment_link_expired",
      reasonNote: body?.reasonNote,
      actorEmail: session.user?.email || "",
      actorRole: isSuper ? "superadmin" : "admin",
      actorUserId: session.user?.id || session.user?._id || "",
      actorCompanyId: isSuper ? "" : session.user?.ownerId || "",
      ipAddress,
      userAgent,
      idempotencyKey: String(body?.idempotencyKey || ""),
      complianceOverride: isSuper && body?.complianceOverride === true,
      complianceOverrideReason: isSuper
        ? String(body?.complianceOverrideReason || "")
        : "",
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
      url: isSuper ? result.url : "",
      sessionId: isSuper ? result.sessionId : "",
      expiresAt: result.expiresAt,
      idempotent: Boolean(result.idempotent),
      reused: Boolean(result.reused),
      order: result.order || null,
      view: isSuper ? view : redactCompanyAdminView(view),
    });
  }

  if (action === "retry_invalidation") {
    if (!isSuper) return superadminOnly();
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
    if (!isSuper) return superadminOnly();
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
    if (!isSuper) return superadminOnly();
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
