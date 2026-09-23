/**
 * Branded alternative-vehicle emails. Recipients are always taken from the
 * stored order / owner company — never from a request body.
 */

import { sendEmailDirect } from "@/lib/email/sendDirect";
import { ROVARO_MAILBOX } from "@config/email";
import { getBrandName } from "@config/brand";
import Company from "@models/company";
import MailLog from "@models/MailLog";
import { MAIL_RENDER_KEY, MAIL_STATUS, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { renderRovaroBrandedEmail } from "@/app/ui/email/templates/rovaroBrandedEmail";
import { escapeHtml } from "@/app/ui/email/theme/nataliCarsEmailTheme";
import { normalizeEmailLocale } from "@locales/customerEmail";
import { marketplaceEmailCopy, marketplaceFeeNotice, marketplaceSplitLabels } from "@/domain/orders/marketplaceFinancialSplit";
import { connectToDB } from "@lib/database";
import { buildAlternativeOfferUrl } from "@/domain/booking/alternativeVehicleView";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import { formatLocationLegLine } from "@/domain/orders/locationSnapshot";

export const ALTERNATIVE_EMAIL_COPY = {
  en: {
    offeredSubject: "Rovaro — a replacement car is available for your booking",
    offeredIntro:
      "A replacement car is available. Nothing changes until you accept.",
    viewOffer: "View offer",
    requested: "Requested car",
    proposed: "Proposed car",
    sameOrBetter: "Same class or better",
    price: "Total",
    discount: "Replacement discount",
    prepayment: "Pay now",
    remaining: "Pay at pickup",
    pickup: "Pickup",
    return: "Return",
    expiry: "This offer expires",
    termsChanged: "Some rental conditions have changed — review them on the offer page before accepting.",
    termsSame: "Rental conditions are unchanged.",
    reason: "Why the car is being replaced",
    support: `Questions? ${ROVARO_MAILBOX}`,
    acceptedSubject: "Customer accepted a replacement car",
    acceptedIntro: "The customer accepted the replacement car. A payment link was created.",
    declinedSubject: "Customer declined a replacement car",
    declinedIntro: "The customer declined this replacement. You can offer another car.",
    expiredSubject: "A replacement-car offer has expired",
    expiredIntro: "The offer expired without a decision. You can offer another car.",
    withdrawnSubject: "Your Rovaro replacement offer was withdrawn",
    withdrawnIntro: "The rental company withdrew this offer. Nothing was charged.",
    paySubject: "Complete your Rovaro booking — replacement accepted",
    payIntro: "You accepted the replacement car. Pay now to complete the booking.",
    payCta: "Pay now",
  },
  es: {
    offeredSubject: "Rovaro — hay un coche de sustitución para tu reserva",
    offeredIntro:
      "Hay un coche de sustitución. Nada cambia hasta que aceptes.",
    viewOffer: "Ver oferta",
    requested: "Coche solicitado",
    proposed: "Coche propuesto",
    sameOrBetter: "Misma categoría o superior",
    price: "Total",
    discount: "Descuento de sustitución",
    prepayment: "Pagar ahora",
    remaining: "Pagar en la recogida",
    pickup: "Recogida",
    return: "Devolución",
    expiry: "Esta oferta caduca",
    termsChanged:
      "Algunas condiciones de alquiler han cambiado: revísalas en la página de la oferta antes de aceptar.",
    termsSame: "Las condiciones de alquiler no han cambiado.",
    reason: "Por qué se sustituye el coche",
    support: `¿Preguntas? ${ROVARO_MAILBOX}`,
    acceptedSubject: "El cliente aceptó un coche de sustitución",
    acceptedIntro:
      "El cliente aceptó el coche de sustitución. Se creó un enlace de pago.",
    declinedSubject: "El cliente rechazó un coche de sustitución",
    declinedIntro: "El cliente rechazó esta sustitución. Puedes ofrecer otro coche.",
    expiredSubject: "Ha caducado una oferta de coche de sustitución",
    expiredIntro: "La oferta caducó sin decisión. Puedes ofrecer otro coche.",
    withdrawnSubject: "Se retiró tu oferta de sustitución Rovaro",
    withdrawnIntro:
      "La empresa de alquiler retiró esta oferta. No se ha cobrado nada.",
    paySubject: "Completa tu reserva Rovaro — sustitución aceptada",
    payIntro: "Has aceptado el coche de sustitución. Paga ahora para completar la reserva.",
    payCta: "Pagar ahora",
  },
};

function copyFor(locale, order) {
  const lang = normalizeEmailLocale(locale);
  const base = ALTERNATIVE_EMAIL_COPY[lang] || ALTERNATIVE_EMAIL_COPY.en;
  const labels = marketplaceSplitLabels(lang);
  const emails = marketplaceEmailCopy(lang);
  return {
    ...base,
    prepayment: labels.payNow,
    remaining: labels.payAtPickup,
    acceptedIntro:
      lang === "es"
        ? "El cliente aceptó el coche de sustitución. Se creó un enlace de pago."
        : "The customer accepted the replacement car. A payment link was created.",
    payIntro:
      lang === "es"
        ? "Has aceptado el coche de sustitución. Paga ahora para completar la reserva."
        : "You accepted the replacement car. Pay now to complete the booking.",
    payCta: emails.payCta,
  };
}

function money(minor, currency = "EUR") {
  return `${String(currency || "EUR").toUpperCase()} ${((Number(minor) || 0) / 100).toFixed(2)}`;
}

function dateLine(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

function p(text) {
  return `<p style="margin:0 0 16px 0;">${escapeHtml(text)}</p>`;
}

function vehicleName(side) {
  if (!side) return "—";
  return [side.make, side.model].filter(Boolean).join(" ") || side.name || "—";
}

function customerEmailOf(order) {
  const email = String(order?.email || "").trim();
  return email.includes("@") ? email : "";
}

async function alreadySent({ type, orderId, offerId }) {
  if (!orderId || !offerId) return false;
  await connectToDB();
  const row = await MailLog.findOne({
    type,
    orderId,
    status: { $in: [MAIL_STATUS.SENT, MAIL_STATUS.SKIPPED] },
    "payload.offerId": String(offerId),
  })
    .select("_id")
    .lean();
  return Boolean(row);
}

function locationLine(order, offer, t) {
  const snap = offer?.proposedLocationSnapshot || order?.locationSnapshot;
  const pickup = snap?.pickup
    ? formatLocationLegLine(snap.pickup, {
        officeLabel: "Office",
        deliveryLabel: "Delivery",
      })
    : [order?.placeIn, order?.placeInDetail].filter(Boolean).join(" — ");
  const ret = snap?.return
    ? formatLocationLegLine(snap.return, {
        officeLabel: "Office",
        deliveryLabel: "Delivery",
      })
    : [order?.placeOut, order?.placeOutDetail].filter(Boolean).join(" — ");
  return {
    pickup: `${dateLine(order?.pickupAtUtc || order?.timeIn)} · ${pickup || "—"}`,
    return: `${dateLine(order?.returnAtUtc || order?.timeOut)} · ${ret || "—"}`,
  };
}

function offerRows(order, offer, t) {
  const original = offer.originalRequest?.vehicle || {};
  const proposed = offer.vehicle || {};
  const loc = locationLine(order, offer, t);
  const discount = Number(offer.replacementDiscountMinor) || 0;
  const rows = [
    ["Booking reference", order.orderNumber || String(order._id)],
    [t.requested, vehicleName(original) || order.carModel || "—"],
    [t.proposed, vehicleName(proposed)],
    [t.sameOrBetter, t.sameOrBetter],
    [t.pickup, loc.pickup],
    [t.return, loc.return],
    [t.price, money(offer.offeredGrossMinor ?? offer.priceMinor, offer.currency)],
  ];
  if (discount > 0) {
    rows.push([t.discount, money(discount, offer.currency)]);
  }
  rows.push(
    [t.prepayment, money(offer.prepaymentMinor, offer.currency)],
    [t.remaining, money(offer.balanceMinor, offer.currency)],
    [t.expiry, dateLine(offer.expiresAt)]
  );
  if (offer.reasonForReplacement) {
    rows.push([t.reason, String(offer.reasonForReplacement)]);
  }
  return rows;
}

async function loadOwnerCompany(order) {
  if (!order?.ownerId) return null;
  return Company.findById(order.ownerId).select("name email").lean();
}

export async function sendAlternativeOfferedEmail({ order, offer }) {
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_ALTERNATIVE_OFFERED,
      orderId: order._id,
      offerId: offer.offerId,
    })
  ) {
    return { ok: true, deduped: true };
  }
  const locale = order.clientLang || order.locale || "en";
  const t = copyFor(locale, order);
  const url = buildAlternativeOfferUrl(offer.offerId, locale);
  const html = renderRovaroBrandedEmail({
    title: t.offeredSubject,
    introHtml:
      p(t.offeredIntro) +
      p(offer.termsChanged ? t.termsChanged : t.termsSame) +
      p(t.support),
    rows: offerRows(order, offer, t),
    cta: { href: url, label: t.viewOffer },
  });
  return sendEmailDirect({
    title: t.offeredSubject,
    message: [
      t.offeredIntro,
      `${t.requested}: ${vehicleName(offer.originalRequest?.vehicle) || order.carModel}`,
      `${t.proposed}: ${vehicleName(offer.vehicle)}`,
      url,
    ].join("\n"),
    html,
    to: [email],
    meta: {
      type: MAIL_TYPE.ORDER_ALTERNATIVE_OFFERED,
      renderKey: MAIL_RENDER_KEY.ALTERNATIVE_OFFERED,
      orderId: order._id,
      companyId: order.ownerId,
      payload: { offerId: offer.offerId, locale },
    },
  });
}

