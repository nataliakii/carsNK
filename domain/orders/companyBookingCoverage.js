/**
 * Customer-bookable pickup/return coverage for one company.
 *
 * Offices and delivery areas come only from that company's saved records.
 * The platform city catalog and the legacy Halkidiki list are not options.
 */

import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { foldCityText } from "@/domain/geo/cityLookupOptions";
import { parseLatLon } from "@/domain/geo/haversineKm";
import {
  hasStructuredServiceAreas,
  inferProvinceCodeFromLocation,
  spainCitiesInServiceAreas,
} from "@/domain/geo/spainPlaceCoverage";
import { resolveEligibleOffices } from "@/domain/company/officeRecord";
import { normalizeOfficeKey } from "@/domain/company/officeConstants";
import { ORDERED_LOCATION_OPTIONS } from "@/domain/orders/locationOptions";
import { SPAIN_CITY_OPTIONS } from "@/domain/orders/spainCityOptions";

export const COVERAGE_ERROR = Object.freeze({
  LOCATION_OUTSIDE_COMPANY_COVERAGE: "LOCATION_OUTSIDE_COMPANY_COVERAGE",
  OFFICE_NOT_OWNED_BY_COMPANY: "OFFICE_NOT_OWNED_BY_COMPANY",
  LOCATION_COUNTRY_MISMATCH: "LOCATION_COUNTRY_MISMATCH",
  DELIVERY_NOT_AVAILABLE: "DELIVERY_NOT_AVAILABLE",
});

export const CUSTOMER_LOCATION_UNAVAILABLE =
  "This location is not available for this vehicle. Choose another location or select office pickup.";

const GREEK_LOCATION_KEYS = new Set(
  ORDERED_LOCATION_OPTIONS.map((name) => foldCityText(name))
);
const SPANISH_LOCATION_KEYS = new Set(
  SPAIN_CITY_OPTIONS.map((name) => foldCityText(name))
);

export function bookingCoverageQueryKey(companyId, version) {
  return [
    "booking-coverage",
    String(companyId || ""),
    version == null || version === "" ? "" : String(version),
  ];
}

export function addressOutsideCoverageMessage(areaNames) {
  const names = (Array.isArray(areaNames) ? areaNames : [])
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  const where = names.length ? names.join(", ") : "the supplier’s delivery area";
  return `This address is outside this supplier’s delivery area. Choose an address in ${where} or select office pickup.`;
}

