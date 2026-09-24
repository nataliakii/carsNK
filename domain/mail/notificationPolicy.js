/**
 * Central server-side notification policy.
 *
 * All matrix events go through dispatchPlatformNotification().
 * - Idempotent (event + entity id)
 * - Company isolation
 * - Email failure never throws to the caller (business ops stay committed)
 * - Audit for agreement / rental-terms even when email fails
 * - Never uses client-controlled recipient lists for internal mail
 */

import { sendEmailDirect } from "@/lib/email/sendDirect";
import { MAIL_TYPE } from "@/domain/mail/mailTypes";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import {
  NOTIFICATION_EVENT,
  NOTIFICATION_MATRIX,
} from "@/domain/mail/notificationEvents";
import {
  hasNotificationBeenDelivered,
  recordNotificationFailure,
  buildNotificationIdempotencyKey,
} from "@/domain/mail/notificationIdempotency";
import {
  resolveSuperadminRecipients,
  resolveCompanyNotificationRecipients,
} from "@/domain/mail/notificationRecipients";
import { buildNotificationContent } from "@/domain/mail/notificationCopy";
import {
  recommendPartnerDeclineAction,
  normalizePartnerDeclineReason,
} from "@/domain/mail/partnerDeclinePolicy";

const AUDIENCE = {
  COMPANY: "company",
  SUPERADMIN: "superadmin",
};

function mailTypeFor(eventType, audience) {
  if (MAIL_TYPE.PLATFORM_NOTIFICATION) {
    return MAIL_TYPE.PLATFORM_NOTIFICATION;
  }
  if (audience === AUDIENCE.COMPANY) {
    if (String(eventType).startsWith("booking.")) return MAIL_TYPE.ORDER_COMPANY;
    return MAIL_TYPE.GENERIC;
  }
  return MAIL_TYPE.ORDER_SUPERADMIN;
}

