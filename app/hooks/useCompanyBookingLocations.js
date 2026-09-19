"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fallbackBookingLocationNames,
  locationRequiresAddressDetail,
  isAirportBookingLocation,
} from "@/domain/platform/bookingLocations";

export function useCompanyBookingLocations(companyId) {
  const [cities, setCities] = useState([]);
  const [names, setNames] = useState(() => fallbackBookingLocationNames());
  const [orderRadiusKm, setOrderRadiusKm] = useState(null);

  useEffect(() => {
    const id = companyId ? String(companyId) : "";
    const url = id
      ? `/api/public/booking-locations?companyId=${encodeURIComponent(id)}`
      : "/api/public/booking-locations";
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.success) return;
        const nextCities = Array.isArray(body.cities) ? body.cities : [];
        const nextNames = Array.isArray(body.names)
          ? body.names.filter(Boolean)
          : nextCities.map((city) => city.name).filter(Boolean);
        if (nextNames.length) {
          setCities(nextCities);
          setNames(nextNames);
        }
        setOrderRadiusKm(
          body.orderRadiusKm == null || body.orderRadiusKm === ""
            ? null
            : Number(body.orderRadiusKm)
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const defaultName = names[0] || "";

  const helpers = useMemo(
    () => ({
      requiresDetail: (value) => locationRequiresAddressDetail(value, cities),
      isAirport: (value) => isAirportBookingLocation(value, cities),
    }),
    [cities]
  );

  return { names, cities, defaultName, orderRadiusKm, ...helpers };
}
