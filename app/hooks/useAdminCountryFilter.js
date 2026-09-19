"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ADMIN_COUNTRY_EVENT,
  ADMIN_COUNTRY_OPTIONS,
  getDefaultAdminCountryFilter,
  normalizeAdminCountryFilter,
  readAdminCountryFilterFromStorage,
  writeAdminCountryFilterToStorage,
} from "@/domain/platform/adminCountryScope";

export function useAdminCountryFilter() {
  const [country, setCountryState] = useState(getDefaultAdminCountryFilter);

  useEffect(() => {
    setCountryState(readAdminCountryFilterFromStorage());
    const onStorage = (e) => {
      if (e.key && e.key !== "adminCountryFilter") return;
      setCountryState(readAdminCountryFilterFromStorage());
    };
    const onCustom = (e) => {
      const next = normalizeAdminCountryFilter(e?.detail?.country);
      setCountryState(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(ADMIN_COUNTRY_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ADMIN_COUNTRY_EVENT, onCustom);
    };
  }, []);

  const setCountry = useCallback((next) => {
    const saved = writeAdminCountryFilterToStorage(next);
    setCountryState(saved);
  }, []);

  return {
    country,
    setCountry,
    options: ADMIN_COUNTRY_OPTIONS,
  };
}
