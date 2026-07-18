/**
 * Order colors configuration
 * 
 * 🎯 ЕДИНСТВЕННЫЙ ИСТОЧНИК ПРАВДЫ для цветов заказов
 * 
 * Colors depend ONLY on:
 * - order.confirmed (boolean)
 * - order.my_order (boolean)
 * - order.status (terminal PAID_AND_CLOSED)
 * 
 * my_order = true  → клиентский заказ (CLIENT)
 * my_order = false → админский заказ (ADMIN)
 * 
 * ЦВЕТОВАЯ ЛОГИКА:
 * - Клиентские заказы (my_order=true):
 *   - Confirmed: красный (primary.main)
 *   - Pending: желтый (triadic.yellow)
 * 
 * - Админские заказы (my_order=false):
 *   - Confirmed: зеленый (triadic.green)
 *   - Pending: оливковый (triadic.olive)
 * 
 * ВСЕ ЦВЕТА ИЗ ПАЛИТРЫ theme.js!
 */

import { alpha } from "@mui/material/styles";
import { palette } from "@/theme";

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

  // Подтверждённый клиентский заказ (confirmed + my_order=true) - КРАСНЫЙ
  CONFIRMED_CLIENT: {
    key: "CONFIRMED_CLIENT",
    // main: palette.primary.main,        // "#890000" - красный (до исправления)
    main: palette.secondary.main,        // "#008989" - синий/бирюзовый как в 1-м столбце
    // light: palette.primary.light,       // "#b33333"
    light: palette.secondary.light,      // "#33a0a0"
    // dark: palette.primary.dark,         // "#5c0000"
    dark: palette.secondary.dark,        // "#005c5c"
    // text: palette.primary.main,          // "#890000"
    text: palette.secondary.main,        // "#008989"
    // bg: alpha(palette.primary.main, 0.12),
    bg: alpha(palette.secondary.main, 0.12),
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
};

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
  return [
    ORDER_COLORS.PAID_AND_CLOSED,
    ORDER_COLORS.CONFIRMED_CLIENT,
    ORDER_COLORS.CONFIRMED_ADMIN,
    ORDER_COLORS.PENDING_CLIENT,
    ORDER_COLORS.PENDING_ADMIN,
  ];
}

export default ORDER_COLORS;
