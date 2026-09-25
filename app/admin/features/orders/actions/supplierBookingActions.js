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
  return {
    ok: true,
    cars: payload.eligibleCars || [],
    excludedCars: payload.excludedCars || [],
    eligibilityError: payload.eligibilityError || null,
    paidOrderBlocked: payload.paidOrderBlocked === true,
  };
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
  const supplierMessage =
    String(proposal?.supplierMessage || proposal?.reason || "").trim() ||
    "Equivalent replacement: same or higher class, same transmission, same or lower total price.";
  return postJson("/api/admin/legal/alternative-offers", {
    orderId,
    ...proposal,
    replacementSource: proposal?.replacementSource || "GUARANTEED_CLASS",
    guaranteeAck: proposal?.guaranteeAck !== false,
    supplierMessage,
  });
}
