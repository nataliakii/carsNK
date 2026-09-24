import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { Car } from "@models/car";
import {
  assertDeliveryInCompanyCoverage,
  resolveCompanyBookingCoverage,
} from "@/domain/orders/companyBookingCoverage";
import { placeCountryCode } from "@/domain/geo/googlePlaces";
import {
  consumePublicPostOrError,
  placesAutocompleteRateLimitOptions,
} from "@/services/publicPostRateLimit";
import { fetchPlaceDetails } from "@/domain/geo/googlePlaces";
import {
  evaluateOutsideCity,
  resolveCityRadiusKm,
} from "@/domain/geo/outsideCityDelivery";
import { loadCompanyBookingCities } from "@/domain/platform/companyBookingCities";
import { normalizeOfficeKey } from "@/domain/orders/carOffices";
import {
  computeCityStrategyLegPrice,
  resolveDeliveryStrategy,
  resolveNearestOfficePoint,
} from "@/domain/delivery/cityDeliveryPricing";
import { getDistanceFromBase } from "@/domain/transfers/getTransferDistance";
import { haversineKm, parseLatLon } from "@/domain/geo/haversineKm";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const limited = await consumePublicPostOrError(
    request,
    placesAutocompleteRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const placeId = String(body.placeId || "").trim();
  if (!placeId) {
    return NextResponse.json(
      { success: false, message: "placeId is required" },
      { status: 400 }
    );
  }

  const details = await fetchPlaceDetails({
    placeId,
    language: body.language,
    sessionToken: body.sessionToken,
  });

  if (!details.configured) {
    return NextResponse.json({
      success: false,
      configured: false,
      message: details.message || "Places API not configured",
    });
  }

  if (!details.ok) {
    return NextResponse.json({
      success: false,
      configured: true,
      message: details.message || "Place details failed",
    });
  }

  // Geocode-only callers (e.g. company base location picker) just need lat/lon
  // and must not pay for the company lookup + Directions call below.
  if (body.coordsOnly === true) {
    return NextResponse.json({
      success: true,
      configured: true,
      placeId: details.placeId,
      address: details.address,
      lat: details.lat,
      lon: details.lon,
      locality: details.locality || "",
    });
  }

  const companyIdRaw = String(body.companyId || "").trim();
  const companyId =
    companyIdRaw && mongoose.Types.ObjectId.isValid(companyIdRaw)
      ? companyIdRaw
      : "";

  let company = null;
  let carOffices = [];
  let cityCoords = null;
  try {
    await connectToDB();
    company = await Company.findById(companyId)
      .select(
        "coords address orderRadiusKm deliveryPricing deliveryPricePerKm country cityIds locations name offices serviceAreas"
      )
      .lean();
    const cityName = String(body.cityName || "").trim();
    if (company) {
      const coverage = resolveCompanyBookingCoverage({ company });
      const coverageCheck = assertDeliveryInCompanyCoverage(coverage, {
        name: cityName || details.locality,
        countryCode: placeCountryCode(details.country),
        locality: details.locality,
        address: details.address,
      });
      if (!coverageCheck.ok) {
        return NextResponse.json({
          success: false,
          configured: true,
          code: coverageCheck.code,
          message: coverageCheck.message,
          placeId: details.placeId,
          address: details.address,
          locality: details.locality || "",
          selectable: false,
        });
      }
    }
    if (company && cityName) {
      const cities = await loadCompanyBookingCities(company);
      const match = cities.find(
        (c) => normalizeOfficeKey(c.name) === normalizeOfficeKey(cityName)
      );
      cityCoords = match?.coords || null;
    }
    const carId = String(body.carId || "").trim();
    if (carId && mongoose.Types.ObjectId.isValid(carId)) {
      const car = await Car.findById(carId).select("offices").lean();
      carOffices = car?.offices || [];
    }
  } catch (err) {
    console.error("[places/resolve] company lookup:", err?.message || err);
  }

  const cityRadiusKm = resolveCityRadiusKm(company);
  const outside = evaluateOutsideCity(
    { lat: details.lat, lon: details.lon },
    cityCoords,
    cityRadiusKm
  );

  const strategy = resolveDeliveryStrategy(company?.deliveryPricing);
  const perKm =
    company?.deliveryPricing?.outside?.amount != null
      ? Number(company.deliveryPricing.outside.amount)
      : Number(company?.deliveryPricePerKm) || 1;

  let distanceFromBaseKm = null;
  let approximate = true;
  const nearest = resolveNearestOfficePoint({
    addressCoords: { lat: details.lat, lon: details.lon },
    carOffices,
    company,
  });
  if (nearest && details.lat != null && details.lon != null) {
    try {
      const google = await getDistanceFromBase({
        baseCoords: nearest,
        place: details.address,
        country: company?.country,
      });
      if (google?.ok && Number.isFinite(Number(google.distanceKm))) {
        distanceFromBaseKm = Number(google.distanceKm);
        approximate = Boolean(google.approximate);
      }
    } catch {
      /* fall through */
    }
    if (distanceFromBaseKm == null) {
      distanceFromBaseKm = haversineKm(
        parseLatLon({ lat: details.lat, lon: details.lon }),
        nearest
      );
      approximate = true;
    }
  }

  let deliveryFeeEstimate = null;
  let deliveryBlocked = false;
  let region = null;
  let chargeableKm = null;
  let explanation = null;

  if (strategy === "cities" && company?.deliveryPricing) {
    const leg = computeCityStrategyLegPrice({
      policy: company.deliveryPricing,
      placeName: body.cityName,
      address: details.address,
      locality: details.locality,
      addressCoords: { lat: details.lat, lon: details.lon },
      distanceFromOfficeKm: distanceFromBaseKm,
      carOffices,
      company,
      fallbackPerKm: perKm,
    });
    deliveryFeeEstimate = leg.price;
    deliveryBlocked = Boolean(leg.blocked);
    region = leg.region;
    chargeableKm = leg.chargeableKm;
    if (leg.region === "outside_city" && leg.chargeableKm > 0) {
      explanation = {
        km: leg.chargeableKm,
        perKm: leg.perKmRate,
        city: String(body.cityName || "").trim(),
      };
    }
  } else if (outside.outsideCity === true && distanceFromBaseKm != null) {
    deliveryFeeEstimate = Math.round(distanceFromBaseKm * perKm * 100) / 100;
    region = "outside_city";
    chargeableKm = distanceFromBaseKm;
    explanation = {
      km: distanceFromBaseKm,
      perKm,
      city: String(body.cityName || "").trim(),
    };
  } else if (outside.outsideCity === false) {
    deliveryFeeEstimate = 0;
    region = "inside_city";
  }

  return NextResponse.json({
    success: true,
    configured: true,
    placeId: details.placeId,
    address: details.address,
    lat: details.lat,
    lon: details.lon,
    locality: details.locality || "",
    outsideCity:
      region === "inside_city"
        ? false
        : region === "outside_city" || region === "beyond_max"
          ? true
          : outside.outsideCity,
    distanceFromCityKm: outside.distanceFromCityKm,
    cityRadiusKm: outside.cityRadiusKm,
    distanceFromBaseKm,
    deliveryFeeEstimate,
    deliveryBlocked,
    approximate,
    strategy,
    region,
    chargeableKm,
    explanation,
  });
}
