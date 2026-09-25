/**
 * Calendar/table colour tokens (theme palette only).
 *
 * Domain truth is `source` + `status`, not this file:
 * `domain/admin/ROVARO_CONTRACTOR_ADMIN.md`
 * `domain/admin/rovaroContractorAdmin.js` (`CALENDAR_TONE`).
 *
 * Map `resolveContractorCalendarTone(order)` through theme.palette.
 * Do not branch business rules on CSS.
 *
 * Tone colours live in palette.contractorBooking and CONTRACTOR_TONE_COLORS.
 *
 * Legacy flags: offline, confirmed, my_order, status PAID_AND_CLOSED.
 */

import { alpha } from "@mui/material/styles";
import { palette } from "@/theme";
import { CALENDAR_TONE } from "@/domain/admin/rovaroContractorAdmin";

const booking = palette.contractorBooking;

function swatch(key, main, label, labelEn, extra = {}) {
  return {
    key,
    main,
    light: extra.light || main,
    dark: extra.dark || main,
    text: extra.text || palette.neutral.gray900,
    bg: alpha(main, 0.16),
    label,
    labelEn,
    ...extra,
  };
}

/** Tone → theme palette. Business rules stay in resolveContractorCalendarTone. */
export const CONTRACTOR_TONE_COLORS = {
  [CALENDAR_TONE.NEW_REQUEST]: swatch(
    CALENDAR_TONE.NEW_REQUEST,
    booking.newRequest,
    "Новая заявка",
    "New request",
    { text: palette.neutral.black }
  ),
  [CALENDAR_TONE.AWAITING_PAYMENT]: swatch(
    CALENDAR_TONE.AWAITING_PAYMENT,
    booking.awaitingPayment,
    "Ожидается оплата",
    "Awaiting payment",
    { text: palette.neutral.gray900 }
  ),
  [CALENDAR_TONE.CONFIRMED_PAID]: swatch(
    CALENDAR_TONE.CONFIRMED_PAID,
    booking.confirmedPaid,
    "Подтверждено",
    "Confirmed",
    { text: palette.neutral.white }
  ),
  [CALENDAR_TONE.COMPLETED]: swatch(
    CALENDAR_TONE.COMPLETED,
    booking.confirmedPaid,
    "Завершено",
    "Completed",
    { text: palette.neutral.white }
  ),
  [CALENDAR_TONE.INTERNAL]: swatch(
    CALENDAR_TONE.INTERNAL,
    booking.internal,
    "Внутренняя запись",
    "Internal booking",
    { text: palette.neutral.white }
  ),
  [CALENDAR_TONE.DECLINED]: swatch(
    CALENDAR_TONE.DECLINED,
    booking.muted,
    "Отказ",
    "Declined",
    { text: palette.neutral.gray800 }
  ),
  [CALENDAR_TONE.PAYMENT_EXPIRED]: swatch(
    CALENDAR_TONE.PAYMENT_EXPIRED,
    palette.neutral.gray300,
    "Оплата просрочена",
    "Payment expired",
    { text: palette.neutral.gray800 }
  ),
  [CALENDAR_TONE.CANCELLED]: swatch(
    CALENDAR_TONE.CANCELLED,
    booking.muted,
    "Отменён",
    "Cancelled",
    { text: palette.neutral.gray800 }
  ),
  [CALENDAR_TONE.UNRESOLVED]: swatch(
    CALENDAR_TONE.UNRESOLVED,
    palette.neutral.gray500,
    "Нужна проверка",
    "Needs review",
    { text: palette.neutral.white }
  ),
};

export function getContractorLegendSwatches() {
  return [
    CONTRACTOR_TONE_COLORS[CALENDAR_TONE.NEW_REQUEST],
    CONTRACTOR_TONE_COLORS[CALENDAR_TONE.AWAITING_PAYMENT],
    CONTRACTOR_TONE_COLORS[CALENDAR_TONE.CONFIRMED_PAID],
    CONTRACTOR_TONE_COLORS[CALENDAR_TONE.INTERNAL],
  ];
}

