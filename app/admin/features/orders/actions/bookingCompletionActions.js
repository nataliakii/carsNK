async function postJson(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    return { ok: false, message: body.message || "Request failed" };
  }
  return { ok: true, body };
}

export function reportPlatformBookingProblem(orderId) {
  return postJson(`/api/admin/orders/${orderId}/report-problem`);
}

export function recordRemainingAmountPaid(orderId) {
  return postJson(`/api/admin/orders/${orderId}/remaining-paid`);
}
