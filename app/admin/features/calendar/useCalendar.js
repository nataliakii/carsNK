"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMainContext } from "@app/Context";
import { ROLE } from "@/domain/orders/admin-rbac";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";

/**
 * useCalendar - хук для Big Calendar в админке
 *
 * Superadmin country switcher (navbar Spain/Greece/All) filters calendar rows
 * the same way as the Cars page: by company.country → car.ownerId.
 */
export function useCalendar() {
  const { cars: allCars, allOrders, isLoading } = useMainContext();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;
  const { active: viewAsActive } = useAdminViewAs();
  const showCountryFilter = isSuperAdmin && !viewAsActive;
  const { country: adminCountry } = useAdminCountryFilter();

  const [companyIdsForCountry, setCompanyIdsForCountry] = useState(null);

  useEffect(() => {
    if (!showCountryFilter || adminCountry === "ALL") {
      setCompanyIdsForCountry(null);
      return undefined;
    }
    let cancelled = false;
    setCompanyIdsForCountry(new Set());
    (async () => {
      try {
        const qs = `country=${encodeURIComponent(adminCountry)}`;
        const res = await fetch(`/api/admin/owners?${qs}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body?.success || !Array.isArray(body.companies)) {
          return;
        }
        setCompanyIdsForCountry(
          new Set(body.companies.map((c) => String(c._id)))
        );
      } catch {
        /* ignore — keep previous filter */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showCountryFilter, adminCountry]);

  const cars = useMemo(() => {
    const list = Array.isArray(allCars) ? allCars : [];
    if (!showCountryFilter || adminCountry === "ALL" || !companyIdsForCountry) {
      return list;
    }
    return list.filter((car) => {
      const oid = car?.ownerId ? String(car.ownerId) : "";
      // Match Cars page: keep unassigned visible under a country filter.
      if (!oid) return true;
      return companyIdsForCountry.has(oid);
    });
  }, [allCars, showCountryFilter, adminCountry, companyIdsForCountry]);

  const sortedCars = useMemo(
    () =>
      [...cars].sort((a, b) =>
        String(a?.model || "").localeCompare(String(b?.model || ""))
      ),
    [cars]
  );

  const hasCars = cars.length > 0;
  const hasOrders = allOrders.length > 0;

  return {
    cars,
    sortedCars,
    orders: allOrders,
    allOrders,
    hasCars,
    hasOrders,
    isLoading,
    adminCountry,
  };
}

export default useCalendar;