/**
 * ORDER_COLORS - строгая структура с обязательными полями
 * Каждый объект содержит: key, main, light, dark, text, bg, label, labelEn
 */
export const ORDER_COLORS = {
  // Терминальный статус заказа: оплачен и закрыт - ФИОЛЕТОВЫЙ
  PAID_AND_CLOSED: {
    key: "PAID_AND_CLOSED",
    main: "#7E57C2",
    light: "#9575CD",
    dark: "#673AB7",
    text: "#7E57C2",
    bg: alpha("#7E57C2", 0.16),
    label: "Оплачен и закрыт",
    labelEn: "Paid and closed",
  },

  // Подтверждённый клиентский заказ (confirmed + my_order=true) - CYAN brand
  CONFIRMED_CLIENT: {
    key: "CONFIRMED_CLIENT",
    main: palette.primary.main,
    light: palette.primary.light,
    dark: palette.primary.dark,
    text: palette.primary.dark,
    bg: alpha(palette.primary.main, 0.14),
    label: "Подтверждён (клиент)",
    labelEn: "Confirmed (client)",
  },

  // Ожидающий клиентский заказ (pending + my_order=true) - ЖЕЛТЫЙ
  PENDING_CLIENT: {
    key: "PENDING_CLIENT",
    main: palette.triadic.yellow,      // "rgb(247, 220, 112)" - желтый
    light: palette.triadic.yellowLight, // "rgb(249, 237, 121)"
    dark: palette.triadic.yellow,       // желтый
    text: palette.neutral.black,       // желтый
    bg: palette.triadic.yellow,   // желтый с прозрачностью
    label: "Ожидает (клиент)",
    labelEn: "Pending (client)",
  },

  // Подтверждённый админский заказ (confirmed + my_order=false) - ЗЕЛЕНЫЙ
  CONFIRMED_ADMIN: {
    key: "CONFIRMED_ADMIN",
    main: palette.triadic.green,        // "#008900" - зеленый
    light: palette.triadic.greenLight,  // "#33a033"
    dark: palette.triadic.greenDark,    // "#005c00"
    text: palette.triadic.green,        // "#008900"
    bg: alpha(palette.triadic.green, 0.12),
    label: "Подтверждён (админ)",
    labelEn: "Confirmed (admin)",
  },

  // Ожидающий админский заказ (pending + my_order=false) - ОЛИВКОВЫЙ
  PENDING_ADMIN: {
    key: "PENDING_ADMIN",
    // main: palette.triadic.olive,        // "#898900" - оливковый (до исправления)
    main: palette.neutral.gray500,        // "#9e9e9e" - серый для pending admin в BigCalendar
    // light: palette.triadic.oliveLight,  // "#a0a033"
    light: palette.neutral.gray400,       // "#bdbdbd"
    // dark: palette.triadic.oliveDark,    // "#5c5c00"
    dark: palette.neutral.gray700,        // "#616161"
    // text: palette.neutral.gray100,      // "#898900"
    text: palette.neutral.gray700,        // "#616161"
    // bg: alpha(palette.triadic.olive, 0.8),
    bg: alpha(palette.neutral.gray500, 0.24),
    label: "Ожидает (админ)",
    labelEn: "Pending (admin)",
  },

  // Офлайн-бронь (вне сайта) — slate + hatch in calendar
  OFFLINE: {
    key: "OFFLINE",
    main: "#5C6BC0",
    light: "#7986CB",
    dark: "#3949AB",
    text: "#283593",
    bg: alpha("#5C6BC0", 0.2),
    label: "Офлайн (не через сайт)",
    labelEn: "Offline (off-site)",
    hatch: true,
  },

  // Claimed transfer overlaid on a rental-fleet car
  TRANSFER: {
    key: "TRANSFER",
    main: "#E91E8C",
    light: "#F062AB",
    dark: "#C2185B",
    text: "#AD1457",
    bg: alpha("#E91E8C", 0.18),
    label: "Трансфер",
    labelEn: "Transfer",
  },
};

