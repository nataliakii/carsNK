/**
 * Current order for the live Orders modal.
 * The URL only supplies the id; this read returns the server state.
 */
export async function loadAdminOrder(orderId) {
  const id = String(orderId || "").trim();
  if (!id) return { ok: false, status: 404, message: "Not found" };
  const res = await fetch(`/api/order/refetch/${encodeURIComponent(id)}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 401) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, message: "Not found" };
  }
  const order = await res.json();
  if (!order?._id) {
    return { ok: false, status: 404, message: "Not found" };
  }
  return { ok: true, status: 200, order };
}