export async function sendAlternativePaymentLinkEmail({
  order,
  offer,
  paymentUrl,
  expiresAt,
  stripeSessionId,
}) {
  const email = customerEmailOf(order);
  if (!email || !paymentUrl) return { ok: false, code: "missing_recipient_or_url" };
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_PAYMENT,
      orderId: order._id,
      offerId: offer.offerId,
    })
  ) {
    return { ok: true, deduped: true };
  }
  const t = copyFor(order.clientLang || order.locale, order);
  const html = renderRovaroBrandedEmail({
    title: t.paySubject,
    introHtml: p(t.payIntro) + p(marketplaceFeeNotice(order.clientLang || order.locale, offer.prepaymentMinor)) + p(t.support),
    rows: [
      ...offerRows(order, offer, t),
      expiresAt ? [t.expiry, dateLine(expiresAt)] : null,
    ].filter(Boolean),
    cta: { href: paymentUrl, label: t.payCta },
  });
  return sendEmailDirect({
    title: t.paySubject,
    message: `${t.payIntro}\n${paymentUrl}`,
    html,
    to: [email],
    meta: {
      type: MAIL_TYPE.ORDER_PAYMENT,
      renderKey: MAIL_RENDER_KEY.ALTERNATIVE_PAYMENT_LINK,
      orderId: order._id,
      companyId: order.ownerId,
      payload: {
        offerId: offer.offerId,
        stripeSessionId: stripeSessionId || "",
      },
    },
  });
}

