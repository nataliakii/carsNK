"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Box } from "@mui/material";
import Feed from "@app/components/Feed";

// Shared components from new structure
import { AdminLoader, AdminNotifications, AdminTopBar } from "@app/admin/shared";

// ─────────────────────────────────────────────────────────────
// LAZY-LOADED FEATURE SECTIONS
// Reduces initial bundle size by loading features on demand
// ─────────────────────────────────────────────────────────────

const CarsSection = dynamic(
  () => import("@app/admin/features/cars/CarsSection"),
  { 
    loading: () => <AdminLoader message="Загрузка автомобилей..." />,
    ssr: false 
  }
);

const CalendarSection = dynamic(
  () => import("@app/admin/features/calendar/CalendarSection"),
  { 
    loading: () => <AdminLoader message="Загрузка календаря..." />,
    ssr: false 
  }
);

const OrdersTableSection = dynamic(
  () => import("@app/admin/features/orders/OrdersTableSection"),
  { 
    loading: () => <AdminLoader message="Загрузка таблицы заказов..." />,
    ssr: false 
  }
);

// ─────────────────────────────────────────────────────────────
// FEATURE CONFIG
// Maps viewType to feature component and metadata
// ─────────────────────────────────────────────────────────────

const FEATURES = {
  cars: {
    component: CarsSection,
    feature: "cars",
  },
  "orders-big-calendar": {
    component: CalendarSection,
    feature: "calendar",
  },
  calendar: {
    component: CalendarSection,
    feature: "calendar",
  },
  orders: {
    component: CalendarSection,
    feature: "calendar",
  },
  "orders-table": {
    component: OrdersTableSection,
    feature: "orders-table",
  },
  table: {
    component: OrdersTableSection,
    feature: "orders-table",
  },
};

// ─────────────────────────────────────────────────────────────
// ADMIN VIEW - Main entry point
// ─────────────────────────────────────────────────────────────

/**
 * AdminView - контейнер админки с lazy-loaded feature секциями
 * 
 * @param {object} props
 * @param {object} props.company - данные компании
 * @param {array} props.cars - массив машин
 * @param {array} props.orders - массив заказов
 * @param {string} props.viewType - тип view: 'cars' | 'orders-big-calendar' | 'orders-table'
 */
export default function AdminView({ company, cars, orders, viewType }) {
  return (
    <Feed cars={cars} orders={orders} company={company} isAdmin isMain={false}>
      <AdminViewContent viewType={viewType} />
    </Feed>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN VIEW CONTENT - Thin orchestrator
// Reads viewType and renders appropriate feature
// ─────────────────────────────────────────────────────────────

/**
 * AdminViewContent - внутренний компонент-оркестратор
 * Без бизнес-логики, только выбор feature для отображения
 */
function AdminViewContent({ viewType }) {
  // ───────────────────────────────────────────────────────────
  // SHARED MODAL STATE (поднят сюда, чтобы AdminTopBar и CarsSection использовали один state)
  // ───────────────────────────────────────────────────────────
  const [isAddCarModalOpen, setIsAddCarModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const openAddCarModal = useCallback(() => {
    setIsAddCarModalOpen(true);
  }, []);

  const closeAddCarModal = useCallback(() => {
    setIsAddCarModalOpen(false);
  }, []);

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Memoize feature config lookup
  const featureConfig = useMemo(
    () => FEATURES[viewType] || FEATURES.cars,
    [viewType]
  );

  const FeatureComponent = featureConfig.component;

  // Props for CarsSection (only when cars feature is active)
  const carsSectionProps = viewType === "cars" ? {
    isAddModalOpen: isAddCarModalOpen,
    closeAddModal: closeAddCarModal,
    setNotification,
  } : {};

  return (
    <>
      {/* Top bar with feature-specific actions */}
      <AdminTopBar
        feature={featureConfig.feature}
        onAddClick={viewType === "cars" ? openAddCarModal : undefined}
      />
      
      {/* Feature section — lazy loading handled by dynamic() */}
      <Box
        sx={
          featureConfig.feature === "calendar"
            ? { my: 0, overflow: "visible", minHeight: "calc(100dvh - 60px)" }
            : { my: 3 }
        }
      >
        <FeatureComponent {...carsSectionProps} />
      </Box>
      
      {/* Global notifications */}
      <AdminNotifications
        notification={notification}
        onClose={closeNotification}
      />
    </>
  );
}
