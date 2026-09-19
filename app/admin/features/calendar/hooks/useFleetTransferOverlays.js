"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { buildTransferCalendarOverlays } from "@/domain/calendar/transferOverlays";

/**
 * Loads claimed transfers and maps them onto rental-fleet cars for calendar overlay.
 * Enabled only when `enabled` is true (calendar setting toggle).
 */
export function useFleetTransferOverlays({ enabled, cars }) {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;
  const { country: adminCountry } = useAdminCountryFilter();
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setTransfers([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (isSuperAdmin) {
          params.set(
            "country",
            adminCountry === "ALL" ? "ALL" : adminCountry
          );
        }
        const res = await fetch(`/api/admin/transfers?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body?.success) return;
        setTransfers(Array.isArray(body.items) ? body.items : []);
      } catch {
        if (!cancelled) setTransfers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isSuperAdmin, adminCountry]);

  const extraOrders = useMemo(() => {
    if (!enabled) return [];
    return buildTransferCalendarOverlays(transfers, cars);
  }, [enabled, transfers, cars]);

  return { extraOrders, transferCount: transfers.length };
}
