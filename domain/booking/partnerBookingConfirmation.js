/**
 * Partner availability confirmation — the legally significant act by which a
 * supplier commits to a booking.
 *
 * Safety properties:
 *   - opening the link (GET) never changes anything; it only renders a view
 *   - the confirmation itself is a POST that consumes a one-time token
 *   - consumption is a single atomic findOneAndUpdate, so a double submit or
 *     a replayed link resolves to the same result instead of confirming twice
 *   - every step is audit-logged, and an audit failure never rolls back the
 *     business operation
 *   - all money shown and stored is recomputed server-side; nothing is taken
 *     from the request
 */

import { Order } from "@models/order";
import Company from "@models/company";
import { Car } from "@models/car";
import BookingConfirmationToken from "@models/BookingConfirmationToken";
import ConfirmedBookingSnapshot from "@models/ConfirmedBookingSnapshot";
import { connectToDB } from "@lib/database";

import {
  signConfirmationToken,
  verifyConfirmationToken,
  hashConfirmationToken,
} from "./partnerConfirmationToken";
import { BOOKING_STATUS } from "./bookingStatus";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { loadLegalSettings } from "@/domain/legal/legalSettingsService";
import { getAgreementVersionRef } from "@/domain/legal/agreementService";
import { computeSnapshotChecksum } from "@/domain/legal/checksum";
import { resolveDocumentForDisplay } from "@/domain/legal/documentService";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import {
  BOOKING_PREPAYMENT_PERCENT,
  SUPPLIER_BALANCE_PERCENT,
} from "@/domain/legal/legalSettings";

/**
 * Exact wording the partner must accept. Stored verbatim on the snapshot so
 * the record shows what was agreed, not a later revision of the wording.
 */
export const PARTNER_CONFIRMATION_STATEMENT =
  "I confirm that the vehicle is available and that the Supplier is able and authorised to provide it " +
  "on the dates, price and conditions shown above. I accept that this confirmation becomes binding after " +
  "the Customer successfully pays the booking prepayment, subject to the Partner Agreement and Partner " +
  "Operating Rules.";

export const PARTNER_CONFIRMATION_BUTTON_LABEL = "Confirm availability";

/**
 * Issue a fresh one-time confirmation link for an order.
 *
 * @param {{ orderId: string, issuedByEmail?: string, ttlHours?: number }} params
 */
export async function issueConfirmationToken({
  orderId,
  issuedByEmail = "",
  ttlHours,
}) {
  await connectToDB();
  const order = await Order.findById(orderId).select("ownerId").lean();
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Order not found" };
  }

  const settings = await loadLegalSettings();
  const hours = Number(ttlHours) > 0
    ? Number(ttlHours)
    : settings.confirmationTokenExpirationHours;

  const signed = signConfirmationToken({
    orderId: String(orderId),
    companyId: order.ownerId ? String(order.ownerId) : null,
    ttlHours: hours,
  });

  const agreementRef = order.ownerId
    ? await getAgreementVersionRef(order.ownerId).catch(() => null)
    : null;

  await BookingConfirmationToken.create({
    tokenHash: signed.tokenHash,
    jti: signed.jti,
    orderId,
    companyId: order.ownerId || null,
    expiresAt: signed.expiresAt,
    issuedByEmail,
    agreementRef,
  });

  return {
    ok: true,
    token: signed.token,
    jti: signed.jti,
    expiresAt: signed.expiresAt,
  };
}

