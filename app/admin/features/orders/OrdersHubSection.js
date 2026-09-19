"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import OrdersTableSection from "@app/admin/features/orders/OrdersTableSection";
import TransfersSection from "@app/admin/transfers/TransfersSection";
import PendingCountBadge from "@app/admin/shared/components/PendingCountBadge";
import { useAdminPendingInbox } from "@app/hooks/useAdminPendingInbox";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";

function OrdersHubInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab =
    searchParams?.get("tab") === "transfers" ? "transfers" : "rentals";
  const { country } = useAdminCountryFilter();
  const { rentals: pendingRentals, transfers: pendingTransfers } =
    useAdminPendingInbox({ enabled: true, country });

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === "transfers") params.set("tab", "transfers");
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(() => (tab === "transfers" ? 1 : 0), [tab]);

  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_, v) => setTab(v === 1 ? "transfers" : "rentals")}
        sx={{
          px: { xs: 1, md: 2 },
          borderBottom: 1,
          borderColor: "divider",
          mb: 1,
          minHeight: 42,
          "& .MuiTab-root": {
            textTransform: "none",
            minHeight: 42,
            fontWeight: 600,
          },
        }}
      >
        <Tab
          label={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
            >
              {t("header.carRentals", { defaultValue: "Car rentals" })}
              <PendingCountBadge count={pendingRentals} sx={{ ml: 0 }} />
            </Box>
          }
        />
        <Tab
          label={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
            >
              {t("header.transfers", { defaultValue: "Transfers" })}
              <PendingCountBadge count={pendingTransfers} sx={{ ml: 0 }} />
            </Box>
          }
        />
      </Tabs>
      {tab === "transfers" ? <TransfersSection /> : <OrdersTableSection />}
    </Box>
  );
}

/**
 * Single Orders screen: Rentals table | Transfers table via tabs.
 * Calendar stays a separate navbar item (rental board + optional fleet overlays).
 */
export default function OrdersHubSection() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <OrdersHubInner />
    </Suspense>
  );
}
