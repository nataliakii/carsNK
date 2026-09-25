/**
 * 📦 components/ui/
 *
 * Атомарные UI компоненты без бизнес-логики.
 *
 * Структура:
 * - buttons/   → кнопки
 * - inputs/    → поля ввода
 * - feedback/  → снекбары, сообщения
 * - typography/→ типографика
 * - media/     → изображения
 * - modals/    → модальные окна
 * - calendar/  → ⚠️ DEPRECATED: Use @/app/components/calendar-ui
 */

// Buttons
export * from "./buttons";

// Inputs
export * from "./inputs";

// Feedback
export * from "./feedback";

// Typography
export * from "./typography";

// Media
export * from "./media";

// Layout
export { default as CollapsibleSection } from "./CollapsibleSection";
export { default as SummaryField, SummaryList } from "./SummaryField";
export {
  default as FieldGroup,
  FieldGroupStack,
  FieldRow,
} from "./FieldGroup";
export { default as PriceTag } from "./PriceTag";

// Modals
export { ModalLayout, ConfirmModal, OrdersByDateModal, DialogLayout } from "./modals";

// Calendar (DEPRECATED - use @/app/components/calendar-ui)
export { 
  CalendarNavButton, 
  CalendarSelect, 
  CalendarFirstColumn, 
  CalendarDayCell 
} from "./calendar";

// Legacy exports for backward compatibility
export { default as ConfirmButton } from "./buttons/ConfirmButton";
export { default as CancelButton } from "./buttons/CancelButton";
export { default as DeleteButton } from "./buttons/DeleteButton";
export { default as ActionButton } from "./buttons/ActionButton";
