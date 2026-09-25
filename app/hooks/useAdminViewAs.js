"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";
import { ADMIN_VIEW_AS_EVENT } from "@/domain/owners/adminViewAsShared";

export function useAdminViewAs() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  /**
   * The company context lives in a cookie, so it is unknown until the first
   * fetch answers. Callers that decide something consequential from it — whether
   * a new order is this company's own record or a brokered platform request —
   * must wait rather than read the not-in-a-company default.
   */
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) {
      setCompany(null);
      setReady(true);
      return null;
    }
    try {
      const res = await fetch("/api/admin/view-as", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setCompany(null);
        return null;
      }
      const next = body.active ? body.company : null;
      setCompany(next);
      return next;
    } catch {
      setCompany(null);
      return null;
    } finally {
      setReady(true);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    refresh();
    const onCustom = () => refresh();
    window.addEventListener(ADMIN_VIEW_AS_EVENT, onCustom);
    return () => window.removeEventListener(ADMIN_VIEW_AS_EVENT, onCustom);
  }, [refresh]);

  const enter = useCallback(
    async (companyId) => {
      if (!isSuperAdmin || !companyId) return { ok: false };
      setLoading(true);
      try {
        const res = await fetch("/api/admin/view-as", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId }),
        });
        const body = await res.json();
        if (!res.ok || !body.success) {
          return { ok: false, message: body.message || "Failed" };
        }
        setCompany(body.company);
        window.dispatchEvent(new CustomEvent(ADMIN_VIEW_AS_EVENT));
        return { ok: true, company: body.company };
      } catch (err) {
        return { ok: false, message: err.message };
      } finally {
        setLoading(false);
      }
    },
    [isSuperAdmin]
  );

  const exit = useCallback(async () => {
    if (!isSuperAdmin) return { ok: false };
    setLoading(true);
    try {
      await fetch("/api/admin/view-as", { method: "DELETE" });
      setCompany(null);
      window.dispatchEvent(new CustomEvent(ADMIN_VIEW_AS_EVENT));
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  return {
    isSuperAdmin,
    active: Boolean(company),
    company,
    ready,
    loading,
    enter,
    exit,
    refresh,
  };
}
