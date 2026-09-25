/**
 * Утилиты для работы с overlap датами
 */

/**
 * Получает информацию о start/end для даты.
 * Scans all matching entries so a date that is both a start and an end
 * (another order starts when this one ends) still reports both flags.
 * Prefer the end entry for `info` when both exist (overlap CASE 3).
 *
 * @param {Array} startEndDates - массив start/end дат
 * @param {string} dateStr - дата
 * @returns {{ isStartDate: boolean, isEndDate: boolean, info: Object|null }}
 */
export function getStartEndInfo(startEndDates, dateStr) {
  const matches = (startEndDates || []).filter((d) => d?.date === dateStr);
  const startInfo = matches.find((d) => d.type === "start") || null;
  const endInfo = matches.find((d) => d.type === "end") || null;
  return {
    isStartDate: Boolean(startInfo),
    isEndDate: Boolean(endInfo),
    info: endInfo || startInfo || null,
  };
}

/**
 * Проверяет, является ли дата start+end overlap
 * @param {Array} startEndOverlapDates - массив overlap дат
 * @param {string} dateStr - дата
 * @returns {{ isOverlap: boolean, info: Object|null }}
 */
export function getStartEndOverlapInfo(startEndOverlapDates, dateStr) {
  const info = startEndOverlapDates?.find((dateObj) => dateObj.date === dateStr);
  return {
    isOverlap: Boolean(info),
    info: info || null,
  };
}

/**
 * Проверяет, является ли дата overlap датой
 * @param {Array} overlapDates - массив overlap дат
 * @param {string} dateStr - дата
 * @returns {{ isOverlap: boolean, info: Object|null }}
 */
export function getOverlapInfo(overlapDates, dateStr) {
  const info = overlapDates?.find((dateObj) => dateObj.date === dateStr);
  return {
    isOverlap: Boolean(info),
    info: info || null,
  };
}

