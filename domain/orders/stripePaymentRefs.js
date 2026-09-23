import { Order } from "@models/order";

export const STRIPE_SESSION_ARCHIVE = Object.freeze({
  ACTIVE: "active",
  EXPIRED: "expired",
  REPLACED: "replaced",
  COMPLETED: "completed",
  FAILED: "failed",
});

export const REFUND_STATUS = Object.freeze({
  NONE: "none",
  PARTIAL: "partial",
  FULL: "full",
});

function asObject(value) {
  return value && typeof value === "object" ? { ...value } : {};
}

function asArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

export function paymentObject(order) {
  return asObject(order?.payment);
}

export function listSessionHistory(payment) {
  return asArray(payment?.sessionHistory);
}

export function currentStripeSessionId(order) {
  return String(order?.payment?.providerPaymentId || "").trim();
}

export function isCurrentStripeSession(order, sessionId) {
  const current = currentStripeSessionId(order);
  const id = String(sessionId || "").trim();
  return Boolean(current && id && current === id);
}

export function sessionHistoryHas(payment, sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return false;
  return listSessionHistory(payment).some(
    (row) => String(row?.sessionId || "") === id
  );
}

export function archiveStripeSession(payment, { status, at = new Date() } = {}) {
  const next = asObject(payment);
  const sessionId = String(next.providerPaymentId || "").trim();
  const history = listSessionHistory(next);
  if (!sessionId) {
    next.sessionHistory = history;
    return next;
  }
  const entry = {
    sessionId,
    checkoutUrl: next.checkoutUrl || "",
    expiresAt: next.expiresAt || null,
    amountMinor: next.amountMinor ?? null,
    currency: next.currency || "",
    priceChecksum: next.priceChecksum || "",
    status: status || STRIPE_SESSION_ARCHIVE.EXPIRED,
    archivedAt: at,
  };
  const index = history.findIndex((row) => String(row?.sessionId || "") === sessionId);
  if (index >= 0) {
    history[index] = { ...history[index], ...entry };
  } else {
    history.push(entry);
  }
  next.sessionHistory = history;
  return next;
}

/**
 * Record a Stripe session id in history without making it the current session.
 * Used so an invalidated alternative-offer session cannot become authoritative.
 */
export function rememberArchivedStripeSession(
  payment,
  { sessionId, checkoutUrl = "", status, at = new Date() } = {}
) {
  const next = asObject(payment);
  const id = String(sessionId || "").trim();
  const history = listSessionHistory(next);
  if (!id) {
    next.sessionHistory = history;
    return next;
  }
  const entry = {
    sessionId: id,
    checkoutUrl: checkoutUrl || "",
    status: status || STRIPE_SESSION_ARCHIVE.EXPIRED,
    archivedAt: at,
  };
  const index = history.findIndex((row) => String(row?.sessionId || "") === id);
  if (index >= 0) {
    history[index] = { ...history[index], ...entry };
  } else {
    history.push(entry);
  }
  next.sessionHistory = history;
  return next;
}

export function archiveOfferCheckoutSession(offer, { status, at = new Date() } = {}) {
  const sessionId = String(offer?.stripeSessionId || "").trim();
  const history = asArray(offer?.sessionHistory);
  if (!sessionId) {
    return { sessionHistory: history };
  }
  const entry = {
    sessionId,
    checkoutUrl: offer?.checkoutUrl || "",
    status: status || STRIPE_SESSION_ARCHIVE.EXPIRED,
    archivedAt: at,
  };
  const index = history.findIndex((row) => String(row?.sessionId || "") === sessionId);
  if (index >= 0) {
    history[index] = { ...history[index], ...entry };
  } else {
    history.push(entry);
  }
  return { sessionHistory: history, sessionId };
}

export function hasProcessedStripeEvent(payment, eventId) {
  const id = String(eventId || "").trim();
  if (!id) return false;
  return asArray(payment?.processedStripeEvents).some(
    (row) => String(row?.id || row) === id
  );
}

export function rememberStripeEvent(payment, event) {
  const next = asObject(payment);
  const id = String(event?.id || "").trim();
  if (!id || hasProcessedStripeEvent(next, id)) return next;
  const events = asArray(next.processedStripeEvents);
  events.push({
    id,
    type: event?.type || "",
    at: new Date(),
  });
  next.processedStripeEvents = events.slice(-80);
  return next;
}

export function persistStripeRefs(payment, refs = {}) {
  const next = asObject(payment);
  if (refs.sessionId) {
    next.providerPaymentId = next.providerPaymentId || String(refs.sessionId);
  }
  if (refs.paymentIntentId) {
    next.paymentIntentId = String(refs.paymentIntentId);
  }
  if (refs.chargeId) {
    next.chargeId = String(refs.chargeId);
  }
  if (refs.checkoutUrl && !next.checkoutUrl) {
    next.checkoutUrl = String(refs.checkoutUrl);
  }
  return next;
}

function paymentIntentIdOf(object) {
  const raw =
    object?.payment_intent ||
    object?.paymentIntentId ||
    (object?.object === "payment_intent" ? object.id : "");
  if (raw && typeof raw === "object") return String(raw.id || "");
  return String(raw || "").trim();
}

function chargeIdOf(object) {
  if (object?.object === "charge") return String(object.id || "").trim();
  const raw = object?.charge || object?.latest_charge;
  if (raw && typeof raw === "object") return String(raw.id || "");
  return String(raw || "").trim();
}

function sessionIdOf(object) {
  if (object?.object === "checkout.session") return String(object.id || "").trim();
  const id = String(object?.id || object?.checkout_session || "").trim();
  if (id.startsWith("cs_")) return id;
  return String(object?.checkout_session || "").trim();
}

/**
 * Locate an order from trusted server-side Stripe refs already stored on
 * the order. Metadata is a last-resort hint and is never enough on its own
 * for refund / dispute correlation.
 */
export async function findOrderForStripeObject(object) {
  const sessionId = sessionIdOf(object);
  const paymentIntentId = paymentIntentIdOf(object);
  const chargeId = chargeIdOf(object);
  const clauses = [];
  if (sessionId) {
    clauses.push({ "payment.providerPaymentId": sessionId });
    clauses.push({ "payment.sessionHistory.sessionId": sessionId });
  }
  if (paymentIntentId) {
    clauses.push({ "payment.paymentIntentId": paymentIntentId });
  }
  if (chargeId) {
    clauses.push({ "payment.chargeId": chargeId });
  }
  if (clauses.length) {
    const found = await Order.findOne({ $or: clauses });
    if (found) return found;
  }
  return null;
}

export function stripeObjectIds(object) {
  return {
    sessionId: sessionIdOf(object),
    paymentIntentId: paymentIntentIdOf(object),
    chargeId: chargeIdOf(object),
  };
}

export function computeNetPaidMinor(payment) {
  const paid = Math.max(0, Number(payment?.paidAmountMinor || 0));
  const refunded = Math.max(0, Number(payment?.refundedAmountMinor || 0));
  return Math.max(0, paid - refunded);
}

export function classifyRefundStatus(paidMinor, refundedMinor) {
  const paid = Math.max(0, Number(paidMinor) || 0);
  const refunded = Math.max(0, Number(refundedMinor) || 0);
  if (refunded <= 0) return REFUND_STATUS.NONE;
  if (paid > 0 && refunded >= paid) return REFUND_STATUS.FULL;
  return REFUND_STATUS.PARTIAL;
}
