/**
 * Calendar colour for an order.
 * Tone comes from resolveContractorCalendarTone. This file only maps it
 * onto theme palette tokens.
 */

import { ORDER_COLORS, CONTRACTOR_TONE_COLORS } from "@/config/orderColors";
import { palette } from "@/theme";
import {
  CALENDAR_TONE,
  hasCalendarProblem,
  resolveContractorCalendarTone,
} from "@/domain/admin/rovaroContractorAdmin";

export function getOrderColor(order) {
  if (!order) {
    return CONTRACTOR_TONE_COLORS[CALENDAR_TONE.UNRESOLVED];
  }

  if (order.isTransferOverlay || order._calendarKind === "transfer") {
    return ORDER_COLORS.TRANSFER;
  }

  const tone = resolveContractorCalendarTone(order);
  const base =
    CONTRACTOR_TONE_COLORS[tone] ||
    CONTRACTOR_TONE_COLORS[CALENDAR_TONE.UNRESOLVED];
  if (!hasCalendarProblem(order)) return base;
  return {
    ...base,
    problem: true,
    border: palette.contractorBooking.problem,
  };
}

export function getOrderMainColor(order) {
  return getOrderColor(order).main;
}

export function getOrderLightColor(order) {
  return getOrderColor(order).light;
}

export function getOrderBgColor(order) {
  return getOrderColor(order).bg;
}

export function getOrderType(order) {
  return resolveContractorCalendarTone(order);
}

export default getOrderColor;
