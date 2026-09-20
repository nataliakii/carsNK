"use client";

import { useEffect, useState } from "react";
import { mergeOperatingCityCatalog } from "@/domain/geo/operatingCityCatalog";

async function fetchPlatformCities(country) {
  const cc = String(country || "")
    .trim()
    .toUpperCase();
  const qs = cc && cc !== "ALL" ? `country=${encodeURIComponent(cc)}` : "country=ALL";
  let list = [];
  try {
    const adminRes = await fetch(`/api/admin/platform/cities?${qs}`, {
      cache: "no-store",
    });
    if (adminRes.ok) {
      const body = await adminRes.json();
      if (body?.success && Array.isArray(body.cities)) {
        list = body.cities;
      }
    }
  } catch {
    /* company admin may not access admin cities */
  }
  if (!list.length) {
    try {
      const res = await fetch("/api/platform/public", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        if (body?.success && Array.isArray(body.cities)) {
          list = body.cities;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return mergeOperatingCityCatalog(list, { country: cc || "ALL" });
}

export default function useOperatingCityCatalog(country) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await fetchPlatformCities(country);
      if (!cancelled) {
        setCatalog(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [country]);

  return { catalog, loading };
}
