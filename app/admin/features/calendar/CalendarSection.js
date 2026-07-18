"use client";

import React, { useState } from "react";
import { Box } from "@mui/material";
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
  const { cars } = useCalendar();
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
        height: "100vh",
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
      </Box>
    </Box>
  );
}
