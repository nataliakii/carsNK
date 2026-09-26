async function postJson(url, requestBody = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    return { ok: false, message: payload.message || "Request failed" };
  }
  return { ok: true, body: payload };
}

export function reportPlatformBookingProblem(orderId, body = {}) {
  return postJson(`/api/admin/orders/${orderId}/report-problem`, body);
}

export function recordRemainingAmountPaid(orderId) {
  return postJson(`/api/admin/orders/${orderId}/remaining-paid`);
}
