/**
 * Orders table deep link. The query identifies the order only.
 */

import {
  contractorOrderModalStage,
} from "@/domain/admin/rovaroContractorAdmin";
import { bookingModalName } from "@/domain/booking/resolveBookingCapabilities";

export function searchWithOrderId(search, orderId) {
  const params = new URLSearchParams(
    typeof search === "string" ? search : search?.toString?.() || ""
  );
  params.delete("token");
  params.delete("action");
  const id = String(orderId || "").trim();
  if (id) params.set("orderId", id);
  else params.delete("orderId");
  return params.toString();
}

export function searchWithoutOrderId(search) {
  const params = new URLSearchParams(
    typeof search === "string" ? search : search?.toString?.() || ""
  );
  params.delete("orderId");
  return params.toString();
}

export function mergeOrderRow(orders, orderId, fresh) {
  const id = String(orderId || "");
  return (Array.isArray(orders) ? orders : []).map((order) =>
    String(order?._id) === id ? { ...order, ...fresh, _id: order._id } : order
  );
}

/**
 * Modal open plan. Stage comes from the loaded order, never from the URL.
 */
export function resolveOrdersModalTarget({ orderId, order, access }) {
  const id = String(orderId || "").trim();
  if (!id) return { open: false };
  if (!access?.ok || !order) {
    return { open: false, notFound: true, status: access?.status || 404 };
  }
  const stageView = contractorOrderModalStage(order);
  return {
    open: true,
    modal: bookingModalName(order),
    orderId: id,
    stage: stageView.stage,
    supplierActions: stageView.supplierActions === true,
    keepModalOpen: true,
  };
}

/** Completing a supplier action updates the row and asks both badges to refetch. */
export function supplierActionEffects(orders, orderId, freshOrder) {
  return {
    orders: mergeOrderRow(orders, orderId, freshOrder),
    selectedOrder: freshOrder,
    refreshInbox: true,
    keepModalOpen: true,
  };
}
