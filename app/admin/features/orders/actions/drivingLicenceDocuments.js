export async function loadSignedDrivingLicence(orderId) {
  if (!orderId) return [];
  const res = await fetch(`/api/admin/orders/${orderId}/driving-licence`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success || !Array.isArray(body.documents)) return [];
  return body.documents
    .map((doc) => doc?.url)
    .filter((url) => typeof url === "string" && url.length > 0);
}
