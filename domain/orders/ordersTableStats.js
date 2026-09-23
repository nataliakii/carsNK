import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { marketplaceFinancialSplit } from "@/domain/orders/marketplaceFinancialSplit";
import { formatMarketplaceFeePercent } from "@/domain/orders/marketplaceBookingFee";

/**
 * effectivePrice = OverridePrice ?? totalPrice
 * @param {object|null} order
 * @returns {number}
 */
export function getEffectivePrice(order) {
  if (!order) return 0;
  if (order.OverridePrice !== null && order.OverridePrice !== undefined) {
    const n = Number(order.OverridePrice);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(order.totalPrice);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Stored automatic rental total (never the manual override).
 * @param {object|null} order
 * @returns {number}
 */
export function getStoredAutoPrice(order) {
  if (!order) return 0;
  const n = Number(order.totalPrice);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve partner company id for an order (denormalized ownerId or car.ownerId).
 * @param {object} order
 * @param {Array} [cars]
 * @returns {string|null}
 */
export function resolveOrderOwnerId(order, cars = []) {
  if (!order) return null;
  if (order.ownerId) return String(order.ownerId);
  const carId = order.car?._id || order.car;
  if (carId && Array.isArray(cars)) {
    const car = cars.find((c) => String(c._id) === String(carId));
    if (car?.ownerId) return String(car.ownerId);
  }
  if (order.car?.ownerId) return String(order.car.ownerId);
  return null;
}

/**
 * @param {number} sum
 * @param {number} percent
 * @returns {{ sum: number, percent: number, commission: number }}
 */
export function computeCommission(sum, percent) {
  const safeSum = Number.isFinite(Number(sum)) ? Number(sum) : 0;
  const safePercent = Number.isFinite(Number(percent)) ? Number(percent) : 0;
  const grossMinor = Math.round(safeSum * 100);
  const commissionMinor = Math.round((grossMinor * safePercent) / 100);
  return {
    sum: safeSum,
    percent: safePercent,
    commission: commissionMinor / 100,
  };
}

/**
 * Filter orders for the admin table (same rules as UI).
 * @param {object[]} orders
 * @param {object} criteria
 * @param {{ isOrderEndedInPast?: (order: object) => boolean }} [helpers]
 */
export function filterOrdersForTable(orders, criteria = {}, helpers = {}) {
  const list = Array.isArray(orders) ? orders : [];
  const {
    selectedCarId = null,
    ownerId = null,
    statusFilter = "all",
    originFilter = "all",
    dateFrom = "",
    dateTo = "",
    searchQuery = "",
    hidePastOrders = false,
    cars = [],
  } = criteria;

  const isPast =
    typeof helpers.isOrderEndedInPast === "function"
      ? helpers.isOrderEndedInPast
      : () => false;

  return list.filter((order) => {
    if (selectedCarId) {
      const orderCarId = String(order.car?._id || order.car || "");
      if (orderCarId !== String(selectedCarId)) return false;
    }

    if (ownerId) {
      const oid = resolveOrderOwnerId(order, cars);
      if (String(oid || "") !== String(ownerId)) return false;
    }

    if (statusFilter === "confirmed" && !order.confirmed) return false;
    if (statusFilter === "pending" && order.confirmed) return false;

    if (originFilter === "client" && !order.my_order) return false;
    if (originFilter === "admin" && order.my_order) return false;

    if (dateFrom || dateTo) {
      const orderStart = new Date(order.rentalStartDate);
      const orderEnd = new Date(order.rentalEndDate);
      if (Number.isNaN(orderStart.getTime()) || Number.isNaN(orderEnd.getTime())) {
        return false;
      }
      if (dateFrom) {
        const filterStart = new Date(`${dateFrom}T00:00:00`);
        if (orderEnd < filterStart) return false;
      }
      if (dateTo) {
        const filterEnd = new Date(`${dateTo}T23:59:59.999`);
        if (orderStart > filterEnd) return false;
      }
    }

    if (searchQuery && String(searchQuery).trim()) {
      const query = String(searchQuery).toLowerCase().trim();
      const searchFields = [
        order.customerName,
        order.phone,
        order.email,
        order.orderNumber,
        order.carModel,
        order.carNumber,
        order.car?.model,
        order.car?.regNumber,
      ].filter(Boolean);
      const matches = searchFields.some((field) =>
        String(field).toLowerCase().includes(query)
      );
      if (!matches) return false;
    }

    if (hidePastOrders && isPast(order)) return false;

    return true;
  });
}

/**
 * @param {object[]} filteredOrders
 */
export function summarizeFilteredOrders(filteredOrders) {
  const orders = filteredOrders || [];
  let sum = 0;
  let platformMinor = 0;
  let supplierMinor = 0;
  let marketplaceCount = 0;
  for (const order of orders) {
    sum += getEffectivePrice(order);
    if (!isMarketplaceRequestMode(order?.bookingMode)) continue;
    marketplaceCount += 1;
    const split = marketplaceFinancialSplit(order?.authoritativePrice || {});
    platformMinor += Number(split.platformAmountMinor) || 0;
    supplierMinor += Number(split.supplierBalanceMinor) || 0;
  }
  return {
    count: orders.length,
    sum,
    marketplaceCount,
    commission: platformMinor / 100,
    remaining: supplierMinor / 100,
    commissionPercent:
      marketplaceCount === 1
        ? formatMarketplaceFeePercent(
            marketplaceFinancialSplit(orders.find((o) => isMarketplaceRequestMode(o?.bookingMode))?.authoritativePrice || {}).marketplaceBookingFeeBps
          )
        : null,
  };
}
