/**
 * bookingRules.js
 *
 * FALLBACK значения правил бронирования.
 * 
 * ⚠️ ВАЖНО: Реальные значения берутся из базы данных компании (company.bufferTime, etc.).
 * Эти константы используются ТОЛЬКО как fallback, если данные компании недоступны.
 * 
 * Источник правды: MongoDB → Company model
 */

export const BOOKING_RULES = {
  /**
   * Буферное время между заказами (в часах) - FALLBACK.
   * Реальное значение: company.bufferTime
   */
  bufferHours: 2,

  /**
   * Минимальная продолжительность аренды (в часах) - FALLBACK.
   * Реальное значение: company.minRentalDuration
   */
  minRentalDuration: 1,

  /**
   * Рабочие часы - FALLBACK.
   * Реальное значение: company.workingHours
   */
  workingHours: {
    start: "08:00",
    end: "22:00",
  },
};

export default BOOKING_RULES;
