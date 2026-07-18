"use client";

import CalendarContainer from "./CalendarContainer";

/**
 * Публичная точка входа: тонкая обёртка над CalendarContainer.
 */
export default function BigCalendar(props) {
  return <CalendarContainer {...props} />;
}
