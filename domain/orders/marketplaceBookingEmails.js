/**
 * Branded marketplace booking emails (payment request, decline, paid).
 * Recipients are always taken from the stored order / owner company —
 * never from a frontend payload.
 */

import { sendEmailDirect } from "@/lib/email/sendDirect";
import { ROVARO_MAILBOX } from "@config/email";
import Company from "@models/company";
import MailLog from "@models/MailLog";
import { MAIL_RENDER_KEY, MAIL_STATUS, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";
import { normalizeEmailLocale } from "@locales/customerEmail";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import { resolveRentalCheckoutAmount } from "@/domain/orders/companyRentalPaymentPolicy";
import {
  formatMarketplaceEuro,
  marketplaceEmailCopy,
  marketplaceFeeNotice,
  marketplaceFinancialSplit,
} from "@/domain/orders/marketplaceFinancialSplit";
import { connectToDB } from "@lib/database";
import { formatLocationLegLine } from "@/domain/orders/locationSnapshot";
import { sendPaidBookingEmails } from "@/domain/orders/paidBookingEmails";
import {
  BOOKING_EMAIL_AUDIENCE,
  BOOKING_EMAIL_EVENT,
  resolveBookingEmail,
  resolveExceptionBookingEmail,
} from "@/domain/bookings/bookingEmailPolicy";

const COPY = {
  en: {
    paymentSubject: "Your Rovaro car is available — complete your booking",
    paymentIntro:
      "The rental company confirmed your car. Pay now to complete the booking.",
    payCta: "Pay now",
    fullPrice: "Total",
    prepayment: "Pay now",
    remaining: "Pay at pickup",
    expiry: "Link expires",
    remainingNote: "Rovaro booking fee · Non-refundable",
    support: `Questions? ${ROVARO_MAILBOX}`,
    expiredSubject: "Your Rovaro payment link has expired",
    expiredIntro:
      "The payment link for this booking has expired. No money was taken. The car is no longer automatically held.",
    expiredNoMoney: "No money was taken.",
    expiredHold:
      "The car is no longer automatically held for these dates.",
    expiredContact:
      `Contact Rovaro if you still want this car — we can issue a new payment link. Write to ${ROVARO_MAILBOX}.`,
    unavailableSubject: "Your Rovaro payment link is no longer available",
    unavailableBody:
      "This payment link is no longer available. Please contact Rovaro support.",
    reissueSubject: "New Rovaro payment link for your booking",
    reissueIntro:
      "Here is a new payment link. The amount is unchanged.",
    declineSubject: "Your Rovaro booking request could not be confirmed",
    declineIntro:
      "The rental company could not confirm this car for your dates. No money was taken. You can search for other cars on Rovaro.",
    declineNoMoney: "No money was taken.",
    paidCustomerSubject: "Payment received — your Rovaro booking is confirmed",
    paidCustomerIntro:
      "Your payment was successful and the booking is confirmed.",
    paidTen: "Pay now",
    paidNinety: "Pay at pickup",
    nextSteps: "Bring your licence to pickup. Pay the rest there.",
    paidPartnerSubject: "Customer paid — booking confirmed",
    paidPartnerIntro:
      "The customer paid Rovaro. Collect the rest at pickup.",
    refundSubject: "Rovaro booking fee refund",
    refundIntro: "Rovaro has refunded the booking fee for this booking.",
    refundAmount: "Refund amount",
    priceCorrectedCustomerSubject: "Your rental total has been updated",
    priceCorrectedCustomerIntro: "Your rental total has been updated.",
    alreadyPaidOnline: "Already paid online",
    payRentalCompany: "Pay the rental company",
    priceCorrectedPartnerSubject: "Rental total updated",
    updatedRentalTotal: "Updated rental total",
    alreadyPaidToRovaro: "Already paid to Rovaro",
    collectFromCustomer: "Collect from customer",
    customer: "Customer",
    phone: "Phone",
    email: "Email",
    supplier: "Rental company",
    bookingRef: "Booking reference",
    car: "Car",
    pickup: "Pickup",
    return: "Return",
    pickupOffice: "Office pickup",
    pickupDelivery: "Delivery pickup",
    returnOffice: "Office return",
    returnDelivery: "Delivery return",
    pickupFee: "Pickup delivery fee",
    returnFee: "Return delivery fee",
    customerNotes: "Customer notes",
  },
  es: {
    paymentSubject: "Tu coche Rovaro está disponible — completa tu reserva",
    paymentIntro:
      "La empresa de alquiler confirmó tu coche. Paga ahora para completar la reserva.",
    payCta: "Pagar ahora",
    fullPrice: "Total",
    prepayment: "Pagar ahora",
    remaining: "Pagar en la recogida",
    expiry: "El enlace caduca",
    remainingNote: "Tasa de reserva Rovaro · No reembolsable",
    support: `¿Preguntas? ${ROVARO_MAILBOX}`,
    expiredSubject: "Tu enlace de pago Rovaro ha caducado",
    expiredIntro:
      "El enlace de pago de esta reserva ha caducado. No se ha cobrado ningún importe. El coche ya no está reservado automáticamente.",
    expiredNoMoney: "No se ha cobrado ningún importe.",
    expiredHold:
      "El coche ya no está reservado automáticamente para estas fechas.",
    expiredContact:
      `Contacta con Rovaro si todavía quieres este coche: podemos emitir un nuevo enlace de pago. Escribe a ${ROVARO_MAILBOX}.`,
    unavailableSubject: "Tu enlace de pago Rovaro ya no está disponible",
    unavailableBody:
      "Este enlace de pago ya no está disponible. Contacta con el soporte de Rovaro.",
    reissueSubject: "Nuevo enlace de pago Rovaro para tu reserva",
    reissueIntro:
      "Nuevo enlace de pago. El importe no ha cambiado.",
    declineSubject: "Tu solicitud de reserva Rovaro no se pudo confirmar",
    declineIntro:
      "La empresa de alquiler no pudo confirmar este coche para tus fechas. No se ha cobrado ningún importe. Puedes buscar otros coches en Rovaro.",
    declineNoMoney: "No se ha cobrado ningún importe.",
    paidCustomerSubject: "Pago recibido — tu reserva Rovaro está confirmada",
    paidCustomerIntro:
      "Tu pago se realizó correctamente y la reserva está confirmada.",
    paidTen: "Pagar ahora",
    paidNinety: "Pagar en la recogida",
    nextSteps: "Lleva el carnet a la recogida. Paga el resto allí.",
    paidPartnerSubject: "El cliente ha pagado — reserva confirmada",
    paidPartnerIntro:
      "El cliente pagó a Rovaro. Cobra el resto en la entrega.",
    refundSubject: "Reembolso de la tasa de reserva Rovaro",
    refundIntro: "Rovaro ha reembolsado la tasa de reserva de esta reserva.",
    refundAmount: "Importe reembolsado",
    priceCorrectedCustomerSubject: "El total de tu alquiler se ha actualizado",
    priceCorrectedCustomerIntro: "El total de tu alquiler se ha actualizado.",
    alreadyPaidOnline: "Ya pagado online",
    payRentalCompany: "Pagar a la empresa de alquiler",
    priceCorrectedPartnerSubject: "Total de alquiler actualizado",
    updatedRentalTotal: "Total de alquiler actualizado",
    alreadyPaidToRovaro: "Ya pagado a Rovaro",
    collectFromCustomer: "Cobrar al cliente",
    customer: "Cliente",
    phone: "Teléfono",
    email: "Correo",
    supplier: "Empresa de alquiler",
    bookingRef: "Referencia de reserva",
    car: "Coche",
    pickup: "Recogida",
    return: "Devolución",
    pickupOffice: "Recogida en oficina",
    pickupDelivery: "Entrega a domicilio",
    returnOffice: "Devolución en oficina",
    returnDelivery: "Devolución a domicilio",
    pickupFee: "Cargo de recogida",
    returnFee: "Cargo de devolución",
    customerNotes: "Notas del cliente",
  },
};

function copyFor(locale, order) {
  const lang = normalizeEmailLocale(locale);
  const base = COPY[lang] || COPY.en;
  const dynamic = marketplaceEmailCopy(lang);
  const split = marketplaceFinancialSplit(order?.authoritativePrice || order);
  return {
    ...base,
    ...dynamic,
    prepayment: dynamic.paidTen,
    remaining: dynamic.paidNinety,
    remainingNote: marketplaceFeeNotice(lang, split.platformAmountMinor),
  };
}

function money(minor, currency) {
  const amount = (Number(minor) || 0) / 100;
  return `${String(currency || "EUR").toUpperCase()} ${amount.toFixed(2)}`;
}

function placeLine(place, detail) {
  return [place, detail].filter(Boolean).join(" — ");
}

function dateLine(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

function bookingRows(order, t, extras = []) {
  const amounts = resolveRentalCheckoutAmount(order);
  const snap = order.locationSnapshot;
  const pickupLabel = snap?.pickup
    ? formatLocationLegLine(snap.pickup, {
        officeLabel: t.pickupOffice,
        deliveryLabel: t.pickupDelivery,
      })
    : placeLine(order.placeIn, order.placeInDetail);
  const returnLabel = snap?.return
    ? formatLocationLegLine(snap.return, {
        officeLabel: t.returnOffice,
        deliveryLabel: t.returnDelivery,
      })
    : placeLine(order.placeOut, order.placeOutDetail);
  const feeRows = [];
  if (snap?.pickup) {
    feeRows.push([
      t.pickupFee,
      `${snap.currency || "EUR"} ${Number(snap.pickup.feeMajor || 0).toFixed(2)}`,
    ]);
  }
  if (snap?.return) {
    feeRows.push([
      t.returnFee,
      `${snap.currency || "EUR"} ${Number(snap.return.feeMajor || 0).toFixed(2)}`,
    ]);
  }
  return [
    [t.bookingRef, order.orderNumber || String(order._id)],
    [t.car, [order.carModel, order.regNumber].filter(Boolean).join(" ")],
    [t.pickup, `${dateLine(order.pickupAtUtc || order.timeIn)} · ${pickupLabel}`],
    [t.return, `${dateLine(order.returnAtUtc || order.timeOut)} · ${returnLabel}`],
    ...feeRows,
    ...extras,
    [t.fullPrice, money(amounts.grossMinor, amounts.currency)],
  ];
}

function p(text) {
  return `<p style="margin:0 0 16px 0;">${text}</p>`;
}

async function alreadySent({ type, orderId, stripeSessionId }) {
  if (!orderId) return false;
  await connectToDB();
  const query = {
    type,
    orderId,
    status: MAIL_STATUS.SENT,
  };
  if (stripeSessionId) {
    query["payload.stripeSessionId"] = String(stripeSessionId);
  }
  const row = await MailLog.findOne(query).select("_id").lean();
  return Boolean(row);
}

function stripeSessionIdOf({ stripeSessionId, paymentUrl } = {}) {
  if (stripeSessionId) return String(stripeSessionId);
  const url = String(paymentUrl || "");
  const match = /\/(cs_[A-Za-z0-9]+)/.exec(url);
  return match ? match[1] : "";
}

function customerEmailOf(order) {
  const email = String(order?.email || "").trim();
  return email.includes("@") ? email : "";
}

/**
 * Single gate for every customer-facing marketplace email in this module.
 * `domain/bookings/bookingEmailPolicy.js` owns the decision.
 */
function refuseByBookingEmailPolicy(order, mailType, manualTrigger = false) {
  const decision = resolveExceptionBookingEmail({ order, mailType, manualTrigger });
  if (decision.allowed) return null;
  return { ok: true, skipped: true, code: decision.code };
}

function refuseNonPlatformCustomerMail(order) {
  if (isPlatformBooking(order)) return null;
  return { ok: false, skipped: true, code: "not_platform_booking" };
}

/**
 * Payment-request email after partner confirm. Does not create Stripe sessions.
 */
export async function sendCustomerPaymentRequestEmail({
  order,
  paymentUrl,
  expiresAt,
  stripeSessionId,
}) {
  const blocked = refuseNonPlatformCustomerMail(order);
  if (blocked) return blocked;
  const policy = resolveBookingEmail({
    event: BOOKING_EMAIL_EVENT.CUSTOMER_PAYMENT_REQUIRED,
    audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
    order,
  });
  if (!policy.allowed) {
    return { ok: true, skipped: true, code: policy.code };
  }
  const email = customerEmailOf(order);
  if (!email || !paymentUrl) {
    return { ok: false, code: "missing_recipient_or_url" };
  }
  const sessionKey = stripeSessionIdOf({ stripeSessionId, paymentUrl });
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_PAYMENT,
      orderId: order._id,
      stripeSessionId: sessionKey,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const amounts = resolveRentalCheckoutAmount(order);
  const expiryText = expiresAt
    ? dateLine(expiresAt)
    : "";
  const html = renderRovaroBrandedEmail({
    title: t.paymentSubject,
    introHtml:
      p(t.paymentIntro) +
      p(t.remainingNote) +
      p(t.support),
    rows: [
      ...bookingRows(order, t, [
        [t.fullPrice, money(amounts.grossMinor, amounts.currency)],
        [t.prepayment, money(amounts.amountMinor, amounts.currency)],
        [t.remaining, money(amounts.balanceMinor, amounts.currency)],
        expiryText ? [t.expiry, expiryText] : null,
      ].filter(Boolean)),
    ],
    cta: { href: paymentUrl, label: t.payCta },
  });
  const text = [
    t.paymentSubject,
    "",
    t.paymentIntro,
    `${t.bookingRef}: ${order.orderNumber || order._id}`,
    `${t.car}: ${order.carModel || ""}`,
    `${t.fullPrice}: ${money(amounts.grossMinor, amounts.currency)}`,
    `${t.prepayment}: ${money(amounts.amountMinor, amounts.currency)}`,
    `${t.remaining}: ${money(amounts.balanceMinor, amounts.currency)}`,
    expiryText ? `${t.expiry}: ${expiryText}` : null,
    t.remainingNote,
    t.payCta,
    paymentUrl,
    t.support,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmailDirect({
      title: t.paymentSubject,
      message: text,
      html,
      to: [email],
      meta: {
        type: MAIL_TYPE.ORDER_PAYMENT,
        renderKey: MAIL_RENDER_KEY.CUSTOMER_PAYMENT_REQUEST,
        orderId: order._id,
        companyId: order.ownerId,
        payload: {
          paymentUrl,
          stripeSessionId: sessionKey,
          locale: order.clientLang || "en",
          orderNumber: order.orderNumber,
        },
      },
    });
    return { ok: true, deduped: false };
  } catch (err) {
    console.error("[marketplace email] payment request failed", err?.message || err);
    return { ok: false, code: "send_failed", error: err?.message };
  }
}

export async function sendCustomerPaymentExpiredEmail({
  order,
  stripeSessionId = "",
  manualTrigger = false,
}) {
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(order, MAIL_TYPE.ORDER_PAYMENT_EXPIRED, manualTrigger);
  if (blocked) return blocked;
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  const sessionKey =
    stripeSessionIdOf({ stripeSessionId }) ||
    String(order?.payment?.providerPaymentId || "");
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_PAYMENT_EXPIRED,
      orderId: order._id,
      stripeSessionId: sessionKey,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const html = renderRovaroBrandedEmail({
    title: t.expiredSubject,
    introHtml:
      p(t.expiredIntro) +
      p(`<strong>${t.expiredNoMoney}</strong>`) +
      p(t.expiredHold) +
      p(t.expiredContact),
    rows: bookingRows(order, t),
  });
  const text = [
    t.expiredSubject,
    "",
    t.expiredIntro,
    t.expiredNoMoney,
    t.expiredHold,
    `${t.bookingRef}: ${order.orderNumber || order._id}`,
    t.expiredContact,
  ].join("\n");

  try {
    await sendEmailDirect({
      title: t.expiredSubject,
      message: text,
      html,
      to: [email],
      meta: {
        type: MAIL_TYPE.ORDER_PAYMENT_EXPIRED,
        renderKey: MAIL_RENDER_KEY.CUSTOMER_PAYMENT_EXPIRED,
        orderId: order._id,
        companyId: order.ownerId,
        payload: {
          stripeSessionId: sessionKey,
          locale: order.clientLang || "en",
          orderNumber: order.orderNumber,
        },
      },
    });
    return { ok: true, deduped: false };
  } catch (err) {
    console.error("[marketplace email] payment expired failed", err?.message || err);
    return { ok: false, code: "send_failed", error: err?.message };
  }
}

export async function sendCustomerPaymentLinkUnavailableEmail({
  order,
  stripeSessionId = "",
  manualTrigger = false,
}) {
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(
      order,
      MAIL_TYPE.ORDER_PAYMENT_LINK_UNAVAILABLE,
      manualTrigger
    );
  if (blocked) return blocked;
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  const sessionKey =
    stripeSessionIdOf({ stripeSessionId }) ||
    String(order?.payment?.providerPaymentId || "");
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_PAYMENT_LINK_UNAVAILABLE,
      orderId: order._id,
      stripeSessionId: sessionKey,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const html = renderRovaroBrandedEmail({
    title: t.unavailableSubject,
    introHtml: p(t.unavailableBody) + p(t.support),
    rows: bookingRows(order, t),
  });
  const text = [
    t.unavailableSubject,
    "",
    t.unavailableBody,
    t.support,
    `${t.bookingRef}: ${order.orderNumber || order._id}`,
  ].join("\n");

  try {
    await sendEmailDirect({
      title: t.unavailableSubject,
      message: text,
      html,
      to: [email],
      meta: {
        type: MAIL_TYPE.ORDER_PAYMENT_LINK_UNAVAILABLE,
        renderKey: MAIL_RENDER_KEY.CUSTOMER_PAYMENT_LINK_UNAVAILABLE,
        orderId: order._id,
        companyId: order.ownerId,
        payload: {
          stripeSessionId: sessionKey,
          locale: order.clientLang || "en",
          orderNumber: order.orderNumber,
        },
      },
    });
    return { ok: true, deduped: false };
  } catch (err) {
    console.error(
      "[marketplace email] payment link unavailable failed",
      err?.message || err
    );
    return { ok: false, code: "send_failed", error: err?.message };
  }
}

export async function sendCustomerNewPaymentLinkEmail({
  order,
  paymentUrl,
  expiresAt,
  stripeSessionId,
  manualTrigger = true,
}) {
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(
      order,
      MAIL_TYPE.ORDER_PAYMENT_REISSUED,
      manualTrigger
    );
  if (blocked) return blocked;
  const email = customerEmailOf(order);
  if (!email || !paymentUrl) {
    return { ok: false, code: "missing_recipient_or_url" };
  }
  const sessionKey = stripeSessionIdOf({ stripeSessionId, paymentUrl });
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_PAYMENT_REISSUED,
      orderId: order._id,
      stripeSessionId: sessionKey,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const amounts = resolveRentalCheckoutAmount(order);
  const expiryText = expiresAt ? dateLine(expiresAt) : "";
  const html = renderRovaroBrandedEmail({
    title: t.reissueSubject,
    introHtml: p(t.reissueIntro) + p(t.remainingNote) + p(t.support),
    rows: [
      ...bookingRows(order, t, [
        [t.fullPrice, money(amounts.grossMinor, amounts.currency)],
        [t.prepayment, money(amounts.amountMinor, amounts.currency)],
        [t.remaining, money(amounts.balanceMinor, amounts.currency)],
        expiryText ? [t.expiry, expiryText] : null,
      ].filter(Boolean)),
    ],
    cta: { href: paymentUrl, label: t.payCta },
  });
  const text = [
    t.reissueSubject,
    "",
    t.reissueIntro,
    `${t.bookingRef}: ${order.orderNumber || order._id}`,
    `${t.car}: ${order.carModel || ""}`,
    `${t.fullPrice}: ${money(amounts.grossMinor, amounts.currency)}`,
    `${t.prepayment}: ${money(amounts.amountMinor, amounts.currency)}`,
    `${t.remaining}: ${money(amounts.balanceMinor, amounts.currency)}`,
    expiryText ? `${t.expiry}: ${expiryText}` : null,
    t.payCta,
    paymentUrl,
    t.support,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmailDirect({
      title: t.reissueSubject,
      message: text,
      html,
      to: [email],
      meta: {
        type: MAIL_TYPE.ORDER_PAYMENT_REISSUED,
        renderKey: MAIL_RENDER_KEY.CUSTOMER_PAYMENT_REISSUED,
        orderId: order._id,
        companyId: order.ownerId,
        payload: {
          paymentUrl,
          stripeSessionId: sessionKey,
          locale: order.clientLang || "en",
          orderNumber: order.orderNumber,
        },
      },
    });
    return { ok: true, deduped: false };
  } catch (err) {
    console.error("[marketplace email] new payment link failed", err?.message || err);
    return { ok: false, code: "send_failed", error: err?.message };
  }
}

/**
 * Supplier decline does not notify the customer automatically — it creates a
 * manual Rovaro task. Only a human at Rovaro may send this.
 */
export async function sendCustomerDeclineEmail({
  order,
  reason = "",
  manualTrigger = false,
}) {
  if (!manualTrigger) {
    return { ok: true, skipped: true, code: "decline_is_a_manual_rovaro_task" };
  }
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(order, MAIL_TYPE.ORDER_DECLINED, manualTrigger);
  if (blocked) return blocked;
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_DECLINED,
      orderId: order._id,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const html = renderRovaroBrandedEmail({
    title: t.declineSubject,
    introHtml: p(t.declineIntro) + p(`<strong>${t.declineNoMoney}</strong>`) + p(t.support),
    rows: bookingRows(order, t, reason ? [["Reason", reason] ] : []),
  });
  const text = [
    t.declineSubject,
    "",
    t.declineIntro,
    t.declineNoMoney,
    reason ? `Reason: ${reason}` : null,
    t.support,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmailDirect({
      title: t.declineSubject,
      message: text,
      html,
      to: [email],
      meta: {
        type: MAIL_TYPE.ORDER_DECLINED,
        renderKey: MAIL_RENDER_KEY.CUSTOMER_BOOKING_DECLINED,
        orderId: order._id,
        companyId: order.ownerId,
        payload: { reason, locale: order.clientLang || "en" },
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[marketplace email] decline failed", err?.message || err);
    return { ok: false, code: "send_failed", error: err?.message };
  }
}

export async function sendPaidConfirmationEmails({ order }) {
  return sendPaidBookingEmails({ order });
}

/** Refunds are a dispute/support action, never part of the standard flow. */
export async function sendCustomerBookingFeeRefundEmail({
  order,
  amountMinor,
  currency,
  reason = "",
  manualTrigger = true,
} = {}) {
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(
      order,
      MAIL_TYPE.ORDER_BOOKING_FEE_REFUNDED,
      manualTrigger
    );
  if (blocked) return blocked;
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_BOOKING_FEE_REFUNDED,
      orderId: order._id,
    })
  ) {
    return { ok: true, deduped: true };
  }

  const t = copyFor(order.clientLang || order.locale, order);
  const amounts = resolveRentalCheckoutAmount(order);
  const html = renderRovaroBrandedEmail({
    title: t.refundSubject,
    introHtml: p(t.refundIntro) + p(t.support),
    rows: bookingRows(order, t, [
      [t.refundAmount, money(amountMinor ?? amounts.amountMinor, currency || amounts.currency)],
    ]),
  });
  const text = [
    t.refundIntro,
    `${t.refundAmount}: ${money(amountMinor ?? amounts.amountMinor, currency || amounts.currency)}`,
    reason ? reason : null,
    t.support,
  ]
    .filter(Boolean)
    .join("\n");

  await sendEmailDirect({
    title: t.refundSubject,
    message: text,
    html,
    to: [email],
    meta: {
      type: MAIL_TYPE.ORDER_BOOKING_FEE_REFUNDED,
      renderKey: MAIL_RENDER_KEY.CUSTOMER_BOOKING_FEE_REFUNDED,
      orderId: order._id,
      companyId: order.ownerId,
      payload: {
        locale: order.clientLang || "en",
        amountMinor: amountMinor ?? amounts.amountMinor,
        reason,
      },
    },
  });
  return { ok: true };
}

export function marketplacePaymentCopy(locale, order) {
  return copyFor(locale, order);
}

export function marketplacePriceCorrectionCopy(locale = "en") {
  const lang = normalizeEmailLocale(locale);
  const t = COPY[lang] || COPY.en;
  return {
    customerSubject: t.priceCorrectedCustomerSubject,
    customerIntro: t.priceCorrectedCustomerIntro,
    alreadyPaidOnline: t.alreadyPaidOnline,
    payRentalCompany: t.payRentalCompany,
    partnerSubject: t.priceCorrectedPartnerSubject,
    updatedRentalTotal: t.updatedRentalTotal,
    alreadyPaidToRovaro: t.alreadyPaidToRovaro,
    collectFromCustomer: t.collectFromCustomer,
  };
}

/** A superadmin price correction, not an automatic lifecycle email. */
export async function sendMarketplacePriceCorrectionEmails({
  order,
  revision,
  manualTrigger = true,
} = {}) {
  const blocked =
    refuseNonPlatformCustomerMail(order) ||
    refuseByBookingEmailPolicy(
      order,
      MAIL_TYPE.ORDER_PRICE_CORRECTED_CUSTOMER,
      manualTrigger
    );
  if (blocked) return { customer: blocked, partner: blocked };
  await connectToDB();
  const customerLocale = order?.clientLang || order?.locale || "en";
  const customerCopy = marketplacePriceCorrectionCopy(customerLocale);
  const partnerCopy = marketplacePriceCorrectionCopy("en");
  const paidMinor = Number(revision?.fixedPaidPlatformAmountMinor || 0);
  const collectMinor = Number(revision?.revisedSupplierBalanceMinor || 0);
  const totalMinor = Number(revision?.revisedGrossMinor || 0);
  const mailed = { customer: { ok: false }, partner: { ok: false } };

  const customerEmail = customerEmailOf(order);
  if (customerEmail) {
    try {
      const html = renderRovaroBrandedEmail({
        title: customerCopy.customerSubject,
        introHtml: p(customerCopy.customerIntro),
        rows: [
          [customerCopy.alreadyPaidOnline, formatMarketplaceEuro(paidMinor)],
          [customerCopy.payRentalCompany, formatMarketplaceEuro(collectMinor)],
        ],
      });
      const text = [
        customerCopy.customerIntro,
        `${customerCopy.alreadyPaidOnline}: ${formatMarketplaceEuro(paidMinor)}`,
        `${customerCopy.payRentalCompany}: ${formatMarketplaceEuro(collectMinor)}`,
      ].join("\n");
      await sendEmailDirect({
        title: customerCopy.customerSubject,
        message: text,
        html,
        to: [customerEmail],
        meta: {
          type: MAIL_TYPE.ORDER_PRICE_CORRECTED_CUSTOMER,
          renderKey: MAIL_RENDER_KEY.CUSTOMER_PRICE_CORRECTED,
          orderId: order._id,
          companyId: order.ownerId,
          payload: {
            locale: customerLocale,
            paidMinor,
            collectMinor,
            totalMinor,
          },
        },
      });
      mailed.customer = { ok: true };
    } catch (err) {
      console.error("[marketplace email] price correction customer failed", err?.message || err);
      mailed.customer = { ok: false, error: err?.message };
    }
  }

  const company = order?.ownerId
    ? await Company.findById(order.ownerId).select("email name").lean()
    : null;
  const partnerEmail = String(company?.email || "").trim();
  if (partnerEmail.includes("@")) {
    try {
      const html = renderRovaroBrandedEmail({
        title: partnerCopy.partnerSubject,
        introHtml: p(
          `${partnerCopy.updatedRentalTotal}: ${formatMarketplaceEuro(totalMinor)}`
        ),
        rows: [
          [partnerCopy.alreadyPaidToRovaro, formatMarketplaceEuro(paidMinor)],
          [partnerCopy.collectFromCustomer, formatMarketplaceEuro(collectMinor)],
        ],
      });
      const text = [
        `${partnerCopy.updatedRentalTotal}: ${formatMarketplaceEuro(totalMinor)}`,
        `${partnerCopy.alreadyPaidToRovaro}: ${formatMarketplaceEuro(paidMinor)}`,
        `${partnerCopy.collectFromCustomer}: ${formatMarketplaceEuro(collectMinor)}`,
      ].join("\n");
      await sendEmailDirect({
        title: partnerCopy.partnerSubject,
        message: text,
        html,
        to: [partnerEmail],
        meta: {
          type: MAIL_TYPE.ORDER_PRICE_CORRECTED_PARTNER,
          renderKey: MAIL_RENDER_KEY.PARTNER_PRICE_CORRECTED,
          orderId: order._id,
          companyId: order.ownerId,
          payload: {
            locale: "en",
            paidMinor,
            collectMinor,
            totalMinor,
          },
        },
      });
      mailed.partner = { ok: true };
    } catch (err) {
      console.error("[marketplace email] price correction partner failed", err?.message || err);
      mailed.partner = { ok: false, error: err?.message };
    }
  }

  return { ok: mailed.customer.ok || mailed.partner.ok, ...mailed };
}

export { COPY as MARKETPLACE_EMAIL_COPY };
