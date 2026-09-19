import mongoose from "mongoose";
import PlatformCity from "@models/platformCity";
import { fallbackBookingLocationNames } from "@/domain/platform/bookingLocations";
import {
  haversineKm,
  isWithinOrderRadius,
  parseLatLon,
} from "@/domain/geo/haversineKm";

export function toPublicCity(city) {
  if (!city) return null;
  const coords = parseLatLon(city.coords);
  return {
    _id: String(city._id),
    name: city.name,
    slug: city.slug,
    country: city.country,
    kind: city.kind || "city",
    requiresAddressDetail: Boolean(city.requiresAddressDetail),
    searchText: city.searchText || "",
    sort: city.sort ?? 100,
    isActive: city.isActive !== false,
    coords: coords
      ? { lat: String(coords.lat), lon: String(coords.lon) }
      : city.coords?.lat && city.coords?.lon
        ? { lat: String(city.coords.lat), lon: String(city.coords.lon) }
        : null,
  };
}

function cityHasUsableCoords(city) {
  return Boolean(parseLatLon(city?.coords));
}

/**
 * Keep places that are inside orderRadiusKm of company base.
 * Places without coords stay (allowlist still applies) so incomplete
 * catalog data does not wipe the booking list.
 */
export function filterPlacesByOrderRadius(places, company) {
  const radius = company?.orderRadiusKm;
  const base = parseLatLon(company?.coords);
  if (radius == null || radius === "" || !base) return places || [];
  const r = Number(radius);
  if (!Number.isFinite(r) || r < 0) return places || [];

  return (places || []).filter((place) => {
    const point = parseLatLon(place?.coords);
    if (!point) return true;
    const km = haversineKm(base, point);
    return isWithinOrderRadius(r, km);
  });
}

export function mapCityToBookingPlace(city) {
  return {
    name: city.name,
    requiresAddressDetail: Boolean(city.requiresAddressDetail),
    slug: city.slug,
    kind: city.kind,
    coords: parseLatLon(city.coords),
    distanceKm: null,
  };
}

export async function listActiveCitiesForCountry(country) {
  const cities = await PlatformCity.find({
    country: String(country || "").toUpperCase(),
    isActive: { $ne: false },
  })
    .sort({ sort: 1, name: 1 })
    .lean();
  return (cities || []).map(toPublicCity);
}

export async function loadCompanyBookingCities(company) {
  if (!company) {
    return fallbackBookingLocationNames().map((name) => ({
      name,
      requiresAddressDetail: name.toLowerCase() === "thessaloniki",
    }));
  }

  const base = parseLatLon(company.coords);
  const radius = company.orderRadiusKm;

  const attachDistance = (place) => {
    const point = parseLatLon(place.coords);
    const distanceKm =
      base && point ? haversineKm(base, point) : place.distanceKm ?? null;
    return { ...place, distanceKm };
  };

  const ids = (company.cityIds || []).filter((id) =>
    mongoose.Types.ObjectId.isValid(String(id))
  );
  if (ids.length) {
    const cities = await PlatformCity.find({
      _id: { $in: ids },
      isActive: { $ne: false },
    })
      .sort({ sort: 1, name: 1 })
      .lean();
    if (cities.length) {
      const mapped = cities.map(mapCityToBookingPlace).map(attachDistance);
      return filterPlacesByOrderRadius(mapped, company);
    }
  }

  // No explicit cityIds: if radius set, offer catalog cities within radius
  if (
    radius != null &&
    radius !== "" &&
    Number.isFinite(Number(radius)) &&
    Number(radius) >= 0 &&
    base &&
    company.country
  ) {
    const catalog = await PlatformCity.find({
      country: String(company.country).toUpperCase(),
      isActive: { $ne: false },
    })
      .sort({ sort: 1, name: 1 })
      .lean();
    const within = catalog
      .map(mapCityToBookingPlace)
      .map(attachDistance)
      .filter((place) => {
        if (!cityHasUsableCoords(place)) return false;
        return isWithinOrderRadius(radius, place.distanceKm);
      });
    if (within.length) return within;
  }

  const embedded = (company.locations || [])
    .map((loc) => ({
      name: String(loc?.name || "").trim(),
      requiresAddressDetail:
        String(loc?.name || "").trim().toLowerCase() === "thessaloniki",
      coords: parseLatLon(loc?.coords),
    }))
    .filter((loc) => loc.name)
    .map(attachDistance);
  if (embedded.length) {
    return filterPlacesByOrderRadius(embedded, company);
  }

  return fallbackBookingLocationNames().map((name) => ({
    name,
    requiresAddressDetail: name.toLowerCase() === "thessaloniki",
  }));
}

export function toPublicCompanyStorefront(company, cities = []) {
  if (!company) return null;
  return {
    _id: String(company._id),
    name: company.name,
    slug: company.slug || "",
    tel: company.tel,
    tel2: company.tel2 || "",
    email: company.email,
    address: company.address,
    slogan: company.slogan || "",
    coords: company.coords || null,
    country: company.country || "",
    storefrontEnabled: company.storefrontEnabled !== false,
    listedOnMarketplace: company.listedOnMarketplace !== false,
    bufferTime: company.bufferTime,
    minRentalDuration: company.minRentalDuration,
    workingHours: company.workingHours,
    defaultStart: company.defaultStart,
    defaultEnd: company.defaultEnd,
    orderRadiusKm:
      company.orderRadiusKm == null || company.orderRadiusKm === ""
        ? null
        : Number(company.orderRadiusKm),
    deliveryPricePerKm: company.deliveryPricePerKm,
    bookingCities: cities,
  };
}
