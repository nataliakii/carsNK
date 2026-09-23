import { computeSnapshotChecksum } from "@/domain/legal/checksum";
import { resolveRentalCheckoutAmount } from "@/domain/orders/companyRentalPaymentPolicy";

function legIdentity(leg) {
  if (!leg || typeof leg !== "object") {
    return { kind: "", officeId: "", placeId: "", feeMinor: 0 };
  }
  return {
    kind: String(leg.kind || "").toLowerCase(),
    officeId: String(leg.officeId || "").trim(),
    placeId: String(leg.placeId || "").trim(),
    feeMinor: Math.round((Number(leg.feeMajor) || 0) * 100),
  };
}

/**
 * Deterministic checksum of money + location identity the partner confirmed.
 * Stored on the order and copied into Stripe metadata so the webhook
 * can refuse a session that no longer matches the quote.
 * Never includes full street addresses.
 */
export function computePriceSnapshotChecksum(order) {
  const amounts = resolveRentalCheckoutAmount(order);
  const auth = order?.authoritativePrice || {};
  const snap = order?.locationSnapshot || {};
  const pickup = legIdentity(snap.pickup);
  const ret = legIdentity(snap.return || snap.dropoff);
  return computeSnapshotChecksum({
    orderId: String(order?._id || ""),
    carId: order?.car != null ? String(order.car) : "",
    currency: amounts.currency,
    grossMinor: amounts.grossMinor,
    prepaymentMinor: amounts.amountMinor,
    balanceMinor: amounts.balanceMinor,
    pickupFeeMinor: Math.round(Number(auth.pickupFeeMinor) || pickup.feeMinor || 0),
    returnFeeMinor: Math.round(Number(auth.returnFeeMinor) || ret.feeMinor || 0),
    pickupKind: pickup.kind,
    pickupOfficeId: pickup.officeId,
    pickupPlaceId: pickup.placeId,
    returnKind: ret.kind,
    returnOfficeId: ret.officeId,
    returnPlaceId: ret.placeId,
  });
}