/** CSS repeating gradient for offline calendar cells */
export function getOfflineHatchBackground(baseColor = ORDER_COLORS.OFFLINE.main) {
  return `repeating-linear-gradient(
    -45deg,
    ${baseColor},
    ${baseColor} 6px,
    rgba(255,255,255,0.28) 6px,
    rgba(255,255,255,0.28) 10px
  )`;
}

/**
 * MOVE_MODE_COLORS - цвета для режима перемещения заказов
 * 
 * ⚠️ ЗАФИКСИРОВАНО: Эти цвета НЕ должны изменяться без согласования.
 * Используются для визуального выделения доступных автомобилей при перемещении заказа.
 * 
 * ПРАВИЛА ИСПОЛЬЗОВАНИЯ:
 * - ВСЕГДА используйте эти константы, НЕ хардкодите цвета
 * - НЕ используйте theme.palette.warning.main (может быть amber)
 * - НЕ используйте theme.palette.triadic.yellowBright (может быть amber)
 * - YELLOW_OVERLAY: для прозрачных overlay (rgba с alpha 0.8)
 * - YELLOW_SOLID: для сплошного фона ячеек (#ffeb3b)
 * 
 * ГДЕ ИСПОЛЬЗУЕТСЯ:
 * - CalendarRow.js: createYellowOverlay, gradientBackground, backgroundColor
 * - BigCalendar.js: (если нужно в будущем)
 * 
 * ИЗМЕНЕНИЕ ЦВЕТОВ:
 * - ТОЛЬКО здесь в config/orderColors.js
 * - После изменения проверить визуально в CalendarRow
 * - Убедиться, что цвет желтый, а не amber
 */
export const MOVE_MODE_COLORS = {
  // Желтый цвет для выделения доступных ячеек при перемещении
  // Используется для overlay и фона ячеек
  YELLOW_OVERLAY: "rgba(255, 235, 59, 0.8)", // Прозрачный желтый для overlay
  YELLOW_SOLID: "#ffeb3b", // Сплошной желтый для фона ячеек
  // Источник: palette.triadic.yellowBright может быть amber, поэтому используем явный желтый
  
  // Синий цвет для выделения перемещаемого заказа (из палитры темы)
  // Используется для подсветки дат заказа на оригинальном автомобиле
  // BLUE_SELECTED: palette.secondary.main, // "#008989" - прежний цвет
  BLUE_SELECTED: "#007BFF", // ярко-синий для перемещаемого заказа (long press), отличный от confirmed client
};

/**
 * ORDER_UI_COLORS - дополнительные цвета для UI (не используются в getOrderColor)
 */
export const ORDER_UI_COLORS = {
  // Заказ который нельзя подтвердить (конфликт)
  BLOCKED: {
    key: "BLOCKED",
    main: palette.neutral.gray600,
    light: palette.neutral.gray500,
    dark: palette.neutral.gray700,
    text: palette.neutral.gray600,
    bg: alpha(palette.neutral.gray600, 0.12),
    label: "Заблокирован",
    labelEn: "Blocked",
  },

  // Завершённый заказ (в прошлом) - для UI только
  COMPLETED: {
    key: "COMPLETED",
    main: palette.secondary.main,
    light: palette.secondary.light,
    dark: palette.secondary.dark,
    text: palette.secondary.main,
    bg: alpha(palette.secondary.main, 0.12),
    label: "Завершён",
    labelEn: "Completed",
  },
};

/**
 * Получить все цвета для легенды календаря
 * Возвращает 4 состояния в фиксированном порядке
 */
export function getOrderColorsForLegend() {
  return getContractorLegendSwatches();
}

export default ORDER_COLORS;
