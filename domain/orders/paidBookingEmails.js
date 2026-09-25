/**
 * Post-payment emails after a verified Stripe Booking Fee.
 *
 * Three templates, three audiences. The superadmin template is never sent
 * to the customer or the supplier. Email failure is returned, not thrown,
 * so the Stripe webhook can keep the payment.
 */

import { connectToDB } from "@lib/database";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import { normalizeEmailAddress } from "@config/email";
import Company from "@models/company";
import MailLog from "@models/MailLog";
import { MAIL_RENDER_KEY, MAIL_STATUS, MAIL_TYPE } from "@/domain/mail/mailTypes";
import {
  resolveCompanyNotificationRecipients,
  resolveSuperadminRecipients,
} from "@/domain/mail/notificationRecipients";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  formatSnapshotMoney,
  resolveBookingFinancialSnapshot,
} from "@/domain/orders/bookingFinancialSnapshot";
import {
  assignPublicBookingReference,
  isValidPublicBookingReference,
} from "@/domain/booking/publicBookingReference";
import {
  assertCustomerEmailSafe,
  BOOKING_EMAIL_AUDIENCE,
  BOOKING_EMAIL_EVENT,
  resolveBookingEmail,
  shortBookingDateRange,
} from "@/domain/bookings/bookingEmailPolicy";
import {
  createCustomerBookingAccess,
  rotateCustomerBookingAccess,
} from "@/domain/booking/customerBookingAccess";
import {
  customerBookingDetailsUrl,
  renderCustomerBookingConfirmedEmail,
  CUSTOMER_BOOKING_CONFIRMED,
} from "@/app/ui/email/templates/customerBookingConfirmed";
import {
  renderSupplierBookingPaidEmail,
  SUPPLIER_BOOKING_PAID,
} from "@/app/ui/email/templates/supplierBookingPaid";
import {
  renderSuperadminBookingPaymentReceivedEmail,
  SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
} from "@/app/ui/email/templates/superadminBookingPaymentReceived";

export {
  CUSTOMER_BOOKING_CONFIRMED,
  SUPPLIER_BOOKING_PAID,
  SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
};

function addresses(list) {
  return (Array.isArray(list) ? list : [list])
    .map((value) => normalizeEmailAddress(value))
    .filter(Boolean);
}

export function assertCustomerRecipient(to, customerEmail) {
  const dest = addresses(to);
  const customer = normalizeEmailAddress(customerEmail);
  if (!customer || dest.length !== 1 || dest[0] !== customer) {
    return { ok: false, code: "customer_recipient_guard" };
  }
  return { ok: true, to: dest };
}

export function assertSupplierRecipients(to, allowedCompanyEmails) {
  const allowed = new Set(addresses(allowedCompanyEmails));
  const dest = addresses(to);
  const foreign = dest.filter((email) => !allowed.has(email));
  if (!dest.length || foreign.length || allowed.size === 0) {
    return { ok: false, code: "company_isolation", foreign };
  }
  return { ok: true, to: dest };
}

export function assertSuperadminRecipients(to, superadminEmails) {
  const allowed = new Set(addresses(superadminEmails));
  const dest = addresses(to);
  const foreign = dest.filter((email) => !allowed.has(email));
  if (!dest.length || foreign.length) {
    return { ok: false, code: "superadmin_recipient_guard", foreign };
  }
  return { ok: true, to: dest };
}

/** One implementation, owned by the booking email policy. */
export const shortDateRange = shortBookingDateRange;

