"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CollapsibleSection from "@/app/components/ui/CollapsibleSection";
import { useAdminSectionOpen } from "@/app/hooks/useAdminSectionOpen";
import { ADMIN_ORDERS_FINANCIAL_SUMMARY_SECTION } from "@/domain/admin/adminSectionCollapse";

const SUMMARY_CONTENT_ID = "admin-orders-financial-summary";

function euro(amount) {
  const n = Number(amount);
  return `€${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

const SummaryRoot = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  paddingTop: theme.spacing(0.75),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const SummaryGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(2),
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
}));

const SummaryCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
  minWidth: 0,
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const SummaryLine = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: theme.spacing(2),
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const CardHeadline = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

const MoneyValue = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.h6.fontWeight,
}));

function SummaryMoneyLine({ label, value, emphasize = false }) {
  return (
    <SummaryLine>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <MoneyValue
        variant="body2"
        color={emphasize ? "primary.main" : "text.primary"}
        noWrap
      >
        {value}
      </MoneyValue>
    </SummaryLine>
  );
}

/**
 * Финансовая сводка по отфильтрованным заказам (Rovaro vs внутренние).
 * Свёрнута по умолчанию; выбор запоминается в localStorage.
 * Только отображение: суммы приходят готовыми из summarizeFilteredOrders.
 */
const OrdersFinancialSummary = ({
  summary,
  filteredCount,
  totalCount,
  showBookingFee = true,
}) => {
  const { t } = useTranslation();
  const { open, toggleOpen } = useAdminSectionOpen(
    ADMIN_ORDERS_FINANCIAL_SUMMARY_SECTION
  );
  const totals = summary || {};

  return (
    <SummaryRoot>
      <CollapsibleSection
        title={t("table.financialSummary", { defaultValue: "Financial summary" })}
        open={open}
        onToggle={toggleOpen}
        toggleLabel={
          open
            ? t("table.hideFinancialSummary", {
                defaultValue: "Hide financial summary",
              })
            : t("table.showFinancialSummary", {
                defaultValue: "Show financial summary",
              })
        }
        contentId={SUMMARY_CONTENT_ID}
      >
        <SummaryGrid>
          <SummaryCard>
            <CardTitle variant="subtitle2">
              {t("table.allBookingValue", { defaultValue: "All booking value" })}
            </CardTitle>
            <CardHeadline variant="h6">
              {euro(totals.combinedCalendarValue)}
            </CardHeadline>
            <Typography variant="body2" color="text.secondary">
              {t("table.allOrders")}: {filteredCount} / {totalCount}
            </Typography>
          </SummaryCard>
          <SummaryCard>
            <CardTitle variant="subtitle2">
              {t("table.rovaroBookingsTitle", { defaultValue: "Rovaro bookings" })}
            </CardTitle>
            <Typography variant="body2" color="text.secondary">
              {t("table.rovaroBookingCount", {
                defaultValue: "{{count}} bookings",
                count: totals.platformCount,
              })}
            </Typography>
            <SummaryMoneyLine
              label={t("table.platformBookingValue", { defaultValue: "Rental value" })}
              value={euro(totals.platformBookingValue)}
            />
            {showBookingFee ? (
              <SummaryMoneyLine
                label={t("table.bookingFee", { defaultValue: "Rovaro Booking Fee" })}
                value={euro(totals.rovaroBookingFees)}
                emphasize
              />
            ) : null}
            <SummaryMoneyLine
              label={t("table.dueToCompanies", { defaultValue: "Due to companies" })}
              value={euro(totals.supplierPlatformAmount)}
            />
          </SummaryCard>
          <SummaryCard>
            <CardTitle variant="subtitle2">
              {t("table.internalBookingsTitle", { defaultValue: "Internal bookings" })}
            </CardTitle>
            <Typography variant="body2" color="text.secondary">
              {t("table.rovaroBookingCount", {
                defaultValue: "{{count}} bookings",
                count: totals.internalCount,
              })}
            </Typography>
            <SummaryMoneyLine
              label={t("table.internalBookingValue", {
                defaultValue: "Internal booking value",
              })}
              value={euro(totals.internalBookingValue)}
            />
          </SummaryCard>
        </SummaryGrid>
      </CollapsibleSection>
    </SummaryRoot>
  );
};

export default OrdersFinancialSummary;