function minor(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Server-authoritative money for the confirmation page.
 * Derives the prepayment from the stored authoritative price; never trusts a
 * client-supplied total.
 *
 * @param {object} order
 */
export function resolveConfirmationFinancials(order) {
  const auth = order?.authoritativePrice || {};
  const currency = String(auth.currency || order?.currency || "EUR").toUpperCase();

  let grossMinor = minor(auth.grossMinor);
  if (!grossMinor) {
    const fallbackMajor = Number(
      order?.OverridePrice != null ? order.OverridePrice : order?.totalPrice
    );
    grossMinor = Number.isFinite(fallbackMajor)
      ? Math.round(fallbackMajor * 100)
      : 0;
  }

  const percent = Number.isFinite(Number(auth.prepaymentPercent))
    ? Number(auth.prepaymentPercent)
    : BOOKING_PREPAYMENT_PERCENT;

  const prepaymentMinor = minor(auth.prepaymentMinor) ||
    Math.round((grossMinor * percent) / 100);
  const balanceMinor = minor(auth.balanceMinor) || grossMinor - prepaymentMinor;

  return {
    currency,
    grossMinor,
    prepaymentPercent: percent,
    prepaymentMinor: Math.max(0, prepaymentMinor),
    balanceMinor: Math.max(0, balanceMinor),
    supplierBalancePercent: SUPPLIER_BALANCE_PERCENT,
  };
}

/**
 * Everything the partner must see before the button, per the Partner
 * Agreement: booking id, vehicle, dates, pickup/return, full price, booking
 * prepayment, balance due to the Supplier, deposit, insurance, extras,
 * cancellation rules and the applicable agreement version.
 *
 * Read-only. Safe to call from GET.
 *
 * @param {string} token
 */
export async function buildConfirmationView(token) {
  const parsed = verifyConfirmationToken(token);
  if (!parsed.ok) return parsed;

  await connectToDB();

  const record = await BookingConfirmationToken.findOne({
    tokenHash: hashConfirmationToken(token),
  }).lean();
  if (!record) {
    return {
      ok: false,
      status: 400,
      code: "unknown_token",
      message: "This confirmation link is not recognised",
    };
  }

  const order = await Order.findById(parsed.orderId).lean();
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  const [company, car, settings] = await Promise.all([
    order.ownerId
      ? Company.findById(order.ownerId).select("name email").lean()
      : null,
    order.car
      ? Car.findById(order.car)
          .select("model carNumber regNumber transmission numberOfSeats photos franchise deposit class")
          .lean()
      : null,
    loadLegalSettings(),
  ]);

  const financials = resolveConfirmationFinancials(order);

  const { doc: partnerAgreementDoc } = await resolveDocumentForDisplay({
    documentType: LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT,
    language: "en",
  }).catch(() => ({ doc: null }));

  return {
    ok: true,
    alreadyConsumed: Boolean(record.consumedAt),
    decision: record.decision || null,
    expiresAt: record.expiresAt,
    statement: PARTNER_CONFIRMATION_STATEMENT,
    buttonLabel: PARTNER_CONFIRMATION_BUTTON_LABEL,
    booking: {
      bookingId: String(order._id),
      orderNumber: order.orderNumber || "",
      supplierName: company?.name || "",
      vehicle: {
        model: order.carModel || car?.model || "",
        regNumber: order.regNumber || car?.regNumber || "",
        category: car?.class || "",
        transmission: car?.transmission || "",
        seats: car?.numberOfSeats ?? null,
      },
      pickup: {
        atUtc: order.pickupAtUtc || order.timeIn || order.rentalStartDate,
        place: order.placeIn || "",
        detail: order.placeInDetail || "",
      },
      dropoff: {
        atUtc: order.returnAtUtc || order.timeOut || order.rentalEndDate,
        place: order.placeOut || "",
        detail: order.placeOutDetail || "",
      },
      timezone: order.timezone || "",
      numberOfDays: order.numberOfDays ?? null,
      insurance: order.insurance || "",
      extras: {
        childSeats: order.ChildSeats ?? 0,
        secondDriver: Boolean(order.secondDriver),
      },
      /** Vehicle security deposit — collected by the Supplier, separate from
       *  the booking prepayment. */
      securityDeposit: car?.deposit ?? order.franchiseOrder ?? null,
      financials,
    },
    cancellationRules: {
      supplierCancellationServiceCharge:
        settings.supplierCancellationServiceCharge,
      replacementCostDifferenceCap: settings.replacementCostDifferenceCap,
      replacementNotificationHours: settings.replacementNotificationHours,
      currency: settings.commissionCurrency,
    },
    agreement: {
      applicableVersion: record.agreementRef || null,
      partnerAgreementVersion: partnerAgreementDoc
        ? {
            version: partnerAgreementDoc.version,
            checksum: partnerAgreementDoc.checksum,
            language: partnerAgreementDoc.language,
          }
        : null,
    },
  };
}

/**
 * Consume the token and record the decision.
 *
 * Idempotent: a second POST with the same token returns the first result with
 * `idempotent: true` rather than confirming again.
 *
 * @param {{
 *   token: string,
 *   decision: "accepted"|"declined",
 *   accepted: boolean,
 *   ipAddress?: string,
 *   userAgent?: string,
 *   actorEmail?: string,
 *   reason?: string,
 * }} params
 */
export async function consumeConfirmationToken({
  token,
  decision,
  accepted,
  ipAddress = "",
  userAgent = "",
  actorEmail = "",
  reason = "",
}) {
  const parsed = verifyConfirmationToken(token);
  if (!parsed.ok) return parsed;

  if (decision === "accepted" && !accepted) {
    return {
      ok: false,
      status: 400,
      code: "checkbox_required",
      message: "You must tick the confirmation checkbox before confirming availability",
    };
  }

  await connectToDB();
  const tokenHash = hashConfirmationToken(token);
  const now = new Date();

  // Atomic consume — only the first caller matches `consumedAt: null`.
  const consumed = await BookingConfirmationToken.findOneAndUpdate(
    { tokenHash, consumedAt: null, expiresAt: { $gt: now } },
    {
      $set: {
        consumedAt: now,
        decision,
        consumedIp: ipAddress,
        consumedUserAgent: userAgent,
      },
    },
    { new: true }
  );

  if (!consumed) {
    const existing = await BookingConfirmationToken.findOne({ tokenHash });
    if (!existing) {
      return {
        ok: false,
        status: 400,
        code: "unknown_token",
        message: "This confirmation link is not recognised",
      };
    }
    if (!existing.consumedAt && existing.expiresAt <= now) {
      return {
        ok: false,
        status: 410,
        code: "expired",
        message: "This confirmation link has expired. Ask Rovaro for a new one.",
      };
    }

    await BookingConfirmationToken.updateOne(
      { tokenHash },
      { $inc: { replayAttempts: 1 }, $set: { lastReplayAt: now } }
    ).catch(() => {});

    await recordAuditEvent({
      action: "BOOKING_CONFIRMATION_TOKEN_REPLAY",
      severity: "high",
      ipAddress,
      userAgent,
      orderData: { orderId: existing.orderId },
      metadata: { jti: existing.jti, priorDecision: existing.decision },
    });

    return {
      ok: true,
      idempotent: true,
      decision: existing.decision,
      orderId: String(existing.orderId),
      message:
        existing.decision === "accepted"
          ? "This booking was already confirmed."
          : "This booking was already declined.",
    };
  }

  const order = await Order.findById(consumed.orderId);
  if (!order) {
    return { ok: false, status: 404, code: "not_found", message: "Booking not found" };
  }

  if (decision === "accepted") {
    order.companyEmailDecision = "accepted";
    order.companyEmailDecisionAt = now;
    order.bookingStatus = BOOKING_STATUS.CONFIRMED_AWAITING_PAYMENT;
  } else {
    order.companyEmailDecision = "rejected";
    order.companyEmailDecisionAt = now;
    order.bookingStatus = BOOKING_STATUS.SUPPLIER_DECLINED;
  }
  await order.save();

  await recordAuditEvent({
    action:
      decision === "accepted"
        ? "BOOKING_PARTNER_CONFIRMED"
        : "BOOKING_PARTNER_DECLINED",
    userRole: "admin",
    userEmail: actorEmail,
    severity: "critical",
    ipAddress,
    userAgent,
    reason,
    orderData: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      carModel: order.carModel,
      rentalStartDate: order.rentalStartDate,
      rentalEndDate: order.rentalEndDate,
    },
    metadata: {
      jti: consumed.jti,
      statement:
        decision === "accepted" ? PARTNER_CONFIRMATION_STATEMENT : undefined,
      agreementRef: consumed.agreementRef,
    },
  });

  return {
    ok: true,
    idempotent: false,
    decision,
    orderId: String(order._id),
    bookingStatus: order.bookingStatus,
    message:
      decision === "accepted"
        ? "Availability confirmed. The booking becomes binding once the customer pays the booking prepayment."
        : "Booking declined. Rovaro will inform the customer.",
  };
}

