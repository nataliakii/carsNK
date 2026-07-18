"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "calendar_view_settings_v1";

/** @typedef {'15d' | '1m' | '2m'} DayRange */
/** @typedef {'inline'} LegendPlacement */

/**
 * @type {{
 *   dayRange: DayRange,
 *   showLegend: boolean,
 *   legendPlacement: LegendPlacement,
 *   showBufferInLegend: boolean,
 *   showDeliveryInLegend: boolean,
 *   showConflictBadges: boolean,
 *   highlightToday: boolean,
 *   autoScrollToToday: boolean,
 * }}
 */
const DEFAULT_SETTINGS = {
  dayRange: "1m",
  showLegend: false,
  legendPlacement: "inline",
  showBufferInLegend: true,
  showDeliveryInLegend: true,
  showConflictBadges: true,
  highlightToday: true,
  autoScrollToToday: true,
};

const VALID_DAY_RANGE = new Set(["15d", "1m", "2m"]);

function safeParse(raw) {
  if (raw == null || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeSettings(parsed) {
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };

  const merged = { ...DEFAULT_SETTINGS, ...parsed };

  // v1: в localStorage не было showLegend — раньше легенда считалась включённой
  if (!Object.prototype.hasOwnProperty.call(parsed, "showLegend")) {
    merged.showLegend = true;
  }

  return {
    dayRange: VALID_DAY_RANGE.has(merged.dayRange)
      ? merged.dayRange
      : DEFAULT_SETTINGS.dayRange,
    // Легенда всегда inline: опция смены расположения удалена из UI.
    legendPlacement: "inline",
    showLegend:
      typeof merged.showLegend === "boolean"
        ? merged.showLegend
        : DEFAULT_SETTINGS.showLegend,
    showBufferInLegend:
      typeof merged.showBufferInLegend === "boolean"
        ? merged.showBufferInLegend
        : DEFAULT_SETTINGS.showBufferInLegend,
    showDeliveryInLegend:
      typeof merged.showDeliveryInLegend === "boolean"
        ? merged.showDeliveryInLegend
        : DEFAULT_SETTINGS.showDeliveryInLegend,
    showConflictBadges:
      typeof merged.showConflictBadges === "boolean"
        ? merged.showConflictBadges
        : DEFAULT_SETTINGS.showConflictBadges,
    highlightToday:
      typeof merged.highlightToday === "boolean"
        ? merged.highlightToday
        : DEFAULT_SETTINGS.highlightToday,
    autoScrollToToday:
      typeof merged.autoScrollToToday === "boolean"
        ? merged.autoScrollToToday
        : DEFAULT_SETTINGS.autoScrollToToday,
  };
}

function readFromStorage() {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeToStorage(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // quota / private mode — ignore
  }
}

/**
 * Centralized calendar view preferences (toolbar + BigCalendar props).
 * SSR-safe: defaults until mount, then hydrate from localStorage.
 */
export function useCalendarViewSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeToStorage(settings);
  }, [settings, hydrated]);

  const setDayRange = useCallback((dayRange) => {
    if (!VALID_DAY_RANGE.has(dayRange)) return;
    setSettings((s) => ({ ...s, dayRange }));
  }, []);

  const setShowLegend = useCallback((showLegend) => {
    setSettings((s) => ({ ...s, showLegend: Boolean(showLegend) }));
  }, []);

  const setShowBufferInLegend = useCallback((showBufferInLegend) => {
    setSettings((s) => ({
      ...s,
      showBufferInLegend: Boolean(showBufferInLegend),
    }));
  }, []);

  const setShowDeliveryInLegend = useCallback((showDeliveryInLegend) => {
    setSettings((s) => ({
      ...s,
      showDeliveryInLegend: Boolean(showDeliveryInLegend),
    }));
  }, []);

  const setShowConflictBadges = useCallback((showConflictBadges) => {
    setSettings((s) => ({
      ...s,
      showConflictBadges: Boolean(showConflictBadges),
    }));
  }, []);

  const setHighlightToday = useCallback((highlightToday) => {
    setSettings((s) => ({
      ...s,
      highlightToday: Boolean(highlightToday),
    }));
  }, []);

  const setAutoScrollToToday = useCallback((autoScrollToToday) => {
    setSettings((s) => ({
      ...s,
      autoScrollToToday: Boolean(autoScrollToToday),
    }));
  }, []);

  /** Called when BigCalendar navigation toggles view (full ↔ range15). */
  const applyViewModeFromCalendar = useCallback((viewMode) => {
    setSettings((s) => {
      if (viewMode === "range15") return { ...s, dayRange: "15d" };
      if (viewMode === "full")
        return { ...s, dayRange: s.dayRange === "15d" ? "1m" : s.dayRange };
      return s;
    });
  }, []);

  const viewModeForCalendar = useMemo(() => {
    return settings.dayRange === "15d" ? "range15" : "full";
  }, [settings.dayRange]);

  return {
    settings,
    hydrated,
    setDayRange,
    setShowLegend,
    setShowBufferInLegend,
    setShowDeliveryInLegend,
    setShowConflictBadges,
    setHighlightToday,
    setAutoScrollToToday,
    viewModeForCalendar,
    applyViewModeFromCalendar,
  };
}
