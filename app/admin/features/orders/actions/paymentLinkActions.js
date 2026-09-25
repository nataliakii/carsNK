import { SUPERADMIN_AMOUNT_KEYS } from "@/domain/orders/superadminPaymentLinkPolicy";

function paymentOpsUrl(orderId) {
  return `/api/admin/orders/${encodeURIComponent(String(orderId))}/payment-ops`;
}

async function readJson(res) {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    return {
      ok: false,
      code: payload.code || "",
      message: payload.message || "Request failed",
      body: payload,
    };
  }
  return { ok: true, body: payload };
}

export async function loadPaymentOps(orderId) {
  const res = await fetch(paymentOpsUrl(orderId), { cache: "no-store" });
  return readJson(res);
}

/**
 * Ask the server to put a payment link in front of the customer now.
 *
 * `grossMinor` is sent only when the superadmin actually changed the amount, so
 * an unchanged send records no price revision. The idempotency key is supplied
 * by the caller and must stay stable across repeat presses of the same request.
 */
export async function sendCustomerPaymentLink(
  orderId,
  { grossMinor = null, reason = "", idempotencyKey = "", confirmZeroSupplierBalance = false } = {}
) {
  const res = await fetch(paymentOpsUrl(orderId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send_payment_link",
      idempotencyKey,
      confirmZeroSupplierBalance,
      ...(grossMinor == null
        ? {}
        : {
            [SUPERADMIN_AMOUNT_KEYS.grossMinor]: grossMinor,
            [SUPERADMIN_AMOUNT_KEYS.reason]: reason,
          }),
    }),
  });
  return readJson(res);
}
