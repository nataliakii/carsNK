/**
 * 📦 app/admin/features/orders
 *
 * Feature: Управление заказами.
 * Entry point для всей функциональности заказов в админке.
 */

// Sections
export { default as OrdersTableSection } from "./OrdersTableSection";

// Modals
export { default as EditOrderModal } from "./modals/EditOrderModal";
export { default as AddOrderModal } from "./modals/AddOrderModal";

// Components
export { default as DataGridOrders } from "./DataGridOrders";

// Hooks
export { default as useOrders } from "./useOrders";
