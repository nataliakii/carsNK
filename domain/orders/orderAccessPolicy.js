/**
 * orderAccessPolicy.js
 *
 * ════════════════════════════════════════════════════════════════
 * ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ ДЛЯ ВСЕХ ДОСТУПОВ К ЗАКАЗАМ
 * ════════════════════════════════════════════════════════════════
 *
 * ❗ Без React. Без UI. Только бизнес-правила.
 * ❗ ВСЕ изменения доступов делаются ТОЛЬКО здесь.
 * ❗ UI и backend — тупые потребители.
 *
 * ROLES:
 * - SUPERADMIN: полный доступ ко всему
 * - ADMIN: ограниченный доступ согласно правилам ниже
 *
 * ORDER TYPES:
 * - Client order (my_order === true): заказ от клиента
 * - Internal order (my_order === false): внутренний заказ админа
 *
 * TIME BUCKETS (only policy computes these):
 * - PAST: rentalEndDate < today → только просмотр
 * - CURRENT: start < today && end >= today
 * - FUTURE: start >= today
 */

import { ROLE } from "@models/user";
import { isOrderPaidAndClosed } from "@/domain/orders/orderStatus";

// ════════════════════════════════════════════════════════════════
// TYPES (JSDoc for JS, but structured like TS)
// ════════════════════════════════════════════════════════════════

/**
 * @typedef {"ADMIN" | "SUPERADMIN"} PolicyRole
 */

/**
 * @typedef {"PAST" | "CURRENT" | "FUTURE"} TimeBucket
 */

/**
 * @typedef {Object} OrderContext
 * @property {PolicyRole} role - User role
 * @property {boolean} isClientOrder - my_order === true
 * @property {boolean} confirmed - Order confirmed by superadmin
 * @property {boolean} isPast - rentalEndDate < today (Athens TZ)
 * @property {boolean} isClosed - Order status is PAID_AND_CLOSED
 * @property {TimeBucket} timeBucket - Required; use getTimeBucket from @/domain/time/athensTime
 */

/**
 * @typedef {Object} OrderAccess
 * @property {boolean} canView - Can open/view the order
 * @property {boolean} canEdit - Can edit any field (do NOT use for individual fields; use specific flags)
 * @property {boolean} canDelete - Can delete the order
 * @property {boolean} canEditPickupDate - Can edit start (rentalStartDate, timeIn); do NOT use canEditDates
 * @property {boolean} canEditReturnDate - Can edit end date only (rentalEndDate, numberOfDays); timeOut/placeOut = canEditReturn
 * @property {boolean} canEditPickupPlace - Can edit placeIn (pickup location); NEVER derived from canEdit
 * @property {boolean} canEditReturn - Can edit return place and time (placeOut, timeOut)
 * @property {boolean} canEditInsurance - Can edit insurance type
 * @property {boolean} canEditFranchise - Can edit franchiseOrder; client orders NEVER
 * @property {boolean} canEditPricing - Can edit price fields
 * @property {boolean} canEditTotalPrice - Can manually edit totalPrice / OverridePrice
 * @property {boolean} canResetToAutoPrice - Can reset manual price back to automatic pricing
 * @property {boolean} canConfirm - Can confirm/unconfirm order
 * @property {boolean} canSeeClientPII - Can see client contact info
 * @property {boolean} canEditClientPII - Can edit client contact data (SUPERADMIN only; ADMIN never)
 * @property {boolean} notifySuperadminOnEdit - Should notify superadmin on edit
 * @property {boolean} isViewOnly - Convenience flag: !canEdit
 * @property {boolean} isPast - Order is past (rentalEndDate < today); only policy computes this
 * @property {{ clientPII?: string }} reasons - Human-readable restriction reasons
 */

function withDerivedOrderActionAccess(access, ctx) {
  const appliesConfirmedPricingRule =
    ctx?.timeBucket === "CURRENT" || ctx?.timeBucket === "FUTURE";
  const canUseConfirmedPricingActions = appliesConfirmedPricingRule
    ? access.canEdit && ctx?.confirmed !== true
    : access.canEditPricing;

  return {
    ...access,
    // Separate totalPrice permission from generic pricing so policy can
    // unlock manual total price editing without widening other pricing fields.
    canEditTotalPrice: canUseConfirmedPricingActions,
    canResetToAutoPrice: canUseConfirmedPricingActions,
  };
}

// ════════════════════════════════════════════════════════════════
// POLICY IMPLEMENTATION
// ════════════════════════════════════════════════════════════════

/**
 * Единая функция определения доступов к заказу.
 *
 * ЧИТАЕТСЯ КАК БИЗНЕС-ДОКУМЕНТАЦИЯ.
 *
 * @param {OrderContext} ctx - Order context
 * @returns {OrderAccess} - Access permissions
 */