/**
 * Create the immutable ConfirmedBookingSnapshot once the customer's
 * prepayment has succeeded. Idempotent per (orderId, sequence).
 *
 * @param {{ orderId: string, reason?: string }} params
 */
export async function createConfirmedBookingSnapshot({
  orderId,
  reason = "initial_confirmation",
}) {
  await connectToDB();

  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { ok: false, code: "not_found", message: "Order not found" };
  }

  const existingCount = await ConfirmedBookingSnapshot.countDocuments({ orderId });
  if (existingCount > 0 && reason === "initial_confirmation") {
    const existing = await ConfirmedBookingSnapshot.findOne({ orderId, sequence: 1 }).lean();
    return { ok: true, idempotent: true, snapshot: existing };
  }
  const sequence = existingCount + 1;

  const [car, settings, confirmationToken] = await Promise.all([
    order.car
      ? Car.findById(order.car)
          .select("model regNumber class transmission numberOfSeats photos deposit")
          .lean()
      : null,
    loadLegalSettings(),
    BookingConfirmationToken.findOne({
      orderId,
      decision: "accepted",
    })
      .sort({ consumedAt: -1 })
      .lean(),
  ]);

  const financials = resolveConfirmationFinancials(order);
  const agreementRef = order.ownerId
    ? await getAgreementVersionRef(order.ownerId).catch(() => null)
    : null;

  const { doc: bookingTerms } = await resolveDocumentForDisplay({
    documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
    language: order.clientLang || "en",
  }).catch(() => ({ doc: null }));

  const payload = {
    orderId,
    orderNumber: order.orderNumber || "",
    companyId: order.ownerId || null,
    sequence,
    reason,
    vehicle: {
      carId: order.car ? String(order.car) : "",
      model: order.carModel || car?.model || "",
      regNumber: order.regNumber || car?.regNumber || "",
      category: car?.class || "",
      transmission: car?.transmission || "",
      seats: car?.numberOfSeats ?? null,
      photos: Array.isArray(car?.photos) ? car.photos.slice(0, 6) : [],
    },
    schedule: {
      pickupAtUtc: order.pickupAtUtc || order.timeIn || order.rentalStartDate || null,
      returnAtUtc: order.returnAtUtc || order.timeOut || order.rentalEndDate || null,
      timezone: order.timezone || "",
      placeIn: order.placeIn || "",
      placeOut: order.placeOut || "",
    },
    financials: {
      currency: financials.currency,
      grossMinor: financials.grossMinor,
      prepaymentPercent: financials.prepaymentPercent,
      prepaymentMinor: financials.prepaymentMinor,
      balanceMinor: financials.balanceMinor,
      depositMinor:
        car?.deposit != null ? Math.round(Number(car.deposit) * 100) : null,
      insurance: order.insurance || "",
      extras: {
        childSeats: order.ChildSeats ?? 0,
        secondDriver: Boolean(order.secondDriver),
      },
      lines: order.authoritativePrice?.lines || null,
      commissionPercent: settings.commissionPercent,
      minimumCommissionAmount: settings.minimumCommissionAmount,
      paymentFeeBearer: settings.paymentFeeBearer,
      vatTreatment: settings.vatTreatment,
    },
    payment: {
      provider: order.payment?.provider || "",
      providerPaymentId: order.payment?.providerPaymentId || "",
      paidAt: order.payment?.paidAt || null,
      amountMinor: Number(order.payment?.amountMinor) || 0,
      currency: String(order.payment?.currency || financials.currency).toUpperCase(),
    },
    partnerConfirmation: {
      confirmedAt: confirmationToken?.consumedAt || order.companyEmailDecisionAt || null,
      confirmedByEmail: "",
      confirmationTokenJti: confirmationToken?.jti || "",
      ipAddress: confirmationToken?.consumedIp || "",
      userAgent: confirmationToken?.consumedUserAgent || "",
      statementAccepted: confirmationToken ? PARTNER_CONFIRMATION_STATEMENT : "",
    },
    legalRefs: {
      agreementId: agreementRef?.agreementId || "",
      agreementPackageChecksum: agreementRef?.packageChecksum || "",
      customerBookingTerms: bookingTerms
        ? {
            documentType: bookingTerms.documentType,
            language: bookingTerms.language,
            version: bookingTerms.version,
            checksum: bookingTerms.checksum,
          }
        : null,
      partnerDocuments: agreementRef?.documents || null,
    },
    cancellationRulesText: "",
  };

  const snapshot = await ConfirmedBookingSnapshot.create({
    ...payload,
    checksum: computeSnapshotChecksum(payload),
  });

  await recordAuditEvent({
    action: "BOOKING_SNAPSHOT_CREATED",
    severity: "high",
    orderData: { orderId: order._id, orderNumber: order.orderNumber },
    metadata: { sequence, reason, checksum: snapshot.checksum },
  });

  return { ok: true, idempotent: false, snapshot: snapshot.toObject() };
}
