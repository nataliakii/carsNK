import { fetchPlaceDetails, placeCountryCode } from "@/domain/geo/googlePlaces";
import { calculateDeliveryPrice } from "@/domain/delivery/calculateDeliveryPrice";
import {
  findEligibleOffice,
  resolveEligibleOffices,
} from "@/domain/company/officeRecord";
import {
  LOCATION_KIND,
  buildLocationLeg,
  buildLocationSnapshot,
} from "@/domain/orders/locationSnapshot";

export class LocationQuoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "LocationQuoteError";
    this.code = code;
  }
}

function ignoreClientGeo(client) {
  return {
    lat: undefined,
    lon: undefined,
    fee: undefined,
    distanceKm: undefined,
  };
}

async function resolveDeliveryPlace({ placeId, language, sessionToken, country }) {
  const id = String(placeId || "").trim();
  if (!id) {
    throw new LocationQuoteError(
      "UNVERIFIED_ADDRESS",
      "Choose an address from the suggestions. A typed address cannot be priced."
    );
  }
  const details = await fetchPlaceDetails({
    placeId: id,
    language,
    sessionToken,
  });
  if (!details.configured || details.unavailable) {
    throw new LocationQuoteError(
      "PLACES_UNAVAILABLE",
      "Address search is temporarily unavailable. Please choose a company office or try again later."
    );
  }
  if (!details.ok) {
    throw new LocationQuoteError(
      "PLACE_RESOLVE_FAILED",
      details.message || "That address could not be verified."
    );
  }
  const expectedCountry = placeCountryCode(country);
  const placeCountry = placeCountryCode(details.country);
  if (
    expectedCountry &&
    placeCountry &&
    expectedCountry !== placeCountry
  ) {
    throw new LocationQuoteError(
      "UNSUPPORTED_AREA",
      "That address is outside the supported country."
    );
  }
  return {
    placeId: details.placeId,
    address: details.address,
    lat: details.lat,
    lon: details.lon,
    locality: details.locality,
    country: details.country || "",
  };
}

function assertOfficeAllowed(office, companyId) {
  if (!office) {
    throw new LocationQuoteError("UNKNOWN_OFFICE", "That office is not available for this car.");
  }
  if (office.companyId && String(office.companyId) !== String(companyId)) {
    throw new LocationQuoteError("OFFICE_FORBIDDEN", "That office belongs to another company.");
  }
}

/**
 * Server-authoritative pickup/return quote.
 * Client lat/lon/fee/distance are ignored.
 */
export async function quoteAuthoritativeLocations({
  car,
  company,
  pickup,
  dropoff,
  language,
  sessionToken,
} = {}) {
  if (!car || !company) {
    throw new LocationQuoteError("CAR_REQUIRED", "Car and company are required.");
  }
  const companyId = String(car.ownerId || company._id);
  if (String(company._id) !== companyId) {
    throw new LocationQuoteError("OFFICE_FORBIDDEN", "Car does not belong to this company.");
  }

  const eligible = resolveEligibleOffices({ car, company });
  ignoreClientGeo(pickup);
  ignoreClientGeo(dropoff);

  const sameReturn = Boolean(dropoff?.sameAsPickup);
  const pickupKind =
    String(pickup?.kind || "").toLowerCase() === LOCATION_KIND.OFFICE
      ? LOCATION_KIND.OFFICE
      : LOCATION_KIND.DELIVERY;
  const returnKind = sameReturn
    ? pickupKind
    : String(dropoff?.kind || "").toLowerCase() === LOCATION_KIND.OFFICE
      ? LOCATION_KIND.OFFICE
      : LOCATION_KIND.DELIVERY;

  let pickupOffice = null;
  let returnOffice = null;
  let pickupPlace = null;
  let returnPlace = null;

  if (pickupKind === LOCATION_KIND.OFFICE) {
    pickupOffice = pickup?.officeId
      ? findEligibleOffice(eligible, pickup.officeId)
      : eligible[0] || null;
    assertOfficeAllowed(pickupOffice, companyId);
  } else {
    pickupPlace = await resolveDeliveryPlace({
      placeId: pickup?.placeId,
      language,
      sessionToken,
      country: company.country,
    });
  }

  if (returnKind === LOCATION_KIND.OFFICE) {
    returnOffice = sameReturn
      ? pickupOffice
      : dropoff?.officeId
        ? findEligibleOffice(eligible, dropoff.officeId)
        : eligible[0] || null;
    assertOfficeAllowed(returnOffice, companyId);
  } else if (sameReturn) {
    returnPlace = pickupPlace;
  } else {
    returnPlace = await resolveDeliveryPlace({
      placeId: dropoff?.placeId,
      language,
      sessionToken,
      country: company.country,
    });
  }

  const delivery = await calculateDeliveryPrice({
    placeIn:
      pickupKind === LOCATION_KIND.OFFICE
        ? pickupOffice.name
        : pickupPlace.locality || pickupPlace.address,
    placeOut:
      returnKind === LOCATION_KIND.OFFICE
        ? returnOffice.name
        : returnPlace.locality || returnPlace.address,
    companyId,
    carOffices: eligible,
    placeInDetail: pickupPlace?.address || "",
    placeOutDetail: returnPlace?.address || "",
    placeInLat: pickupPlace?.lat,
    placeInLon: pickupPlace?.lon,
    placeOutLat: returnPlace?.lat,
    placeOutLon: returnPlace?.lon,
    placeInLocality: pickupPlace?.locality,
    placeOutLocality: returnPlace?.locality,
  });

  if (delivery?.deliveryBlockedIn || delivery?.deliveryBlockedOut) {
    throw new LocationQuoteError(
      "UNSUPPORTED_AREA",
      "Delivery is not available at that location."
    );
  }

  const pickupLeg = buildLocationLeg({
    kind: pickupKind,
    office: pickupOffice,
    place: pickupPlace,
    feeMajor: pickupKind === LOCATION_KIND.OFFICE ? 0 : Number(delivery.deliveryIn) || 0,
    distanceKm: delivery.pickupMeta?.distanceKm ?? delivery.inResult?.distanceKm,
    ruleId: company.deliveryPricing?.strategy || "zones",
    ruleVersion: String(company.deliveryPricing?.version ?? ""),
    blocked: Boolean(delivery.inResult?.blocked),
  });
  const returnLeg = buildLocationLeg({
    kind: returnKind,
    office: returnOffice,
    place: returnPlace,
    feeMajor: returnKind === LOCATION_KIND.OFFICE ? 0 : Number(delivery.deliveryOut) || 0,
    distanceKm: delivery.returnMeta?.distanceKm ?? delivery.outResult?.distanceKm,
    ruleId: company.deliveryPricing?.strategy || "zones",
    ruleVersion: String(company.deliveryPricing?.version ?? ""),
    blocked: Boolean(delivery.outResult?.blocked),
  });

  return {
    ok: true,
    snapshot: buildLocationSnapshot({
      pickup: pickupLeg,
      dropoff: returnLeg,
      currency: "EUR",
      pricingVersion: String(company.deliveryPricing?.version ?? ""),
    }),
    delivery,
    eligibleOffices: eligible,
  };
}
