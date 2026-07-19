/**
 * companyData.js
 * 
 * ⚠️ DEPRECATED: Этот файл существует только для обратной совместимости.
 * 
 * Реальные данные компании берутся из MongoDB через Context.
 * Используйте useMainContext().company в компонентах.
 * 
 * Эти значения — FALLBACK для случаев, когда Context недоступен.
 */

import { COMPANY_ID } from "@config/company";

/**
 * Season date ranges for pricing tiers
 * Используется в: PricingTiers, car model
 */
export const seasons = {
  NoSeason: { start: "01/10", end: "24/05" },
  LowSeason: { start: "25/05", end: "30/06" },
  LowUpSeason: { start: "01/09", end: "30/09" },
  MiddleSeason: { start: "01/07", end: "31/07" },
  HighSeason: { start: "01/08", end: "31/08" },
};

/**
 * @deprecated Используйте useMainContext().company
 * Fallback данные компании
 */
export const companyData = {
  companyId: COMPANY_ID,
  name: "CarsNK",
  tel: "+380 68 100 3771",
  tel2: "+353 85 270 96 05",
  email: "admin@bbqr.site",
  address: "Antonioy Kelesi 12, Nea Kallikratia 630 80",
  slogan: "Car rental aggregator in Greece",
  coords: { lat: "40.311273589340836", lon: "23.06426516796098" },
  defaultStart: "14:00",
  defaultEnd: "12:00",
  hoursDiffForStart: 1,
  hoursDiffForEnd: -1,
  seasons,
  locations: [
    { name: "Nea Kalikratia", coords: { lat: "40.31", lon: "23.06" } },
    { name: "Airport", coords: { lat: "40.31", lon: "23.06" } },
  ],
};
