"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Box, Button, Typography } from "@mui/material";
import BigCalendar from "@/app/components/calendar-ui/BigCalendar";
import { useCalendar } from "./useCalendar";
import { useCalendarViewSettings } from "./hooks/useCalendarViewSettings";
import CalendarToolbar from "./CalendarToolbar";
import CalendarSettingsPanel from "./CalendarSettingsPanel";

/**
 * CalendarSection - секция большого календаря
 * Feature component - lazy-loaded
 */
export default function CalendarSection() {
  const { cars, hasCars } = useCalendar();
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const {
    settings,
    setDayRange,
    setShowLegend,
    setShowBufferInLegend,
    setShowDeliveryInLegend,
    setShowConflictBadges,
    setHighlightToday,
    setAutoScrollToToday,
    viewModeForCalendar,
    applyViewModeFromCalendar,
  } = useCalendarViewSettings();

  return (
    <Box
      sx={{
        px: { xs: 0, md: 1 },
        pb: 0,
        pt: "60px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 0px)",
        minHeight: 420,
        overflow: "hidden",
      }}
    >
      <CalendarToolbar
        dayRange={settings.dayRange}
        showLegend={settings.showLegend}
        legendPlacement={settings.legendPlacement}
        showBufferInLegend={settings.showBufferInLegend}
        showDeliveryInLegend={settings.showDeliveryInLegend}
        onDayRangeChange={setDayRange}
        onOpenCalendarSettings={() => setSettingsPanelOpen(true)}
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
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
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
          />
        )}
      </Box>
    </Box>
  );
}
