import mongoose from "mongoose";
import { Car } from "@models/car";
import { Order } from "@models/order";
import Company from "@models/company";
import { isCarAvailableForSearchDates } from "@utils/carDateSearch";
import { COMPANY_ID } from "@config/company";
import { toBusinessDateTime } from "@/domain/orders/numberOfDays";
import { toBooleanField } from "@/domain/orders/fieldUtils";
import { resolveRentalBookingContext } from "@/domain/booking/resolveRentalContext";
import {
  calculateAuthoritativeRentalPrice,
  RentalPricingError,
} from "@/domain/orders/rentalPricingService";
import { getPlatformMarketplaceFeeSettings } from "@/domain/platform/platformSettingsService";
import { getSiteCountryCode } from "@config/siteCountry";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { parseLocationQuoteInput } from "@/domain/orders/locationQuoteInput";
import {
  LocationQuoteError,
  quoteAuthoritativeLocations,
} from "@/domain/orders/authoritativeLocationQuote";
import { orderFieldsFromSnapshot } from "@/domain/orders/locationSnapshot";
import {
  isMarketplaceOperatingCompany,
  isPublicMarketplaceCarAllowed,
} from "@/domain/legal/partnerOperatingPolicy";
import { resolveDefaultInsurance } from "@/domain/orders/defaultInsurance";

