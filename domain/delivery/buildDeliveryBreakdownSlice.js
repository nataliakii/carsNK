import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { calculateDeliveryPrice } from "./calculateDeliveryPrice";
import { deliverySliceFromStoredSnapshot } from "@/domain/orders/priceBreakdownReconciliation";

/**
 * Delivery slice for PriceBreakdown: either admin overrides (both set) or zones from placeIn/placeOut.
 *
 * @param {{ placeIn?: string, placeOut?: string, deliveryInOverride?: number|null, deliveryOutOverride?: number|null }} orderLike
 */
export async function buildDeliveryBreakdownSlice(orderLike) {
  const placeIn = orderLike.placeIn || "";
  const placeOut = orderLike.placeOut || "";
  const oIn = orderLike.deliveryInOverride;
  const oOut = orderLike.deliveryOutOverride;

  if (oIn != null && oOut != null && !Number.isNaN(Number(oIn)) && !Number.isNaN(Number(oOut))) {
    const company = await Company.findById(COMPANY_ID).lean();
    const deliveryIn = Math.max(0, Number(oIn));
    const deliveryOut = Math.max(0, Number(oOut));
    return {
      deliveryIn,
      deliveryOut,
      deliveryTotal: deliveryIn + deliveryOut,
      deliveryPricePerKm: company?.deliveryPricePerKm ?? 0,
      placeIn,
      placeOut,
    };
  }

  const stored = deliverySliceFromStoredSnapshot(orderLike);
  if (stored) {
    return {
      ...stored,
      placeIn,
      placeOut,
    };
  }

  return calculateDeliveryPrice({ placeIn, placeOut });
}