export function getOrderAccess(ctx) {
  const { role, isClientOrder, confirmed, isPast, isClosed, timeBucket } = ctx;
  // WHY: timeBucket MUST be required. Fallback to FUTURE would misclassify CURRENT internal orders
  // as FUTURE and wrongly allow insurance/pricing edits; fail fast so callers always pass getTimeBucket(order).
  if (timeBucket === undefined || timeBucket === null) {
    throw new Error(
      "orderAccessPolicy: timeBucket is required (use getTimeBucket from @/domain/time/athensTime)"
    );
  }
  const bucket = timeBucket;

  // ════════════════════════════════════════════════════════════════
  // 🟣 SUPERADMIN — полный доступ ко всему
  // ════════════════════════════════════════════════════════════════
  const REASON_CLIENT_PII =
    "Client contact data can only be edited by Superadmin";

  // Terminal status: PAID_AND_CLOSED locks order edits for all roles.
  // Superadmin can still delete closed orders as an operational override.
  if (isClosed) {
    const isSuper = role === "SUPERADMIN";
    return withDerivedOrderActionAccess(
      {
        canView: true,
        canEdit: false,
        canDelete: isSuper,
        canEditPickupDate: false,
        canEditReturnDate: false,
        canEditPickupPlace: false,
        canEditReturn: false,
        canEditInsurance: false,
        canEditFranchise: false,
        canEditPricing: false,
        canConfirm: false,
        canSeeClientPII: true,
        canEditClientPII: false,
        notifySuperadminOnEdit: false,
        isViewOnly: true,
        isPast,
        reasons: { clientPII: REASON_CLIENT_PII },
      },
      ctx
    );
  }

  if (role === "SUPERADMIN") {
    return withDerivedOrderActionAccess(
      {
        canView: true,
        canEdit: true,
        canDelete: true,
        canEditPickupDate: true,
        canEditReturnDate: true,
        canEditPickupPlace: true,
        canEditReturn: true,
        canEditInsurance: true,
        canEditFranchise: true,
        canEditPricing: true,
        canConfirm: true,
        canSeeClientPII: true,
        canEditClientPII: true,
        notifySuperadminOnEdit: false, // superadmin doesn't notify themselves
        isViewOnly: false,
        isPast,
        reasons: { clientPII: REASON_CLIENT_PII },
      },
      ctx
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 🟡 ADMIN — ограниченные права
  // ════════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────────
  // ⛔ PAST ORDERS — только просмотр (для любого типа заказа)
  // ────────────────────────────────────────────────────────────────
  if (isPast) {
    return withDerivedOrderActionAccess(
      {
        canView: true,
        canEdit: false,
        canDelete: false,
        canEditPickupDate: false,
        canEditReturnDate: false,
        canEditPickupPlace: false,
        canEditReturn: false,
        canEditInsurance: false,
        canEditFranchise: false,
        canEditPricing: false,
        canConfirm: false,
        canSeeClientPII: !isClientOrder || confirmed,
        canEditClientPII: false,
        notifySuperadminOnEdit: false,
        isViewOnly: true,
        isPast: true,
        reasons: { clientPII: REASON_CLIENT_PII },
      },
      ctx
    );
  }

  // ────────────────────────────────────────────────────────────────
  // 🔴 CLIENT ORDERS (my_order === true)
  // ────────────────────────────────────────────────────────────────
  if (isClientOrder) {
    if (!confirmed) {
      // UNCONFIRMED client order — admin can delete (spam/erroneous orders)
      return withDerivedOrderActionAccess(
        {
          canView: true,
          canEdit: false,
          canDelete: false,
          canEditPickupDate: false,
          canEditReturnDate: true,
          canEditPickupPlace: false,
          canEditReturn: true,
          canEditInsurance: false,
          canEditFranchise: false,
          canEditPricing: false,
          canConfirm: false,
          canSeeClientPII: false,
          canEditClientPII: false,
          notifySuperadminOnEdit: true,
          isViewOnly: true,
          isPast: false,
          reasons: { clientPII: REASON_CLIENT_PII },
        },
        ctx
      );
    }

    // CONFIRMED client order — only return place/time editable. WHY: placeIn, insurance, franchise
    // are explicit flags so UI never infers from canEdit; client orders NEVER allow franchise/insurance.
    return withDerivedOrderActionAccess(
      {
        canView: true,
        canEdit: true,
        canDelete: false,
        canEditPickupDate: false,
        canEditReturnDate: true,
        canEditPickupPlace: false, // placeIn NEVER for client (do not derive from canEdit)
        canEditReturn: true,
        canEditInsurance: false, // client: never insurance
        canEditFranchise: false, // client: never franchise (do not tie to canEditInsurance)
        canEditPricing: false,
        canConfirm: false,
        canSeeClientPII: true,
        canEditClientPII: false,
        notifySuperadminOnEdit: true,
        isViewOnly: false,
        isPast: false,
        reasons: { clientPII: REASON_CLIENT_PII },
      },
      ctx
    );
  }

  // ────────────────────────────────────────────────────────────────
  // 🟢 INTERNAL ORDERS (my_order === false) — past / current / future
  // Insurance: ❌ NEVER for client; ❌ for internal if CURRENT; ✅ only internal + FUTURE
  // ────────────────────────────────────────────────────────────────
  if (bucket === "CURRENT") {
    // 🟡 INTERNAL CURRENT: block ONLY start (rentalStartDate, timeIn, placeIn); allow end + return.
    return withDerivedOrderActionAccess(
      {
        canView: true,
        canEdit: true,
        canDelete: false,
        canEditPickupDate: false, // ❌ start: rentalStartDate, timeIn
        canEditReturnDate: true, // ✅ end date only: rentalEndDate, numberOfDays
        canEditPickupPlace: false, // ❌ placeIn
        canEditReturn: true, // ✅ return place + time: placeOut, timeOut
        canEditInsurance: false,
        canEditFranchise: false,
        canEditPricing: true,
        canConfirm: true,
        canSeeClientPII: true,
        canEditClientPII: true,
        notifySuperadminOnEdit: true,
        isViewOnly: false,
        isPast: false,
        reasons: { clientPII: REASON_CLIENT_PII },
      },
      ctx
    );
  }

  // INTERNAL FUTURE: можно всё; admin can confirm/unconfirm internal orders
  return withDerivedOrderActionAccess(
    {
      canView: true,
      canEdit: true,
      canDelete: true,
      canEditPickupDate: true,
      canEditReturnDate: true,
      canEditPickupPlace: true,
      canEditReturn: true,
      canEditInsurance: true,
      canEditFranchise: true,
      canEditPricing: true,
      canConfirm: true, // admin can unconfirm internal FUTURE
      canSeeClientPII: true,
      canEditClientPII: true, // ADMIN never edits client PII
      notifySuperadminOnEdit: false,
      isViewOnly: false,
      isPast: false,
      reasons: { clientPII: REASON_CLIENT_PII },
    },
    ctx
  );
}

// ════════════════════════════════════════════════════════════════
// HELPER: Create context from order and user
// ════════════════════════════════════════════════════════════════

/**
 * Создаёт OrderContext из order и user объектов.
 * timeBucket ОБЯЗАТЕЛЕН — иначе getOrderAccess выбросит. Вычисляйте через getTimeBucket(order) из @/domain/time/athensTime.
 *
 * @param {Object} order - Order object
 * @param {Object} user - User object from session
 * @param {Function} isPastFn - Function to check if order is past
 * @param {TimeBucket} timeBucket - PAST | CURRENT | FUTURE (required; use getTimeBucket from athensTime)
 * @returns {OrderContext}
 */
export function createOrderContext(order, user, isPastFn, timeBucket) {
  if (!order || !user) {
    return {
      role: "ADMIN",
      isClientOrder: false,
      confirmed: false,
      isPast: false,
      isClosed: false,
      timeBucket: "FUTURE",
    };
  }

  if (timeBucket === undefined || timeBucket === null) {
    throw new Error(
      "orderAccessPolicy: timeBucket is required (use getTimeBucket from @/domain/time/athensTime)"
    );
  }

  const isSuperAdmin = user.role === ROLE.SUPERADMIN;
  const isPast = isPastFn ? isPastFn(order) : false;

  return {
    role: isSuperAdmin ? "SUPERADMIN" : "ADMIN",
    isClientOrder: order.my_order === true,
    confirmed: order.confirmed === true,
    isPast,
    isClosed: isOrderPaidAndClosed(order.status),
    timeBucket,
  };
}

// ════════════════════════════════════════════════════════════════
// FIELD-LEVEL: single source for "which fields are disabled"
// ════════════════════════════════════════════════════════════════

/**
 * Returns field names that must not be edited given current access.
 * Used by domain/orders index canEditOrderField shim and UI getDisabledFields.
 *
 * @param {OrderAccess} access
 * @returns {string[]}
 */
export function getDisabledFields(access) {
  if (!access) return [];

  const disabled = [];
  if (!access.canEditPickupDate) {
    disabled.push("rentalStartDate", "timeIn");
  }
  if (!access.canEditReturnDate) {
    disabled.push("rentalEndDate", "numberOfDays");
  }
  if (!access.canEditPickupPlace) {
    disabled.push("placeIn", "placeInDetail", "flightNumber");
  }
  if (!access.canEditReturn) {
    disabled.push("placeOut", "placeOutDetail", "timeOut");
  }
  if (!access.canEditInsurance) {
    disabled.push("insurance");
  }
  if (!access.canEditFranchise) {
    disabled.push("franchiseOrder");
  }
  if (!access.canEditTotalPrice) {
    disabled.push("totalPrice", "OverridePrice");
  }
  if (!access.canConfirm) {
    disabled.push("confirmed");
  }
  if (!access.canEdit) {
    disabled.push("secondDriver");
  }
  if (!access.canSeeClientPII || !access.canEditClientPII) {
    disabled.push(
      "customerName",
      "phone",
      "email",
      "Viber",
      "Whatsapp",
      "Telegram"
    );
  }
  return disabled;
}

// ════════════════════════════════════════════════════════════════
// EXPORTS for backward compatibility
// ════════════════════════════════════════════════════════════════

export { ROLE };