function countryCodeOf(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/** Implied country for a well-known legacy label. Empty when the name is not in either list. */
export function impliedLocationCountry(name) {
  const key = foldCityText(name);
  if (!key) return "";
  const spanish = SPANISH_LOCATION_KEYS.has(key);
  const greek = GREEK_LOCATION_KEYS.has(key);
  if (spanish && !greek) return "ES";
  if (greek && !spanish) return "GR";
  if (spanish && greek) return "";

  let grHit = false;
  let esHit = false;
  for (const label of ORDERED_LOCATION_OPTIONS) {
    if (foldCityText(label) === "airport") continue;
    if (mentionsName(name, label)) grHit = true;
  }
  for (const label of SPAIN_CITY_OPTIONS) {
    if (mentionsName(name, label)) esHit = true;
  }
  if (grHit && !esHit) return "GR";
  if (esHit && !grHit) return "ES";
  return "";
}

function areaId(countryCode, name, explicitId) {
  const id = String(explicitId || "").trim();
  if (id) return id;
  return `${countryCode}:${foldCityText(name)}`;
}

function mentionsName(text, name) {
  const needle = foldCityText(name);
  if (!needle) return false;
  const hay = foldCityText(String(text || "").replace(/[,./]/g, " "));
  if (!hay) return false;
  if (hay === needle) return true;
  return ` ${hay} `.includes(` ${needle} `);
}

function pushArea(bucket, seen, area) {
  const countryCode = countryCodeOf(area?.countryCode);
  const name = String(area?.name || "").trim();
  if (!countryCode || !name) return;
  const implied = impliedLocationCountry(name);
  if (implied && implied !== countryCode) return;
  const id = areaId(countryCode, name, area.id);
  const key = `${countryCode}:${foldCityText(name)}`;
  if (seen.has(key)) return;
  seen.add(key);
  const provinceCode =
    area.provinceCode ||
    (countryCode === "ES"
      ? inferProvinceCodeFromLocation({ city: name, placeName: name })
      : "") ||
    "";
  bucket.push({
    id,
    name,
    countryCode,
    provinceCode: provinceCode || "",
    kind: area.kind || (foldCityText(name).includes("airport") ? "airport" : "city"),
    coords: parseLatLon(area.coords) || null,
  });
}

function explicitSavedNames(company) {
  const fromPricing = normalizeOperatingCities(
    company?.deliveryPricing?.operatingCities
  );
  const fromLocations = (Array.isArray(company?.locations) ? company.locations : [])
    .map((loc) => String(loc?.name || "").trim())
    .filter(Boolean);
  return { fromPricing, fromLocations };
}

/**
 * @param {{ company?: object, car?: object, catalogCities?: object[] }} input
 * @returns {{
 *   companyId: string,
 *   countryCode: string,
 *   version: string,
 *   offices: object[],
 *   deliveryAreas: object[],
 *   deliveryAvailable: boolean,
 *   queryKey: string[],
 * }}
 */
export function resolveCompanyBookingCoverage({
  company,
  car,
  catalogCities,
} = {}) {
  const countryCode = countryCodeOf(company?.country);
  const companyId = String(company?._id || car?.ownerId || "");
  const version = String(
    company?.deliveryPricing?.version ?? company?.updatedAt ?? ""
  );
  const offices = resolveEligibleOffices({ car, company })
    .filter((office) => {
      const officeCountry = countryCodeOf(office?.country);
      if (!countryCode) return true;
      if (!officeCountry) return true;
      return officeCountry === countryCode;
    })
    .map((office) => ({
      id:
        String(office._id || office.id || "") ||
        `office:${countryCode}:${foldCityText(office.publicName || office.name)}`,
      name: office.publicName || office.name || "",
      address: office.address || "",
      city: office.city || "",
      countryCode: countryCodeOf(office.country) || countryCode,
      provinceCode: office.provinceCode || "",
      locationType: office.locationType || "office",
      lat: office.lat || "",
      lon: office.lon || "",
      collectionInstructions: office.collectionInstructions || "",
      returnInstructions: office.returnInstructions || "",
      freePickup: office.freePickup !== false,
      freeReturn: office.freeReturn !== false,
    }))
    .filter((office) => office.id && office.name);

  const deliveryAreas = [];
  const seen = new Set();
  const { fromPricing, fromLocations } = explicitSavedNames(company);
  const hasExplicitCities =
    fromPricing.length > 0 ||
    (Array.isArray(company?.cityIds) && company.cityIds.length > 0);

  for (const name of fromPricing) {
    pushArea(deliveryAreas, seen, { name, countryCode });
  }

  const idSet = new Set((company?.cityIds || []).map((id) => String(id)));
  if (idSet.size) {
    for (const city of catalogCities || []) {
      if (!idSet.has(String(city?._id || city?.id || ""))) continue;
      const cityCountry = countryCodeOf(city?.country) || countryCode;
      if (countryCode && cityCountry && cityCountry !== countryCode) continue;
      pushArea(deliveryAreas, seen, {
        id: String(city._id || city.id),
        name: city.name,
        countryCode: cityCountry,
        kind: city.kind,
        coords: city.coords,
      });
    }
  }

  if (!hasExplicitCities) {
    for (const name of fromLocations) {
      const loc = (company.locations || []).find(
        (row) => foldCityText(row?.name) === foldCityText(name)
      );
      const locCountry = countryCodeOf(loc?.country) || countryCode;
      if (countryCode && locCountry && locCountry !== countryCode) continue;
      pushArea(deliveryAreas, seen, {
        name,
        countryCode: locCountry,
        coords: loc?.coords,
      });
    }
  }

  if (
    !deliveryAreas.length &&
    countryCode === "ES" &&
    hasStructuredServiceAreas(company?.serviceAreas)
  ) {
    for (const name of spainCitiesInServiceAreas(company.serviceAreas)) {
      pushArea(deliveryAreas, seen, { name, countryCode: "ES" });
    }
  }

  deliveryAreas.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return {
    companyId,
    countryCode,
    version,
    offices,
    deliveryAreas,
    deliveryAvailable: deliveryAreas.length > 0,
    queryKey: bookingCoverageQueryKey(companyId, version),
  };
}

export function findDeliveryArea(coverage, { id, name } = {}) {
  const areas = coverage?.deliveryAreas || [];
  const idKey = String(id || "").trim();
  if (idKey) {
    const byId = areas.find((area) => area.id === idKey);
    if (byId) return byId;
  }
  const nameKey = foldCityText(name);
  if (!nameKey) return null;
  return areas.find((area) => foldCityText(area.name) === nameKey) || null;
}

export function findCoverageOffice(coverage, officeId) {
  const id = String(officeId || "").trim();
  if (!id) return null;
  return (coverage?.offices || []).find((office) => office.id === id) || null;
}

function fail(code, message) {
  return { ok: false, code, message: message || CUSTOMER_LOCATION_UNAVAILABLE };
}

export function assertOfficeInCompanyCoverage(coverage, officeId) {
  if (!coverage?.companyId && !(coverage?.offices || []).length) {
    return fail(COVERAGE_ERROR.OFFICE_NOT_OWNED_BY_COMPANY);
  }
  const office = findCoverageOffice(coverage, officeId);
  if (!office) return fail(COVERAGE_ERROR.OFFICE_NOT_OWNED_BY_COMPANY);
  if (
    office.countryCode &&
    coverage.countryCode &&
    office.countryCode !== coverage.countryCode
  ) {
    return fail(COVERAGE_ERROR.LOCATION_COUNTRY_MISMATCH);
  }
  return { ok: true, office };
}

/**
 * Delivery city and, when present, the verified address must sit in this
 * company's saved coverage. Google returning a place is not enough.
 */
export function assertDeliveryInCompanyCoverage(
  coverage,
  { id, name, countryCode, locality, address } = {}
) {
  if (!coverage?.deliveryAvailable || !(coverage.deliveryAreas || []).length) {
    return fail(COVERAGE_ERROR.DELIVERY_NOT_AVAILABLE);
  }
  const placeCountry = countryCodeOf(countryCode);
  if (placeCountry && coverage.countryCode && placeCountry !== coverage.countryCode) {
    return fail(COVERAGE_ERROR.LOCATION_COUNTRY_MISMATCH);
  }
  const implied = impliedLocationCountry(name || locality);
  if (implied && coverage.countryCode && implied !== coverage.countryCode) {
    return fail(COVERAGE_ERROR.LOCATION_COUNTRY_MISMATCH);
  }
  const area = findDeliveryArea(coverage, { id, name: name || locality });
  if (!area) return fail(COVERAGE_ERROR.LOCATION_OUTSIDE_COMPANY_COVERAGE);
  if (
    area.countryCode &&
    coverage.countryCode &&
    area.countryCode !== coverage.countryCode
  ) {
    return fail(COVERAGE_ERROR.LOCATION_COUNTRY_MISMATCH);
  }
  const localityText = String(locality || "").trim();
  const addressText = String(address || "").trim();
  if (localityText && !mentionsName(localityText, area.name)) {
    return fail(
      COVERAGE_ERROR.LOCATION_OUTSIDE_COMPANY_COVERAGE,
      addressOutsideCoverageMessage([area.name])
    );
  }
  const otherCity = otherKnownCityInText(
    addressText,
    area.name,
    coverage.countryCode
  );
  if (otherCity) {
    return fail(
      COVERAGE_ERROR.LOCATION_OUTSIDE_COMPANY_COVERAGE,
      addressOutsideCoverageMessage([area.name])
    );
  }
  if (
    addressText &&
    !mentionsName(addressText, area.name) &&
    !(localityText && mentionsName(localityText, area.name))
  ) {
    return fail(
      COVERAGE_ERROR.LOCATION_OUTSIDE_COMPANY_COVERAGE,
      addressOutsideCoverageMessage([area.name])
    );
  }
  return { ok: true, area };
}

function otherKnownCityInText(text, areaName, countryCode) {
  if (!text) return "";
  const lists = countryCode === "GR" ? ORDERED_LOCATION_OPTIONS : SPAIN_CITY_OPTIONS;
  const foreign =
    countryCode === "GR" ? SPAIN_CITY_OPTIONS : ORDERED_LOCATION_OPTIONS;
  for (const name of foreign) {
    if (foldCityText(name) === "airport") continue;
    if (mentionsName(text, name)) return name;
  }
  for (const name of lists) {
    if (foldCityText(name) === foldCityText(areaName)) continue;
    if (foldCityText(name) === "airport") continue;
    if (mentionsName(text, name)) return name;
  }
  return "";
}

export function reconcileBookingSelection(selection, coverage) {
  const method = selection?.method === "office" ? "office" : "delivery";
  if (method === "office") {
    const office =
      findCoverageOffice(coverage, selection?.officeId) ||
      (coverage?.offices || [])[0] ||
      null;
    if (!office) {
      return { method: "office", officeId: "", areaId: "", areaName: "", valid: false };
    }
    return {
      method: "office",
      officeId: office.id,
      areaId: "",
      areaName: office.name,
      valid: true,
    };
  }
  const area = findDeliveryArea(coverage, {
    id: selection?.areaId,
    name: selection?.areaName,
  });
  if (!area) {
    const only = (coverage?.deliveryAreas || []).length === 1
      ? coverage.deliveryAreas[0]
      : null;
    if (!only) {
      return { method: "delivery", officeId: "", areaId: "", areaName: "", valid: false };
    }
    return {
      method: "delivery",
      officeId: "",
      areaId: only.id,
      areaName: only.name,
      valid: true,
    };
  }
  return {
    method: "delivery",
    officeId: "",
    areaId: area.id,
    areaName: area.name,
    valid: true,
  };
}

export function sameReturnFromPickup(pickup) {
  if (!pickup?.valid) {
    return { method: "delivery", officeId: "", areaId: "", areaName: "", valid: false };
  }
  return { ...pickup };
}

export function deliveryPricingOfCompany(company) {
  return company?.deliveryPricing || null;
}

export function predictionInsideCoverage(prediction, coverage, selectedAreaName) {
  const areaName = String(selectedAreaName || "").trim();
  if (!areaName) return false;
  if (!findDeliveryArea(coverage, { name: areaName })) return false;
  const text = [
    prediction?.description,
    prediction?.mainText,
    prediction?.secondaryText,
    prediction?.address,
  ]
    .filter(Boolean)
    .join(" ");
  return mentionsName(text, areaName);
}

export function coverageAreaNames(coverage) {
  return (coverage?.deliveryAreas || []).map((area) => area.name);
}

export function normalizeOfficeKeyForCoverage(value) {
  return normalizeOfficeKey(value);
}
