import { ALL_UI_LOCALE_CODES } from "@/domain/platform/uiLocales";

export const CUSTOMER_RENTAL_TERMS_MAX_CHARS = 50_000;

export const CUSTOMER_RENTAL_TERMS_TARGET_LOCALES = ALL_UI_LOCALE_CODES.filter(
  (code) => code !== "en"
);
