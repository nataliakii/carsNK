"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import BigCalendar from "@/app/components/calendar-ui/BigCalendar";
import { useCalendar } from "./useCalendar";
import { useCalendarViewSettings } from "./hooks/useCalendarViewSettings";
import { useFleetTransferOverlays } from "./hooks/useFleetTransferOverlays";
import CalendarToolbar from "./CalendarToolbar";
import CalendarSettingsPanel from "./CalendarSettingsPanel";
import BulkAddOfflineOrdersModal from "@app/admin/features/orders/modals/BulkAddOfflineOrdersModal";

/**
 * CalendarSection - секция большого календаря
 * Feature component - lazy-loaded
 *
 * Scroll model:
 * Feed fillsViewport gives a fixed viewport under the navbar.
 * This section only flex-fills that space (no second calc(100dvh…)).
 * TableContainer inside BigCalendar is the only pan surface
 * (sticky day header + sticky car column).
 */
export default function CalendarSection() {
  const { cars, hasCars } = useCalendar();
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [bulkOfflineOpen, setBulkOfflineOpen] = useState(false);
  const {
    settings,
    setDayRange,
    setShowLegend,
    setShowBufferInLegend,
    setShowDeliveryInLegend,
    setShowConflictBadges,
    setHighlightToday,
    setAutoScrollToToday,
    setShowFleetTransfers,
    viewModeForCalendar,
    applyViewModeFromCalendar,
  } = useCalendarViewSettings();

  const { extraOrders } = useFleetTransferOverlays({
    enabled: settings.showFleetTransfers,
    cars,
  });

  return (
    <Box
      sx={{
        px: { xs: 0, md: 1 },
        pb: 0,
        pt: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 0%",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <CalendarToolbar
        dayRange={settings.dayRange}
        showLegend={settings.showLegend}
        legendPlacement={settings.legendPlacement}
        showBufferInLegend={settings.showBufferInLegend}
        showDeliveryInLegend={settings.showDeliveryInLegend}
        showFleetTransfers={settings.showFleetTransfers}
        onDayRangeChange={setDayRange}
        onShowFleetTransfersChange={setShowFleetTransfers}
        onOpenCalendarSettings={() => setSettingsPanelOpen(true)}
        onBulkOfflineOrders={() => setBulkOfflineOpen(true)}
      />
      <CalendarSettingsPanel
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        settings={settings}
        setShowLegend={setShowLegend}
        setShowBufferInLegend={setShowBufferInLegend}
        setShowDeliveryInLegend={setShowDeliveryInLegend}
        setShowConflictBadges={setShowConflictBadges}
        setHighlightToday={setHighlightToday}
        setAutoScrollToToday={setAutoScrollToToday}
        setShowFleetTransfers={setShowFleetTransfers}
      />
      <BulkAddOfflineOrdersModal
        open={bulkOfflineOpen}
        onClose={() => setBulkOfflineOpen(false)}
      />
      <Box
        sx={{
          flex: "1 1 0%",
          height: 0,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!hasCars ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 280,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              px: 3,
              py: 4,
              textAlign: "center",
              borderRadius: 2,
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: "background.paper",
              m: { xs: 1, md: 2 },
            }}
          >
            <Typography variant="h6" component="h2">
              No cars in the database yet
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
              The calendar shows one row per car. Add vehicles first, then
              bookings will appear here.
            </Typography>
            <Button
              component={Link}
              href="/admin/cars"
              variant="contained"
              color="primary"
            >
              Go to Cars
            </Button>
          </Box>
        ) : (
          <BigCalendar
            cars={cars}
            showLegend={false}
            legendPlacement={settings.legendPlacement}
            showBufferInLegend={settings.showBufferInLegend}
            showDeliveryInLegend={settings.showDeliveryInLegend}
            showConflictBadges={settings.showConflictBadges}
            highlightToday={settings.highlightToday}
            autoScrollToToday={settings.autoScrollToToday}
            viewMode={viewModeForCalendar}
            onViewModeChange={applyViewModeFromCalendar}
            dayRange={settings.dayRange}
            extraOrders={extraOrders}
          />
        )}
      </Box>
    </Box>
  );
}
