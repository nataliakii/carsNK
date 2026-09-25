async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    return { ok: false, message: payload.message || "Request failed" };
  }
  return { ok: true, body: payload };
}

export function askRovaroAboutBooking(orderId, question) {
  return postJson(`/api/admin/orders/${orderId}/ask-rovaro`, { question });
}

export async function loadAlternativeCars(orderId) {
  const res = await fetch(
    `/api/admin/legal/alternative-offers?orderId=${encodeURIComponent(orderId)}`
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    return { ok: false, message: payload.message || "Could not load vehicles", cars: [] };
  }
  return { ok: true, cars: payload.eligibleCars || [] };
}

export function suggestAlternativeVehicle(orderId, proposedCarId, reasonForReplacement) {
  return postJson("/api/admin/legal/alternative-offers", {
    orderId,
    replacementSource: "COMPANY_VEHICLE",
    proposedCarId,
    reasonForReplacement,
  });
}

export function offerEquivalentReplacement(orderId, proposal) {
  return postJson("/api/admin/legal/alternative-offers", {
    orderId,
    ...proposal,
  });
}