/**
 * Canonical public rental quote for one car + range.
 * Shared by the single-car endpoint and the SEARCH_FIRST catalog batch so
 * the card and the result list never invent a second total.
 *
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function quotePublicRentalCar(debugBody = {}) {
  const {
    carId,
    carNumber,
    regNumber,
    rentalStartDate,
    rentalEndDate,
    timeIn,
    timeOut,
    kacko,
    childSeats = 0,
    secondDriver = false,
    placeIn,
    placeOut,
    promoCode,
    placeInDetail,
    placeOutDetail,
    placeInLat,
    placeInLon,
    placeOutLat,
    placeOutLon,
    placeInLocality,
    placeOutLocality,
    location,
    pickupMethod,
    returnMethod,
    pickupOfficeId,
    returnOfficeId,
    pickupPlaceId,
    returnPlaceId,
    placeInId,
    placeOutId,
    sameReturnLocation,
    totalPrice: _clientTotal,
    currency: _clientCurrency,
    deliveryIn: _clientDeliveryIn,
    deliveryOut: _clientDeliveryOut,
    deliveryTotal: _clientDeliveryTotal,
    distanceKm: _clientDistanceKm,
  } = debugBody;
  void _clientTotal;
  void _clientCurrency;
  void _clientDeliveryIn;
  void _clientDeliveryOut;
  void _clientDeliveryTotal;
  void _clientDistanceKm;

  const calculationStartSource = timeIn ?? rentalStartDate;
  const calculationEndSource = timeOut ?? rentalEndDate;
  const normalizedSecondDriver = toBooleanField(secondDriver, false);
  const normalizedCarId = carId != null ? String(carId).trim() : "";
  const normalizedCarNumber =
    typeof carNumber === "string" ? carNumber.trim() : "";
  const normalizedRegNumber =
    typeof regNumber === "string" ? regNumber.trim() : "";
  if (!normalizedCarId && !normalizedRegNumber && !normalizedCarNumber) {
    return { status: 400, body: { message: "Missing parameters" } };
  }

  let car = null;
  if (normalizedCarId && mongoose.Types.ObjectId.isValid(normalizedCarId)) {
    car = await Car.findById(normalizedCarId);
  }
  if (!car && normalizedCarNumber) {
    car = await Car.findOne({ carNumber: normalizedCarNumber });
  }
  if (!car && normalizedRegNumber) {
    car = await Car.findOne({ regNumber: normalizedRegNumber });
  }

  if (!car) {
    return { status: 404, body: { message: "Car not found" } };
  }

  const company = car.ownerId
    ? await Company.findById(car.ownerId).lean()
    : await Company.findById(COMPANY_ID).lean();

  if (
    isMarketplaceOperatingCompany(company) &&
    !(await isPublicMarketplaceCarAllowed({ car, company }))
  ) {
    return { status: 404, body: { message: "Car not found" } };
  }

  const insurance =
    kacko != null && String(kacko).trim()
      ? kacko
      : resolveDefaultInsurance(car);

  const rentalContext = resolveRentalBookingContext({
    company,
    countryCode: company?.country || getSiteCountryCode(),
    forNewOrder: true,
  });

  const startDate = toBusinessDateTime(
    calculationStartSource,
    rentalContext.timezone
  );
  const endDate = toBusinessDateTime(
    calculationEndSource,
    rentalContext.timezone
  );
  if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
    return { status: 400, body: { message: "Missing parameters" } };
  }

  const marketplace = isMarketplaceRequestMode(rentalContext.bookingMode);
  const locationInput = parseLocationQuoteInput({
    location,
    pickupMethod,
    returnMethod,
    pickupOfficeId,
    returnOfficeId,
    pickupPlaceId,
    returnPlaceId,
    placeInId,
    placeOutId,
    sameReturnLocation,
  });

  let placeInForPrice = placeIn;
  let placeOutForPrice = placeOut;
  let placeInDetailForPrice = placeInDetail;
  let placeOutDetailForPrice = placeOutDetail;
  let quotedPickupFeeMinor;
  let quotedReturnFeeMinor;
  let locationSnapshot = null;
  let eligibleOffices;

  if (
    marketplace &&
    (locationInput.pickup.kind ||
      locationInput.pickup.officeId ||
      locationInput.pickup.placeId ||
      locationInput.dropoff.kind ||
      locationInput.dropoff.officeId ||
      locationInput.dropoff.placeId)
  ) {
    try {
      const locationQuote = await quoteAuthoritativeLocations({
        car,
        company,
        pickup: {
          kind: locationInput.pickup.kind || "delivery",
          officeId: locationInput.pickup.officeId,
          placeId: locationInput.pickup.placeId,
        },
        dropoff: {
          kind: locationInput.dropoff.kind || locationInput.pickup.kind || "delivery",
          officeId: locationInput.dropoff.officeId,
          placeId: locationInput.dropoff.placeId,
          sameAsPickup: locationInput.dropoff.sameAsPickup,
        },
        language: debugBody.language,
        sessionToken: debugBody.sessionToken,
      });
      locationSnapshot = locationQuote.snapshot;
      eligibleOffices = locationQuote.eligibleOffices;
      const fields = orderFieldsFromSnapshot(locationSnapshot);
      placeInForPrice = fields.placeIn || placeInForPrice;
      placeOutForPrice = fields.placeOut || placeOutForPrice;
      placeInDetailForPrice = fields.placeInDetail || placeInDetailForPrice;
      placeOutDetailForPrice = fields.placeOutDetail || placeOutDetailForPrice;
      quotedPickupFeeMinor = Math.round(
        (Number(locationSnapshot.pickup?.feeMajor) || 0) * 100
      );
      quotedReturnFeeMinor = Math.round(
        (Number(locationSnapshot.return?.feeMajor) || 0) * 100
      );
    } catch (err) {
      if (err instanceof LocationQuoteError) {
        return {
          status: err.code === "PLACES_UNAVAILABLE" ? 503 : 400,
          body: { message: err.message, code: err.code },
        };
      }
      throw err;
    }
  }

  try {
    const quote = await calculateAuthoritativeRentalPrice({
      car,
      pickupAtUtc: startDate.utc().toDate(),
      returnAtUtc: endDate.utc().toDate(),
      timezone: rentalContext.timezone,
      insurance,
      childSeats,
      secondDriver: normalizedSecondDriver,
      placeIn: placeInForPrice,
      placeOut: placeOutForPrice,
      placeInDetail: placeInDetailForPrice,
      placeOutDetail: placeOutDetailForPrice,
      placeInLat: marketplace ? undefined : placeInLat,
      placeInLon: marketplace ? undefined : placeInLon,
      placeOutLat: marketplace ? undefined : placeOutLat,
      placeOutLon: marketplace ? undefined : placeOutLon,
      placeInLocality: marketplace ? undefined : placeInLocality,
      placeOutLocality: marketplace ? undefined : placeOutLocality,
      carOffices: eligibleOffices,
      company,
      platformSettings: await getPlatformMarketplaceFeeSettings(),
      bookingMode: rentalContext.bookingMode,
      promoCode,
      ignoreClientGeo: marketplace,
      quotedPickupFeeMinor,
      quotedReturnFeeMinor,
    });

    const blockingOrders = await Order.find({ car: car._id })
      .select(
        "rentalStartDate rentalEndDate timeIn timeOut confirmed offline bookingStatus status"
      )
      .lean();
    const available = isCarAvailableForSearchDates({
      orders: blockingOrders,
      start: startDate.toDate(),
      end: endDate.toDate(),
      company,
      platform: { country: company?.country || getSiteCountryCode() },
    });

    return {
      status: 200,
      body: {
        totalPrice: quote.compatibility.totalPrice,
        days: quote.rentalDays,
        available,
        currency: quote.currency,
        timezone: rentalContext.timezone,
        bookingMode: rentalContext.bookingMode,
        grossMinor: quote.grossMinor,
        breakdown: quote.compatibility.breakdown,
        locationSnapshot: locationSnapshot || undefined,
        authoritativePrice: {
          currency: quote.currency,
          rentalDays: quote.rentalDays,
          baseRentalMinor: quote.baseRentalMinor,
          discountMinor: quote.discountMinor,
          insuranceMinor: quote.insuranceMinor,
          extrasMinor: quote.extrasMinor,
          pickupFeeMinor: quote.pickupFeeMinor,
          returnFeeMinor: quote.returnFeeMinor,
          grossMinor: quote.grossMinor,
          marketplaceBookingFeeBps: quote.marketplaceBookingFeeBps,
          feePercent: quote.feePercent,
          prepaymentPercent: quote.prepaymentPercent,
          prepaymentMinor: quote.prepaymentMinor,
          balanceMinor: quote.balanceMinor,
          platformAmountMinor: quote.platformAmountMinor,
          stripeAmountMinor: quote.stripeAmountMinor,
          supplierBalanceMinor: quote.supplierBalanceMinor,
          payoutMinor: quote.payoutMinor,
          pricingVersion: quote.pricingVersion,
        },
      },
    };
  } catch (error) {
    if (error instanceof RentalPricingError) {
      return {
        status: 400,
        body: { message: error.message, code: error.code },
      };
    }
    throw error;
  }
}

export function jsonResponse({ status, body }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