function ymdFromUtc(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function whenLabel(local, utc) {
  if (local?.date) {
    return [local.date, local.time].filter(Boolean).join(" ");
  }
  if (!utc) return "—";
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function locationLabel(order, leg) {
  const snapLeg =
    leg === "pickup"
      ? order?.locationSnapshot?.pickup
      : order?.locationSnapshot?.return || order?.locationSnapshot?.dropoff;
  if (snapLeg) {
    const line = [snapLeg.name, snapLeg.address, snapLeg.city]
      .filter(Boolean)
      .join(", ");
    if (line) return line;
  }
  if (leg === "pickup") return order?.placeInDetail || order?.placeIn || "—";
  return order?.placeOutDetail || order?.placeOut || "—";
}

function vehicleName(order) {
  const current = String(order?.carModel || "").trim();
  return current || "your vehicle";
}

function supplierPhone(company) {
  const direct = String(company?.meetingContactPhone || "").trim();
  if (direct) return direct;
  const first = Array.isArray(company?.meetingContacts)
    ? company.meetingContacts.find((row) => String(row?.phone || "").trim())
    : null;
  return String(first?.phone || "").trim();
}

function collectionInstructions(order) {
  return String(
    order?.locationSnapshot?.pickup?.instructions ||
      order?.locationSnapshot?.pickup?.collectionInstructions ||
      ""
  ).trim();
}

async function alreadySent(type, orderId) {
  if (!orderId) return false;
  const row = await MailLog.findOne({
    type,
    orderId,
    status: MAIL_STATUS.SENT,
  })
    .select("_id")
    .lean();
  return Boolean(row);
}

function paidEmailsSettled(results) {
  return ["customer", "supplier", "superadmin"].every((key) => {
    const row = results[key];
    if (!row) return false;
    if (row.ok === false && !row.skipped) return false;
    return true;
  });
}

async function ensureDeliverySecrets(order) {
  if (
    isValidPublicBookingReference(order?.publicReference) &&
    order?._customerAccessToken
  ) {
    return {
      publicReference: order.publicReference,
      accessToken: order._customerAccessToken,
      order,
    };
  }

  const { Order } = await import("@models/order");
  const doc = typeof order?.save === "function" ? order : await Order.findById(order?._id);
  if (!doc) {
    throw new Error("order_not_found");
  }
  if (!isPlatformBooking(doc)) {
    return { publicReference: "", accessToken: "", order: doc.toObject?.() || doc };
  }
  const publicReference = await assignPublicBookingReference(doc);
  const current = doc.customerBookingAccess;
  const issued =
    current?.tokenHash && !current?.revokedAt
      ? rotateCustomerBookingAccess(current, { returnAt: doc.returnAtUtc })
      : createCustomerBookingAccess({ returnAt: doc.returnAtUtc });
  if (typeof doc.set === "function") {
    doc.set("customerBookingAccess", issued.access, { strict: false });
  } else {
    doc.customerBookingAccess = issued.access;
  }
  if (typeof doc.save === "function") await doc.save();
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    publicReference,
    accessToken: issued.token,
    order: { ...plain, publicReference, customerBookingAccess: issued.access },
  };
}

function buildFacts(order, company, { publicReference, accessToken }) {
  const snap = resolveBookingFinancialSnapshot(order);
  const currency = snap.currency || "EUR";
  const pickupDate = order?.localPickup?.date || ymdFromUtc(order?.pickupAtUtc || order?.timeIn);
  const returnDate = order?.localReturn?.date || ymdFromUtc(order?.returnAtUtc || order?.timeOut);
  const locale = order?.clientLang || order?.locale || "en";
  const stripeRef =
    String(order?.payment?.paymentIntentId || "").trim() ||
    String(order?.payment?.providerPaymentId || "").trim();
  return {
    snap,
    vehicleName: vehicleName(order),
    shortDateRange: shortDateRange(pickupDate, returnDate) || "dates confirmed",
    pickupWhen: whenLabel(order?.localPickup, order?.pickupAtUtc || order?.timeIn),
    returnWhen: whenLabel(order?.localReturn, order?.returnAtUtc || order?.timeOut),
    pickupLocation: locationLabel(order, "pickup"),
    returnLocation: locationLabel(order, "return"),
    total: formatSnapshotMoney(snap.grossMinor, currency),
    bookingFee: formatSnapshotMoney(snap.bookingFeeMinor, currency),
    supplierBalance: formatSnapshotMoney(snap.supplierBalanceMinor, currency),
    supplierName: company?.name || "",
    supplierPhone: supplierPhone(company),
    supplierEmail: company?.email || "",
    collectionInstructions: collectionInstructions(order),
    publicReference,
    customerName: order?.customerName || "",
    customerPhone: order?.phone || "",
    customerEmail: order?.email || "",
    orderId: String(order?._id || ""),
    companyName: company?.name || "",
    feePercent: snap.feePercent,
    stripeRef,
    status: order?.bookingStatus || order?.payment?.status || "",
    detailsUrl: customerBookingDetailsUrl({
      locale,
      publicReference,
      accessToken,
    }),
    when: [
      whenLabel(order?.localPickup, order?.pickupAtUtc || order?.timeIn),
      whenLabel(order?.localReturn, order?.returnAtUtc || order?.timeOut),
    ].join(" – "),
  };
}

async function deliver({ to, guard, content, type, renderKey, order, companyId, payload }) {
  if (!guard.ok) {
    // An optional audience (superadmin observability) must never hold up the
    // customer flow: report it as skipped, not as a failed delivery.
    return {
      ok: guard.optional === true,
      skipped: guard.optional === true,
      code: guard.code,
      template: content?.template,
    };
  }
  try {
    await sendEmailDirect({
      title: content.subject,
      message: content.text,
      html: content.html,
      to: guard.to,
      meta: {
        type,
        renderKey,
        orderId: order?._id,
        companyId: companyId || undefined,
        payload,
      },
    });
    return { ok: true, template: content.template, to: guard.to };
  } catch (err) {
    console.error(`[paid booking email] ${renderKey} failed`, err?.message || err);
    return { ok: false, error: err?.message || String(err), template: content.template };
  }
}

export async function sendPaidBookingEmails({ order } = {}) {
  if (!order || !isPlatformBooking(order)) {
    return {
      ok: true,
      skipped: true,
      code: "not_platform_booking",
      customer: { ok: true, skipped: true },
      supplier: { ok: true, skipped: true },
      superadmin: { ok: true, skipped: true },
      settled: true,
    };
  }

  await connectToDB();
  const orderId = order._id;
  const customerSent =
    (await alreadySent(MAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED, orderId)) ||
    (await alreadySent(MAIL_TYPE.ORDER_PAID_CUSTOMER, orderId));
  const supplierSent = await alreadySent(MAIL_TYPE.SUPPLIER_BOOKING_PAID, orderId);
  const superadminSent = await alreadySent(
    MAIL_TYPE.SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
    orderId
  );

  if (customerSent && supplierSent && superadminSent) {
    const deduped = { ok: true, deduped: true };
    return {
      ok: true,
      deduped: true,
      customer: deduped,
      supplier: deduped,
      superadmin: deduped,
      partner: deduped,
      settled: true,
    };
  }

  let secrets = {
    publicReference: order.publicReference,
    accessToken: order._customerAccessToken || "",
    order,
  };
  if (!customerSent) {
    try {
      secrets = await ensureDeliverySecrets(order);
    } catch (err) {
      console.error("[paid booking email] access prepare failed", err?.message || err);
      return {
        ok: false,
        customer: { ok: false, error: err?.message || String(err) },
        supplier: { ok: false, skipped: true },
        superadmin: { ok: false, skipped: true },
        partner: { ok: false, skipped: true },
        settled: false,
      };
    }
  }

  const working = secrets.order || order;
  const company = working.ownerId
    ? await Company.findById(working.ownerId)
        .select("name email email2 meetingContactPhone meetingContacts emailPreferences langAdmin")
        .lean()
    : null;
  const facts = buildFacts(working, company, secrets);

  const results = {
    customer: customerSent ? { ok: true, deduped: true } : null,
    supplier: supplierSent ? { ok: true, deduped: true } : null,
    superadmin: superadminSent ? { ok: true, deduped: true } : null,
  };

  if (!customerSent) {
    const content = renderCustomerBookingConfirmedEmail(facts);
    const policy = resolveBookingEmail({
      event: BOOKING_EMAIL_EVENT.CUSTOMER_BOOKING_CONFIRMED,
      audience: BOOKING_EMAIL_AUDIENCE.CUSTOMER,
      order: working,
      context: { verifiedPayment: true },
    });
    const safe = assertCustomerEmailSafe({
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    const guard = !policy.allowed
      ? { ok: false, code: policy.code }
      : !safe.ok
        ? { ok: false, code: safe.code }
        : assertCustomerRecipient([facts.customerEmail], facts.customerEmail);
    results.customer = await deliver({
      to: guard.to,
      guard,
      content,
      type: MAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED,
      renderKey: MAIL_RENDER_KEY.CUSTOMER_BOOKING_CONFIRMED,
      order: working,
      companyId: working.ownerId,
      payload: {
        template: CUSTOMER_BOOKING_CONFIRMED,
        publicReference: facts.publicReference,
        locale: working.clientLang || "en",
        notificationKey: policy.notificationKey,
      },
    });
  }

  if (!supplierSent) {
    const { emails } = await resolveCompanyNotificationRecipients(
      String(working.ownerId || ""),
      "booking",
      { fallbackEmails: [company?.email].filter(Boolean) }
    );
    if (!emails.length) {
      results.supplier = { ok: true, skipped: true, reason: "no_recipients" };
    } else {
    const content = renderSupplierBookingPaidEmail(facts);
    const blob = `${content.html}\n${content.text}`;
    const leaksToken = secrets.accessToken && blob.includes(secrets.accessToken);
    const policy = resolveBookingEmail({
      event: BOOKING_EMAIL_EVENT.SUPPLIER_BOOKING_PAID,
      audience: BOOKING_EMAIL_AUDIENCE.SUPPLIER,
      order: working,
      context: { verifiedPayment: true },
    });
    const guard = !policy.allowed
      ? { ok: false, code: policy.code }
      : leaksToken
        ? { ok: false, code: "supplier_token_guard" }
        : assertSupplierRecipients(emails, emails);
    results.supplier = await deliver({
      to: guard.to,
      guard,
      content,
      type: MAIL_TYPE.SUPPLIER_BOOKING_PAID,
      renderKey: MAIL_RENDER_KEY.SUPPLIER_BOOKING_PAID,
      order: working,
      companyId: working.ownerId,
      payload: {
        template: SUPPLIER_BOOKING_PAID,
        publicReference: facts.publicReference,
        notificationKey: policy.notificationKey,
      },
    });
    }
  }

  if (!superadminSent) {
    const superEmails = resolveSuperadminRecipients();
    if (!superEmails.length) {
      results.superadmin = { ok: true, skipped: true, reason: "no_recipients" };
    } else {
    const content = renderSuperadminBookingPaymentReceivedEmail(facts);
    const blob = `${content.html}\n${content.text}`;
    const leaksToken = secrets.accessToken && blob.includes(secrets.accessToken);
    const visibleUrl = />https?:\/\//.test(content.html);
    const policy = resolveBookingEmail({
      event: BOOKING_EMAIL_EVENT.SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
      audience: BOOKING_EMAIL_AUDIENCE.SUPERADMIN,
      order: working,
      context: {
        verifiedPayment: true,
        superadminEmailEnabled:
          String(process.env.ROVARO_SUPERADMIN_PAYMENT_EMAIL || "") !== "off",
      },
    });
    const guard = !policy.allowed
      ? { ok: false, code: policy.code, optional: true }
      : leaksToken || visibleUrl
        ? { ok: false, code: "superadmin_template_guard" }
        : assertSuperadminRecipients(superEmails, superEmails);
    results.superadmin = await deliver({
      to: guard.to,
      guard,
      content,
      type: MAIL_TYPE.SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
      renderKey: MAIL_RENDER_KEY.SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
      order: working,
      companyId: working.ownerId,
      payload: {
        template: SUPERADMIN_BOOKING_PAYMENT_RECEIVED,
        publicReference: facts.publicReference,
        notificationKey: policy.notificationKey,
      },
    });
    }
  }

  results.partner = results.supplier;
  results.settled = paidEmailsSettled(results);
  results.ok = results.settled;
  return results;
}

export function paidBookingEmailsSettled(result) {
  return Boolean(result?.settled);
}
