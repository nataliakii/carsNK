"use client";

import { useEffect, useMemo, useState } from "react";
import {
  locationRequiresAddressDetail,
  isAirportBookingLocation,
} from "@/domain/platform/bookingLocations";
import { bookingCoverageQueryKey } from "@/domain/orders/companyBookingCoverage";

const EMPTY_COVERAGE = {
  companyId: "",
  countryCode: "",
  version: "",
  offices: [],
  deliveryAreas: [],
  deliveryAvailable: false,
  queryKey: bookingCoverageQueryKey(""),
};

export function useCompanyBookingLocations(companyId) {
  const [cities, setCities] = useState([]);
  const [names, setNames] = useState([]);
  const [coverage, setCoverage] = useState(EMPTY_COVERAGE);
  const [orderRadiusKm, setOrderRadiusKm] = useState(null);
  const [loadedCompanyId, setLoadedCompanyId] = useState("");

  const queryKey = bookingCoverageQueryKey(
    companyId,
    coverage?.companyId && String(coverage.companyId) === String(companyId || "")
      ? coverage.version
      : ""
  );

  useEffect(() => {
    const id = companyId ? String(companyId) : "";
    setCities([]);
    setNames([]);
    setCoverage({ ...EMPTY_COVERAGE, queryKey: bookingCoverageQueryKey(id) });
    setLoadedCompanyId("");
    if (!id) return undefined;

    const url = `/api/public/booking-locations?companyId=${encodeURIComponent(id)}`;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.success) return;
        if (String(body.companyId || "") !== id) return;
        const nextCoverage = body.coverage || {
          ...EMPTY_COVERAGE,
          companyId: id,
          deliveryAreas: (body.cities || []).map((city) => ({
            id: String(city._id || city.id || city.name),
            name: city.name,
            countryCode: String(city.country || "").toUpperCase(),
          })),
        };
        nextCoverage.deliveryAvailable = Boolean(
          nextCoverage.deliveryAvailable ??
            (nextCoverage.deliveryAreas || []).length
        );
        const nextCities = Array.isArray(body.cities) ? body.cities : [];
        const nextNames = (nextCoverage.deliveryAreas || [])
          .map((area) => area.name)
          .filter(Boolean);
        setCities(nextCities);
        setNames(nextNames.length ? nextNames : []);
        setCoverage(nextCoverage);
        setLoadedCompanyId(id);
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
  const coverageReady =
    Boolean(companyId) && loadedCompanyId === String(companyId);

  const helpers = useMemo(
    () => ({
      requiresDetail: (value) => locationRequiresAddressDetail(value, cities),
      isAirport: (value) => isAirportBookingLocation(value, cities),
    }),
    [cities]
  );

  return {
    names,
    cities,
    coverage,
    coverageReady,
    queryKey,
    defaultName,
    orderRadiusKm,
    ...helpers,
  };
}
