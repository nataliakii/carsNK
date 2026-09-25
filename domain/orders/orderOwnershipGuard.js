/**
 * One ownership question for every order-scoped mutation.
 *
 * `requireAdmin` only proves the caller is signed in as some admin, and
 * `getOrderAccess` only answers "may this role touch this kind of order in this
 * state". Neither compares the caller's company with the order's company, so
 * routes that rely on those two alone will happily write another fleet's
 * booking. This module is that missing comparison, in one place.
 *
 * Deliberately conservative: it refuses only when both companies are known and
 * differ. A record with no owner is a data problem to classify, not a reason to
 * lock its real owner out of a booking they can already see.
 *
 * A superadmin has no effective company of their own and passes through; a
 * superadmin viewing the console as a company is scoped to that company, which
 * is the same rule `getEffectiveOwnerId` applies everywhere else.
 */

import { getEffectiveOwnerId, normalizeOwnerId } from "@/domain/owners/ownerScope";

/** Deliberately identical to a missing order: existence is itself information. */
export const ORDER_NOT_FOUND = Object.freeze({
  status: 404,
  code: "ORDER_NOT_FOUND",
  message: "Order not found",
});

/**
 * @param {object|null} user session.user
 * @param {object|null} order
 * @returns {boolean}
 */
export function orderBelongsToAnotherCompany(user, order) {
  const actor = normalizeOwnerId(getEffectiveOwnerId(user));
  const owner = normalizeOwnerId(order?.ownerId);
  return Boolean(actor) && Boolean(owner) && actor !== owner;
}

/**
 * Guard for a route that has already loaded the order.
 *
 * @returns {null | { status: number, code: string, message: string }}
 */
export function orderOwnershipDenial(user, order) {
  if (!order) return ORDER_NOT_FOUND;
  return orderBelongsToAnotherCompany(user, order) ? ORDER_NOT_FOUND : null;
}

/**
 * Ready-made JSON response, so each route spells the refusal the same way.
 *
 * @returns {Response|null} null when the caller may proceed
 */
export function orderOwnershipResponse(user, order) {
  const denial = orderOwnershipDenial(user, order);
  if (!denial) return null;
  return new Response(
    JSON.stringify({
      success: false,
      code: denial.code,
      message: denial.message,
    }),
    { status: denial.status, headers: { "Content-Type": "application/json" } }
  );
}
