"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import Feed from "@app/components/Feed";

// Shared components from new structure
import { AdminLoader, AdminNotifications } from "@app/admin/shared";
import CalendarHubTabs from "@app/admin/features/calendar/CalendarHubTabs";
import PartnerComplianceCard from "@/app/admin/shared/components/PartnerComplianceCard";
import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";

function FeatureLoader({ i18nKey }) {
  const { t, i18n } = useTranslation();
  const message = t(i18nKey, {
    lng: i18n.language,
    defaultValue: i18nKey,
  });
  return <AdminLoader message={message} />;
}

// ─────────────────────────────────────────────────────────────
// LAZY-LOADED FEATURE SECTIONS
// Reduces initial bundle size by loading features on demand
// ─────────────────────────────────────────────────────────────

const CarsSection = dynamic(
  () => import("@app/admin/features/cars/CarsSection"),
  { 
    loading: () => <FeatureLoader i18nKey="admin.loadingCars" />,
    ssr: false 
  }
);

const CalendarSection = dynamic(
  () => import("@app/admin/features/calendar/CalendarSection"),
  { 
    loading: () => <FeatureLoader i18nKey="admin.loadingCalendar" />,
    ssr: false 
  }
);

const OrdersTableSection = dynamic(
  () => import("@app/admin/features/orders/OrdersHubSection"),
  { 
    loading: () => <FeatureLoader i18nKey="admin.loadingOrdersTable" />,
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
    component: OrdersTableSection,
    feature: "orders-table",
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
  const isCalendar =
    viewType === "orders-big-calendar" ||
    viewType === "calendar" ||
    viewType === "orders-calendar";

  return (
    <Feed
      cars={cars}
      orders={orders}
      company={company}
      isAdmin
      isMain={false}
      fillsViewport={isCalendar}
    >
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
  const [isBulkCarsModalOpen, setIsBulkCarsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const openAddCarModal = useCallback(() => {
    setIsAddCarModalOpen(true);
  }, []);

  const closeAddCarModal = useCallback(() => {
    setIsAddCarModalOpen(false);
  }, []);

  const openBulkCarsModal = useCallback(() => {
    setIsBulkCarsModalOpen(true);
  }, []);

  const closeBulkCarsModal = useCallback(() => {
    setIsBulkCarsModalOpen(false);
  }, []);

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const { gate, listedOnMarketplace } = usePartnerLegalStatus();

  // Memoize feature config lookup
  const featureConfig = useMemo(
    () => FEATURES[viewType] || FEATURES.cars,
    [viewType]
  );

  const FeatureComponent = featureConfig.component;

  // Props for CarsSection (only when cars feature is active)
  const carsSectionProps =
    viewType === "cars"
      ? {
          isAddModalOpen: isAddCarModalOpen,
          closeAddModal: closeAddCarModal,
          isBulkModalOpen: isBulkCarsModalOpen,
          closeBulkModal: closeBulkCarsModal,
          setNotification,
        }
      : {};

  return (
    <>
      {viewType === "cars" ? (
        <CalendarHubTabs
          onAddClick={openAddCarModal}
          onBulkAddClick={openBulkCarsModal}
        />
      ) : null}

      {gate && !gate.canOperate ? (
        <Box sx={{ px: { xs: 1, md: 2 }, pt: 2, flexShrink: 0 }}>
          <PartnerComplianceCard />
        </Box>
      ) : null}

      {/* Feature section — lazy loading handled by dynamic() */}
      <Box
        sx={
          featureConfig.feature === "calendar"
            ? {
                flex: "1 1 0%",
                height: 0,
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                my: 0,
              }
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