export async function sendAlternativeWithdrawnEmail({ order, offer }) {
  const email = customerEmailOf(order);
  if (!email) return { ok: false, code: "missing_recipient" };
  if (
    await alreadySent({
      type: MAIL_TYPE.ORDER_ALTERNATIVE_WITHDRAWN,
      orderId: order._id,
      offerId: offer.offerId,
    })
  ) {
    return { ok: true, deduped: true };
  }
  const t = copyFor(order.clientLang || order.locale, order);
  const html = renderRovaroBrandedEmail({
    title: t.withdrawnSubject,
    introHtml: p(t.withdrawnIntro) + p(t.support),
    rows: offerRows(order, offer, t),
  });
  return sendEmailDirect({
    title: t.withdrawnSubject,
    message: t.withdrawnIntro,
    html,
    to: [email],
    meta: {
      type: MAIL_TYPE.ORDER_ALTERNATIVE_WITHDRAWN,
      renderKey: MAIL_RENDER_KEY.ALTERNATIVE_WITHDRAWN,
      orderId: order._id,
      companyId: order.ownerId,
      payload: { offerId: offer.offerId },
    },
  });
}

async function notifyCompanyAndSuperadmin({ order, offer, subject, intro, type, renderKey }) {
  const company = await loadOwnerCompany(order);
  const companyEmail = String(company?.email || "").trim();
  const t = copyFor("en", order);
  if (companyEmail.includes("@")) {
    if (
      !(await alreadySent({
        type,
        orderId: order._id,
        offerId: offer.offerId,
      }))
    ) {
      const html = renderRovaroBrandedEmail({
        title: subject,
        introHtml: p(intro),
        rows: offerRows(order, offer, t),
      });
      await sendEmailDirect({
        title: subject,
        message: intro,
        html,
        to: [companyEmail],
        meta: {
          type,
          renderKey,
          orderId: order._id,
          companyId: order.ownerId,
          payload: { offerId: offer.offerId, audience: "company" },
        },
      });
    }
  }
  await notifySuperadmin({
    title: `${subject} — #${order.orderNumber || order._id}`,
    bodyLines: [
      intro,
      `Offer ${offer.offerId}`,
      `Car requested: ${order.carModel || offer.originalRequest?.vehicle?.model || "—"}`,
      `Car proposed: ${vehicleName(offer.vehicle)}`,
      `Status: ${offer.status}`,
    ],
    meta: { orderId: order._id, offerId: offer.offerId },
  });
  return { ok: true };
}

export async function sendAlternativeAcceptedNotice({ order, offer }) {
  const t = copyFor("en", order);
  return notifyCompanyAndSuperadmin({
    order,
    offer,
    subject: t.acceptedSubject,
    intro: t.acceptedIntro,
    type: MAIL_TYPE.ORDER_ALTERNATIVE_ACCEPTED,
    renderKey: MAIL_RENDER_KEY.ALTERNATIVE_ACCEPTED,
  });
}

export async function sendAlternativeDeclinedNotice({ order, offer }) {
  const t = copyFor("en", order);
  return notifyCompanyAndSuperadmin({
    order,
    offer,
    subject: t.declinedSubject,
    intro: t.declinedIntro,
    type: MAIL_TYPE.ORDER_ALTERNATIVE_DECLINED,
    renderKey: MAIL_RENDER_KEY.ALTERNATIVE_DECLINED,
  });
}

export async function sendAlternativeExpiredNotice({ order, offer }) {
  const t = copyFor("en", order);
  return notifyCompanyAndSuperadmin({
    order,
    offer,
    subject: t.expiredSubject,
    intro: t.expiredIntro,
    type: MAIL_TYPE.ORDER_ALTERNATIVE_EXPIRED,
    renderKey: MAIL_RENDER_KEY.ALTERNATIVE_EXPIRED,
  });
}

export { getBrandName };
