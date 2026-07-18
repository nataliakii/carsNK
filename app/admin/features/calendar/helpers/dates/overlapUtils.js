/**
 * Утилиты для работы с overlap датами
 */

/**
 * Получает информацию о start/end для даты
 * @param {Array} startEndDates - массив start/end дат
 * @param {string} dateStr - дата
 * @returns {{ isStartDate: boolean, isEndDate: boolean, info: Object|null }}
 */
export function getStartEndInfo(startEndDates, dateStr) {
  const info = startEndDates.find((d) => d.date === dateStr);
  return {
    isStartDate: info?.type === "start",
    isEndDate: info?.type === "end",
    info: info || null,
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