async function sendAudienceEmail({
  eventType,
  entityId,
  audience,
  to,
  ctx,
  companyId,
  orderId,
}) {
  if (!to?.length) {
    return { ok: true, skipped: true, reason: "no_recipients" };
  }

  if (
    await hasNotificationBeenDelivered({
      eventType,
      entityId,
      audience,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const content = buildNotificationContent(eventType, audience, ctx);
  if (!content) {
    return { ok: true, skipped: true, reason: "no_content" };
  }

  const idempotencyKey = buildNotificationIdempotencyKey(
    eventType,
    entityId,
    audience
  );

  try {
    await sendEmailDirect({
      title: content.subject,
      message: content.text,
      html: content.html,
      to,
      cc: [],
      meta: {
        type: mailTypeFor(eventType, audience),
        orderId: orderId || undefined,
        companyId: companyId || undefined,
        idempotencyKey,
        payload: {
          eventType,
          entityId: String(entityId || ""),
          audience,
          // Safe summary only — no tokens, passwords, signed URLs.
          orderNumber: ctx.orderNumber || undefined,
          companyName: ctx.companyName || undefined,
        },
      },
    });
    return { ok: true, deduped: false };
  } catch (err) {
    console.error(
      `[notificationPolicy] send failed ${eventType}/${audience}:`,
      err?.message || err
    );
    await recordNotificationFailure({
      eventType,
      entityId,
      audience,
      error: err?.message || String(err),
      meta: {
        type: mailTypeFor(eventType, audience),
        subject: content.subject,
        orderId,
        companyId,
      },
    });
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Rental-terms changes always get an AuditLog row (even when email fails).
 * Agreement acceptance is audited by agreementService before notify — skip here
 * to avoid duplicate PARTNER_AGREEMENT_ACCEPTED rows.
 */
async function auditLegalNotification(eventType, ctx, emailResult) {
  const legalEvents = new Set([
    NOTIFICATION_EVENT.RENTAL_TERMS_UPDATED,
    NOTIFICATION_EVENT.RENTAL_TERMS_REMOVED,
  ]);
  if (!legalEvents.has(eventType)) return;

  await recordAuditEvent({
    action: "PARTNER_PROFILE_UPDATED",
    userRole: "admin",
    userEmail: ctx.actorEmail || "",
    severity: "high",
    result: emailResult?.ok === false ? "partial" : "success",
    metadata: {
      notificationEvent: eventType,
      companyId: ctx.companyId ? String(ctx.companyId) : undefined,
      previousHash: ctx.previousHash || undefined,
      newHash: ctx.newHash || undefined,
      emailDelivered: Boolean(
        emailResult && emailResult.ok !== false && !emailResult.skipped
      ),
    },
  });
}

/**
 * Main entry — fire-and-forget safe. Never throws.
 *
 * @param {string} eventType - NOTIFICATION_EVENT.*
 * @param {{
 *   entityId: string,
 *   companyId?: string,
 *   orderId?: string,
 *   context?: object,
 * }} params
 */
export async function dispatchPlatformNotification(eventType, params = {}) {
  const matrix = NOTIFICATION_MATRIX[eventType];
  if (!matrix) {
    console.warn("[notificationPolicy] unknown event", eventType);
    return { ok: false, code: "unknown_event" };
  }

  const entityId = String(params.entityId || params.orderId || params.companyId || "").trim();
  if (!entityId) {
    console.warn("[notificationPolicy] missing entityId", eventType);
    return { ok: false, code: "missing_entity" };
  }

  const ctx = {
    ...(params.context && typeof params.context === "object" ? params.context : {}),
    companyId: params.companyId || params.context?.companyId,
    orderId: params.orderId || params.context?.orderId,
  };

  const results = { company: null, superadmin: null };

  try {
    if (matrix.companyAdmins && params.companyId) {
      const channel =
        eventType === NOTIFICATION_EVENT.COMPANY_CREATED
          ? "critical"
          : "booking";
      const fallbackEmails = [
        ctx.companyEmail,
        ...(Array.isArray(ctx.companyEmails) ? ctx.companyEmails : []),
      ].filter(Boolean);
      const { emails, company } = await resolveCompanyNotificationRecipients(
        params.companyId,
        channel,
        { fallbackEmails }
      );
      if (company && !ctx.companyName) {
        ctx.companyName = company.name || "";
      }
      results.company = await sendAudienceEmail({
        eventType,
        entityId,
        audience: AUDIENCE.COMPANY,
        to: emails,
        ctx,
        companyId: params.companyId,
        orderId: params.orderId,
      });
    }

    if (matrix.superadmins) {
      const to = resolveSuperadminRecipients();
      results.superadmin = await sendAudienceEmail({
        eventType,
        entityId,
        audience: AUDIENCE.SUPERADMIN,
        to,
        ctx,
        companyId: params.companyId,
        orderId: params.orderId,
      });
    }

    // Agreement / rental-terms: always audit even if email failed.
    await auditLegalNotification(
      eventType,
      ctx,
      results.superadmin || results.company
    );

    return { ok: true, results };
  } catch (err) {
    console.error(
      "[notificationPolicy] unexpected error",
      eventType,
      err?.message || err
    );
    // Still attempt legal audit.
    await auditLegalNotification(eventType, ctx, { ok: false });
    return { ok: false, error: err?.message || String(err) };
  }
}

/** Convenience wrappers used by call sites. */
export async function notifyCompanyCreated(params) {
  return dispatchPlatformNotification(NOTIFICATION_EVENT.COMPANY_CREATED, {
    entityId: params.companyId,
    companyId: params.companyId,
    context: params,
  });
}

export async function notifyAgreementAccepted(params) {
  return dispatchPlatformNotification(NOTIFICATION_EVENT.AGREEMENT_ACCEPTED, {
    entityId: `${params.companyId}:${params.packageChecksum || params.agreementId || "accept"}`,
    companyId: params.companyId,
    context: params,
  });
}

export async function notifyRentalTermsChanged(params) {
  const removed = params.removed === true || params.action === "removed";
  const eventType = removed
    ? NOTIFICATION_EVENT.RENTAL_TERMS_REMOVED
    : NOTIFICATION_EVENT.RENTAL_TERMS_UPDATED;
  return dispatchPlatformNotification(eventType, {
    entityId: `${params.companyId}:${params.newHash || params.previousHash || Date.now()}`,
    companyId: params.companyId,
    context: params,
  });
}

export async function notifyImportantCompanySettings(params) {
  if (!params?.changes?.length) {
    return { ok: true, skipped: true, reason: "no_important_changes" };
  }
  return dispatchPlatformNotification(
    NOTIFICATION_EVENT.IMPORTANT_SETTINGS_CHANGED,
    {
      entityId: `${params.companyId}:${params.requestId || params.timestamp || Date.now()}`,
      companyId: params.companyId,
      context: params,
    }
  );
}

export async function notifyCarLifecycle(params) {
  const action = String(params.action || "added");
  const eventType =
    action === "deleted"
      ? NOTIFICATION_EVENT.CAR_DELETED
      : action === "deactivated"
        ? NOTIFICATION_EVENT.CAR_DEACTIVATED
        : NOTIFICATION_EVENT.CAR_ADDED;
  return dispatchPlatformNotification(eventType, {
    entityId: params.carId || entityFallback(params),
    companyId: params.companyId,
    context: params,
  });
}

function entityFallback(params) {
  return `${params.companyId || "car"}:${Date.now()}`;
}

export async function notifyBookingRequested(params) {
  return dispatchPlatformNotification(NOTIFICATION_EVENT.BOOKING_REQUESTED, {
    entityId: params.orderId,
    companyId: params.companyId,
    orderId: params.orderId,
    context: params,
  });
}

export async function notifyBookingAccepted(params) {
  return dispatchPlatformNotification(NOTIFICATION_EVENT.BOOKING_ACCEPTED, {
    entityId: params.orderId,
    companyId: params.companyId,
    orderId: params.orderId,
    context: params,
  });
}

export async function notifyBookingFeePaid(params) {
  return dispatchPlatformNotification(NOTIFICATION_EVENT.BOOKING_FEE_PAID, {
    entityId: params.orderId,
    companyId: params.companyId,
    orderId: params.orderId,
    context: params,
  });
}

export async function notifyBookingDeclined(params) {
  const normalized = normalizePartnerDeclineReason(
    params.reasonCode || params.reason,
    params.explanation
  );
  const reasonCode = normalized.ok
    ? normalized.code
    : String(params.reasonCode || params.reason || "");
  const explanation = normalized.ok
    ? normalized.explanation
    : String(params.explanation || "").slice(0, 1000);

  const recommendation = recommendPartnerDeclineAction({
    reasonCode,
    feePaid: Boolean(params.feePaid),
    alternativeAvailable: params.alternativeAvailable,
    bookingAlreadyAccepted: Boolean(params.bookingAlreadyAccepted),
  });

  return dispatchPlatformNotification(NOTIFICATION_EVENT.BOOKING_DECLINED, {
    entityId: params.orderId,
    companyId: params.companyId,
    orderId: params.orderId,
    context: {
      ...params,
      reasonCode,
      explanation,
      recommendation: recommendation.recommendation,
      recommendationLabel: recommendation.label,
      autoRefund: false,
    },
  });
}

export {
  NOTIFICATION_EVENT,
  NOTIFICATION_MATRIX,
  normalizePartnerDeclineReason,
  recommendPartnerDeclineAction,
};
