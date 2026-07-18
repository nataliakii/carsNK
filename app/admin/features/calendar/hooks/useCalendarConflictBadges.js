/**
 * useCalendarConflictBadges
 *
 * Хук для вычисления бейджей конфликтов в календаре.
 *
 * Возвращает:
 * - headerBadgesByDate: Record<YYYY-MM-DD, {blocks, warnings, infos}>
 * - cellBadgesByCarAndDate: Record<carId, Record<YYYY-MM-DD, {blocks, warnings, infos}>>
 */

import { useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const BUSINESS_TZ = "Europe/Athens";

/**
 * Анализирует конфликты между заказами для одной машины на одну дату
 */
function analyzeConflictsForCarAndDate(orders, carId, date) {
  const result = { blocks: 0, warnings: 0, infos: 0 };

  // Фильтруем заказы для этой машины на эту дату
  const carOrders = orders.filter((o) => {
    const oCarId = o.car?._id || o.car;
    if (oCarId?.toString() !== carId?.toString()) return false;

    const startDay = dayjs.utc(o.rentalStartDate).tz(BUSINESS_TZ).startOf("day");
    const endDay = dayjs.utc(o.rentalEndDate).tz(BUSINESS_TZ).startOf("day");
    const targetDay = dayjs.tz(date, BUSINESS_TZ).startOf("day");

    return (
      targetDay.isSame(startDay, "day") ||
      targetDay.isSame(endDay, "day") ||
      (targetDay.isAfter(startDay, "day") && targetDay.isBefore(endDay, "day"))
    );
  });

  if (carOrders.length < 2) {
    // Нет конфликтов если меньше 2 заказов
    return result;
  }

  // Проверяем пары заказов
  for (let i = 0; i < carOrders.length; i++) {
    for (let j = i + 1; j < carOrders.length; j++) {
      const orderA = carOrders[i];
      const orderB = carOrders[j];

      const aConfirmed = orderA.confirmed === true;
      const bConfirmed = orderB.confirmed === true;

      // confirmed vs confirmed = block
      if (aConfirmed && bConfirmed) {
        result.blocks++;
      }
      // confirmed vs pending = warning
      else if (aConfirmed !== bConfirmed) {
        result.warnings++;
      }
      // pending vs pending = info (или warning)
      else {
        result.infos++;
      }
    }
  }

  return result;
}

/**
 * @param {Array} allOrders - Все заказы
 * @param {Array} cars - Все машины
 * @param {string} startDate - Начало периода (YYYY-MM-DD)
 * @param {string} endDate - Конец периода (YYYY-MM-DD)
 */
export function useCalendarConflictBadges(allOrders, cars, startDate, endDate) {
  return useMemo(() => {
    const headerBadgesByDate = {};
    const cellBadgesByCarAndDate = {};

    if (!allOrders || !cars || !startDate || !endDate) {
      return { headerBadgesByDate, cellBadgesByCarAndDate };
    }

    // Генерируем все даты в диапазоне
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const dates = [];
    let current = start;
    while (current.isBefore(end) || current.isSame(end, "day")) {
      dates.push(current.format("YYYY-MM-DD"));
      current = current.add(1, "day");
    }

    // Инициализируем структуры
    cars.forEach((car) => {
      cellBadgesByCarAndDate[car._id] = {};
    });

    // Для каждой даты и машины считаем конфликты
    dates.forEach((date) => {
      let totalBlocks = 0;
      let totalWarnings = 0;
      let totalInfos = 0;

      cars.forEach((car) => {
        const conflicts = analyzeConflictsForCarAndDate(allOrders, car._id, date);

        cellBadgesByCarAndDate[car._id][date] = conflicts;

        totalBlocks += conflicts.blocks;
        totalWarnings += conflicts.warnings;
        totalInfos += conflicts.infos;
      });

      if (totalBlocks > 0 || totalWarnings > 0 || totalInfos > 0) {
        headerBadgesByDate[date] = {
          blocks: totalBlocks,
          warnings: totalWarnings,
          infos: totalInfos,
        };
      }
    });

    return { headerBadgesByDate, cellBadgesByCarAndDate };
  }, [allOrders, cars, startDate, endDate]);
}

export default useCalendarConflictBadges;

