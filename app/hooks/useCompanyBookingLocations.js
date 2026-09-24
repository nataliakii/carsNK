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

/** Share one coverage fetch across catalog cards for the same company. */
const coverageCache = new Map();

function readCachedCoverage(companyId) {
  return coverageCache.get(String(companyId || "")) || null;
}

function writeCachedCoverage(companyId, payload) {
  const id = String(companyId || "");
  if (!id || !payload) return;
  coverageCache.set(id, payload);
}

export function useCompanyBookingLocations(companyId) {
  const id = companyId ? String(companyId) : "";
  const cached = id ? readCachedCoverage(id) : null;
  const [cities, setCities] = useState(() => cached?.cities || []);
  const [names, setNames] = useState(() => cached?.names || []);
  const [coverage, setCoverage] = useState(
    () => cached?.coverage || { ...EMPTY_COVERAGE, queryKey: bookingCoverageQueryKey(id) }
  );
  const [orderRadiusKm, setOrderRadiusKm] = useState(
    () => cached?.orderRadiusKm ?? null
  );
  const [loadedCompanyId, setLoadedCompanyId] = useState(
    () => (cached ? id : "")
  );

  const queryKey = bookingCoverageQueryKey(
    companyId,
    coverage?.companyId && String(coverage.companyId) === String(companyId || "")
      ? coverage.version
      : ""
  );

  useEffect(() => {
    if (!id) {
      setCities([]);
      setNames([]);
      setCoverage({ ...EMPTY_COVERAGE, queryKey: bookingCoverageQueryKey("") });
      setOrderRadiusKm(null);
      setLoadedCompanyId("");
      return undefined;
    }

    const hit = readCachedCoverage(id);
    if (hit) {
      setCities(hit.cities);
      setNames(hit.names);
      setCoverage(hit.coverage);
      setOrderRadiusKm(hit.orderRadiusKm);
      setLoadedCompanyId(id);
      return undefined;
    }

    setCities([]);
    setNames([]);
    setCoverage({ ...EMPTY_COVERAGE, queryKey: bookingCoverageQueryKey(id) });
    setLoadedCompanyId("");
    setOrderRadiusKm(null);

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
        const payload = {
          cities: nextCities,
          names: nextNames,
          coverage: nextCoverage,
          orderRadiusKm:
            body.orderRadiusKm == null || body.orderRadiusKm === ""
              ? null
              : Number(body.orderRadiusKm),
        };
        writeCachedCoverage(id, payload);
        setCities(payload.cities);
        setNames(payload.names);
        setCoverage(payload.coverage);
        setLoadedCompanyId(id);
        setOrderRadiusKm(payload.orderRadiusKm);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

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
