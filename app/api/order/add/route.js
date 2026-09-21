import mongoose from "mongoose";
import { Car } from "@models/car";
import { Order } from "@models/order";
import { User } from "@models/user";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isBetween from "dayjs/plugin/isBetween";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@lib/authOptions";
import { setTimeToDatejs } from "@utils/analyzeDates";
import { notifyOrderAction } from "@/domain/orders/orderNotificationDispatcher";
import {
  getBusinessRentalDaysByMinutes,
  toBusinessDateTime,
} from "@/domain/orders/numberOfDays";
import { connectToDB } from "@lib/database";
import { orderGuard } from "@/middleware/orderGuard";
import { normalizeLocale } from "@domain/locationSeo/locationSeoService";
import { generateOrderNumber } from "@/domain/time/athensTime";
import { isOrderBookingRequestFromLocalhost } from "@/lib/http/orderRequestLocalhost";
import { isValidInternationalPhone } from "@/domain/validation/internationalPhone";
import {
  canonicalizeBookingLocation,
  isAllowedBookingLocation,
  locationRequiresAddressDetail,
} from "@/domain/platform/bookingLocations";
import { loadCompanyBookingCities } from "@/domain/platform/companyBookingCities";
import { resolveAllowedCustomerPlaceNames } from "@/domain/orders/customerBookingPlaces";
import {
  isPlaceMatchingCarOffice,
  resolveBookingDisplayOffices,
} from "@/domain/orders/carOffices";
import { isSpainBookingSite } from "@/domain/orders/catalogPlaceOptions";
import { toBooleanField } from "@/domain/orders/fieldUtils";
import {
  resolveCreateDrivingLicenceUrls,
  resolveCreateTotalPrice,
} from "@/domain/orders/publicOrderCreatePolicy";
import { toBusinessStartOfDay, toStoredBusinessDate } from "@/domain/time/businessDate";
import DiscountSetting from "@models/DiscountSetting";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";
import { getSiteCountryCode } from "@config/siteCountry";
import { resolveRentalBookingContext } from "@/domain/booking/resolveRentalContext";
import {
  AVAILABILITY_PURPOSE,
  evaluateRentalAvailability,
  toLegacyCreateConflict,
} from "@/domain/booking/availabilityEngine";
import {
  calculateAuthoritativeRentalPrice,
  detectClientTotalMismatch,
  RentalPricingError,
  toAuthoritativePriceDoc,
} from "@/domain/orders/rentalPricingService";
import { isStripeConfigured } from "@config/stripe";
import {
  resolveCompanyRentalPaymentPolicy,
  shouldChargeRentalOnCreate,
} from "@/domain/orders/companyRentalPaymentPolicy";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { localSnapshotFromUtc } from "@/domain/time/businessInstant";
import AuditLog from "@models/auditLog";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

/** Макс. попыток подобрать свободный orderNumber (шаг −1 сек к метке YYYYMMDDHHmmss в Athens). */
const ORDER_NUMBER_UNIQUENESS_MAX_ATTEMPTS = 100;

async function maybeStartRentalPrepaymentOnCreate({
  orderDoc,
  ownerCompany,
  isAdminSession,
  offline,
}) {
  try {
    const policy = resolveCompanyRentalPaymentPolicy(ownerCompany, {
      stripeConfigured: isStripeConfigured(),
    });
    if (
      !shouldChargeRentalOnCreate(policy, {
        isAdminSession: Boolean(isAdminSession),
        offline: Boolean(offline),
      })
    ) {
      return null;
    }
    const pay = await createRentalCheckoutSession(String(orderDoc._id), {
      company: ownerCompany,
      emailCustomer: true,
    });
    return pay.ok ? pay.url || null : null;
  } catch (err) {
    console.error("[ORDER-ADD] rental checkout failed:", err?.message || err);
    return null;
  }
}

/**
 * Разбор номера заказа YYYYMMDDHHmmss как локального времени Europe/Athens.
 * @param {string} orderNumberStr
 */
function parseOrderNumberToAthens(orderNumberStr, timezone = "Europe/Athens") {
  const s = String(orderNumberStr || "").trim();
  if (!/^\d{14}$/.test(s)) return null;
  const Y = s.slice(0, 4);
  const M = s.slice(4, 6);
  const D = s.slice(6, 8);
  const h = s.slice(8, 10);
  const m = s.slice(10, 12);
  const sec = s.slice(12, 14);
  const d = dayjs.tz(
    `${Y}-${M}-${D} ${h}:${m}:${sec}`,
    "YYYY-MM-DD HH:mm:ss",
    timezone || "Europe/Athens"
  );
  return d.isValid() ? d : null;
}

function formatOrderNumberFromAthens(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    String(d.year()) +
    pad(d.month() + 1) +
    pad(d.date()) +
    pad(d.hour()) +
    pad(d.minute()) +
    pad(d.second())
  );
}

/** Минус 1 секунда к встроенной в номер метке (корректный перенос минут/часов/дней). */
function subtractOneSecondFromOrderNumber(orderNumberStr, timezone) {
  const d = parseOrderNumberToAthens(orderNumberStr, timezone);
  if (!d) return null;
  return formatOrderNumberFromAthens(d.subtract(1, "second"));
}

/**
 * Подбирает orderNumber, которого ещё нет в БД.
 * @param {string} [initialCandidate] — с клиента (BookingModal / AddOrderModal)
 * @returns {Promise<string>}
 */
async function resolveUniqueOrderNumber(initialCandidate, timezone) {
  let candidate = String(initialCandidate || "").trim();
  if (!/^\d{14}$/.test(candidate) || !parseOrderNumberToAthens(candidate, timezone)) {
    candidate = generateOrderNumber(timezone);
  }
  if (!parseOrderNumberToAthens(candidate, timezone)) {
    throw new Error("Could not build valid order number");
  }

  for (let i = 0; i < ORDER_NUMBER_UNIQUENESS_MAX_ATTEMPTS; i++) {
    const dup = await Order.findOne({ orderNumber: candidate })
      .select("_id")
      .lean();
    if (!dup) return candidate;

    const next = subtractOneSecondFromOrderNumber(candidate, timezone);
    if (!next || next === candidate) {
      throw new Error("Could not adjust order number (stuck on same value)");
    }
    candidate = next;
  }

  throw new Error(
    `Could not allocate unique order number after ${ORDER_NUMBER_UNIQUENESS_MAX_ATTEMPTS} attempts`
  );
}

// Cache GeoIP by IP to keep requests minimal (we only need up to ~10/day).
const IP_GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IP_GEO_CACHE = new Map();

function getClientIp(request) {
  const headers = request?.headers;
  const xForwardedFor = headers?.get?.("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const xRealIp = headers?.get?.("x-real-ip");
  if (xRealIp) return String(xRealIp).trim();

  // NextRequest (sometimes) exposes request.ip
  const ip = request?.ip;
  if (ip && typeof ip === "string") return ip.trim();

  return "";
}

/**
 * True if IP is not a real public client address (localhost, LAN, link-local, etc.).
 * ::1 is IPv6 loopback (same role as 127.0.0.1) — common on local dev.
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return true;
  const raw = ip.trim();
  if (!raw) return true;

  // Strip zone id (fe80::1%eth0)
  const noZone = raw.split("%")[0].trim();
  const lower = noZone.toLowerCase();

  // IPv4-mapped IPv6 (::ffff:192.168.x.x, ::ffff:127.0.0.1)
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIpv4(v4);
  }

  if (!lower.includes(":")) {
    return isPrivateIpv4(lower);
  }

  // IPv6 loopback
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // IPv6 link-local fe80::/10
  if (lower.startsWith("fe80:")) return true;
  // IPv6 unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;

  return false;
}

function isPrivateIpv4(s) {
  if (!s) return true;
  if (s === "0.0.0.0") return true;
  if (s.startsWith("127.")) return true;
  if (s.startsWith("10.")) return true;
  if (s.startsWith("192.168.")) return true;
  if (s.startsWith("169.254.")) return true;
  if (s.startsWith("0.")) return true;
  if (s.startsWith("172.")) {
    const secondOctet = Number(s.split(".")[1]);
    return Number.isFinite(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
  }
  return false;
}

async function getGeoFromIpApi(ip) {
  if (!ip || isPrivateIp(ip)) {
    return { country: "", region: "", city: "" };
  }

  const cached = IP_GEO_CACHE.get(ip);
  if (cached && Date.now() - cached.ts < IP_GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Free ip-api.com tier is HTTP-only; HTTPS is Pro-only — using https yields empty/failed parse on hosting.
    const url = `http://ip-api.com/json/${encodeURIComponent(
      ip
    )}?fields=status,country,regionName,city,message&lang=en`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = await res.json();

    if (!data || data.status !== "success") {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[order/add] ip-api.com geolocation failed:", {
          ip,
          status: data?.status,
          message: data?.message,
          httpStatus: res.status,
        });
      }
      // Do not cache failures — avoids sticky empty geo after a bad deploy or rate limit.
      return { country: "", region: "", city: "" };
    }

    const result = {
      country: data.country || "",
      region: data.regionName || "",
      city: data.city || "",
    };

    IP_GEO_CACHE.set(ip, { ts: Date.now(), data: result });
    return result;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[order/add] ip-api.com request error:", ip, e?.message || e);
    }
    return { country: "", region: "", city: "" };
  }
}

async function postOrderAddHandler(request) {
  try {
    await connectToDB();

    const {
      carId,
      carNumber,
      regNumber,
      customerName,
      phone,
      email,
      secondDriver,
      rentalStartDate,
      rentalEndDate,
      timeIn,
      timeOut,
      placeIn,
      placeOut,
      placeInDetail,
      placeOutDetail,
      flightNumber,
      confirmed,
      my_order = false,
      offline = false,
      ChildSeats,
      insurance,
      franchiseOrder,
      orderNumber,
      Viber,
      Whatsapp,
      Telegram,
      totalPrice: totalPriceFromClient,
      locale: clientLocale,
      drivingLicenceUrls: drivingLicenceUrlsRaw,
    } = await request.json();

    // Check if request comes from admin session
    // If admin creates order, we store their role for permission control
    let createdByRole = 0; // default: regular admin role
    let createdByAdminId = null;
    
    const session = await getServerSession(authOptions);
    if (session?.user?.isAdmin) {
      // Admin is creating this order - fetch their role from User model
      const adminUser = await User.findOne({ username: session.user.name });
      if (adminUser) {
        createdByRole = adminUser.role || 0;
        createdByAdminId = adminUser._id;
      }
    }

    const isAdminSession = session?.user?.isAdmin === true;
    // Публичный POST /order/add без админ-сессии: всегда клиентский заказ и неподтверждённый.
    // Иначе в JSON default my_order=false / подделка confirmed=true отключали уведомления CREATE.
    const myOrderToSave = isAdminSession ? Boolean(my_order) : true;
    const offlineToSave = isAdminSession ? Boolean(offline) : false;
    const confirmedToSave = isAdminSession
      ? Boolean(confirmed) || offlineToSave
      : false;

    // Явно присваиваем email пустую строку, если он не передан или undefined/null
    const safeEmail = typeof email === "string" ? email : "";

    const startDateSource = timeIn || rentalStartDate;
    const endDateSource = timeOut || rentalEndDate;

    const normalizedCarId =
      carId != null ? String(carId).trim() : "";
    const normalizedCarNumber =
      typeof carNumber === "string" ? carNumber.trim() : "";
    const normalizedRegNumber =
      typeof regNumber === "string" ? regNumber.trim() : "";

    if (!normalizedCarId && !normalizedRegNumber && !normalizedCarNumber) {
      return new Response(
        JSON.stringify({
          message: "Car identifier is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const normalizedPhone =
      typeof phone === "string" ? phone.trim() : String(phone ?? "").trim();
    if (!normalizedPhone || !isValidInternationalPhone(normalizedPhone)) {
      return new Response(
        JSON.stringify({
          message: "Invalid phone number",
          messageKey: "order.phoneInvalid",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const placeInDetailTrim =
      typeof placeInDetail === "string" ? placeInDetail.trim() : "";
    const placeOutDetailTrim =
      typeof placeOutDetail === "string" ? placeOutDetail.trim() : "";

    let placeInToSave = typeof placeIn === "string" ? placeIn.trim() : "";
    let placeOutToSave = typeof placeOut === "string" ? placeOut.trim() : "";
    let placeInDetailToSave = placeInDetailTrim;
    let placeOutDetailToSave = placeOutDetailTrim;

    const isCustomerSelfServiceBooking = myOrderToSave === true;

    // Find car: _id is always unique (MongoDB default index). Fallback: carNumber, then regNumber.
    let existingCar = null;
    if (normalizedCarId && mongoose.Types.ObjectId.isValid(normalizedCarId)) {
      existingCar = await Car.findById(normalizedCarId);
    }
    if (!existingCar && normalizedCarNumber) {
      existingCar = await Car.findOne({ carNumber: normalizedCarNumber });
    }
    if (!existingCar && normalizedRegNumber) {
      existingCar = await Car.findOne({ regNumber: normalizedRegNumber });
    }

    if (!existingCar) {
      return new Response(
        JSON.stringify({
          message: "Car is not found",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const ownerCompany = existingCar.ownerId
      ? await Company.findById(existingCar.ownerId).lean()
      : await Company.findById(COMPANY_ID).lean();

    if (!isAdminSession) {
      const siteCountry = getSiteCountryCode();
      if (!isCompanyInSiteCountry(ownerCompany, siteCountry)) {
        return new Response(
          JSON.stringify({
            message: "Car is not found",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const bookingCities = await loadCompanyBookingCities(ownerCompany);
    const matchingCity =
      bookingCities.find(
        (city) =>
          city?.name &&
          typeof placeIn === "string" &&
          city.name.toLowerCase() === String(placeIn).trim().toLowerCase()
      ) || bookingCities[0] || null;

    const rentalContext = resolveRentalBookingContext({
      company: ownerCompany,
      city: matchingCity,
      countryCode: ownerCompany?.country || getSiteCountryCode(),
      forNewOrder: true,
    });
    const { timezone, bookingMode, currency, countryCode, initialBookingStatus } =
      rentalContext;

    const startDate = toBusinessDateTime(startDateSource, timezone);
    const endDate = toBusinessDateTime(endDateSource, timezone);

    if (!startDate || !endDate || !startDate.isValid() || !endDate.isValid()) {
      return new Response(
        JSON.stringify({
          message: "Invalid rental dates",
          messageKey: "order.invalidDates",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (getBusinessRentalDaysByMinutes(startDate, endDate, timezone) <= 0) {
      return new Response(
        JSON.stringify({
          message: "Start and End dates could't be at the same date",
        }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pickupAtUtc = startDate.utc().toDate();
    const returnAtUtc = endDate.utc().toDate();

    if (isCustomerSelfServiceBooking) {
      const ownerBookingCityNames = bookingCities.map((city) => city.name);
      const siteCountry = getSiteCountryCode();
      const allowedNames = resolveAllowedCustomerPlaceNames({
        countryCode: siteCountry,
        company: ownerCompany,
        car: existingCar,
        ownerBookingCityNames,
      });
      const displayOffices = resolveBookingDisplayOffices(
        existingCar,
        ownerCompany,
        { countryCode: siteCountry, selectedCity: placeInToSave }
      );
      const pin = placeInToSave;
      const pout = placeOutToSave;
      const outsideKey = isSpainBookingSite(siteCountry)
        ? "order.spainLocationOutsideServiceArea"
        : "order.locationOutsideServiceArea";
      if (
        !isAllowedBookingLocation(pin, allowedNames) ||
        !isAllowedBookingLocation(pout, allowedNames)
      ) {
        return new Response(
          JSON.stringify({
            message:
              "Pickup and return must match a location served by this car's owner.",
            messageKey: outsideKey,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const pinCanon = canonicalizeBookingLocation(pin, allowedNames);
      const poutCanon = canonicalizeBookingLocation(pout, allowedNames);
      if (!pinCanon || !poutCanon) {
        return new Response(
          JSON.stringify({
            message: "Invalid pickup or return location.",
            messageKey: outsideKey,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      placeInToSave = pinCanon;
      placeOutToSave = poutCanon;
      const pinIsOffice = isPlaceMatchingCarOffice(pinCanon, displayOffices);
      const poutIsOffice = isPlaceMatchingCarOffice(poutCanon, displayOffices);
      if (
        !pinIsOffice &&
        locationRequiresAddressDetail(pinCanon, bookingCities) &&
        placeInDetailToSave.length < 3
      ) {
        return new Response(
          JSON.stringify({
            message:
              "Enter a hotel name or full address (at least 3 characters) for this pickup city.",
            messageKey: "order.thessalonikiDetailRequired",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (
        !poutIsOffice &&
        locationRequiresAddressDetail(poutCanon, bookingCities) &&
        placeOutDetailToSave.length < 3
      ) {
        return new Response(
          JSON.stringify({
            message:
              "Enter a hotel name or full address (at least 3 characters) for this return city.",
            messageKey: "order.thessalonikiDetailRequired",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const existingOrders = await Order.find({
      car: existingCar._id,
    });

    let nonConfirmedDates = [];
    let conflicOrdersId = [];

    const availability = evaluateRentalAvailability({
      carId: existingCar._id,
      pickupAtUtc,
      returnAtUtc,
      timezone,
      existingOrders,
      bufferHours: Number(ownerCompany?.bufferTime) || 0,
      minDurationHours: Number(ownerCompany?.minRentalDuration) || 0,
      purpose: AVAILABILITY_PURPOSE.REQUEST,
      bookingMode,
    });

    if (availability.hardConflict) {
      return new Response(
        JSON.stringify({
          message: availability.userSafeReason,
          conflictType: availability.conflictType,
          reasonCodes: availability.reasonCodes,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const legacyConflict = toLegacyCreateConflict(availability);
    if (legacyConflict && legacyConflict.status === 202) {
      conflicOrdersId = Array.from(legacyConflict.data.conflictOrdersIds || []);
      nonConfirmedDates = legacyConflict.data.conflictDates || [];
    }

    const normalizedSecondDriver = toBooleanField(secondDriver, false);

    let quote;
    try {
      quote = await calculateAuthoritativeRentalPrice({
        car: existingCar,
        pickupAtUtc,
        returnAtUtc,
        timezone,
        insurance,
        childSeats: ChildSeats,
        secondDriver: normalizedSecondDriver,
        placeIn: placeInToSave,
        placeOut: placeOutToSave,
        company: ownerCompany,
        bookingMode,
      });
    } catch (err) {
      if (err instanceof RentalPricingError) {
        return new Response(
          JSON.stringify({
            message: err.message,
            messageKey: err.code,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw err;
    }

    const days = quote.rentalDays;
    const total = quote.compatibility.rentalTotal;
    const deliveryTotal = quote.compatibility.deliveryTotal;
    const totalPriceToSave = resolveCreateTotalPrice({
      isAdminSession,
      clientTotalPrice: totalPriceFromClient,
      rentalTotal: total,
      deliveryTotal,
    });

    if (!isAdminSession) {
      const mismatch = detectClientTotalMismatch({
        clientTotalPrice: totalPriceFromClient,
        serverTotalMajor: totalPriceToSave,
      });
      if (mismatch) {
        try {
          await AuditLog.create({
            action: "OTHER",
            userRole: "system",
            metadata: {
              kind: "PRICE_CLIENT_MISMATCH",
              clientMajor: mismatch.clientMajor,
              serverMajor: mismatch.serverMajor,
              currency,
            },
            severity: "low",
            result: "success",
          });
        } catch (auditErr) {
          console.error(
            "[order/add] price mismatch audit failed:",
            auditErr?.message
          );
        }
      }
    }

    // -------- Client context (language + geo) --------
    // `locale` is set by BookingModal.js (orderData.locale = lang).
    const clientLang = normalizeLocale(clientLocale);

    // Determine IP and Geo via ip-api.com
    const rawClientIp = getClientIp(request);
    // Do not persist loopback/LAN IPs (::1, 127.0.0.1, etc.) — not a real visitor address.
    const clientIP = isPrivateIp(rawClientIp) ? "" : rawClientIp.trim();
    const geo = await getGeoFromIpApi(rawClientIp);
    const clientCountry = geo.country || "";
    const clientRegion = geo.region || "";
    const clientCity = geo.city || "";

    const resolvedOrderNumber = await resolveUniqueOrderNumber(
      orderNumber,
      timezone
    );
    const fromLocalhost = isOrderBookingRequestFromLocalhost(request);
    const drivingLicenceUrls = resolveCreateDrivingLicenceUrls({
      isAdminSession,
      raw: drivingLicenceUrlsRaw,
    });

    const localPickup = localSnapshotFromUtc(pickupAtUtc, timezone);
    const localReturn = localSnapshotFromUtc(returnAtUtc, timezone);
    const timeInToSave = timeIn ? timeIn : setTimeToDatejs(startDate, null, true);
    const timeOutToSave = timeOut ? timeOut : setTimeToDatejs(endDate, null);

    const newOrder = new Order({
      carNumber: existingCar.carNumber,
      regNumber: existingCar.regNumber || "",
      customerName,
      phone: normalizedPhone,
      email: safeEmail,
      rentalStartDate: toStoredBusinessDate(startDate, timezone),
      rentalEndDate: toStoredBusinessDate(endDate, timezone),
      car: existingCar._id,
      carModel: existingCar.model,
      numberOfDays: days,
      totalPrice: totalPriceToSave,
      timeIn: timeInToSave,
      timeOut: timeOutToSave,
      placeIn: placeInToSave,
      placeOut: placeOutToSave,
      placeInDetail: placeInDetailToSave,
      placeOutDetail: placeOutDetailToSave,
      clientLang,
      clientIP,
      clientCountry,
      clientRegion,
      clientCity: clientCity,
      date: dayjs().tz(timezone).toDate(),
      confirmed: confirmedToSave,
      my_order: myOrderToSave,
      offline: offlineToSave,
      ChildSeats,
      insurance,
      franchiseOrder,
      orderNumber: resolvedOrderNumber,
      flightNumber,
      Viber: Boolean(Viber),
      Whatsapp: Boolean(Whatsapp),
      Telegram: Boolean(Telegram),
      createdByRole,
      createdByAdminId,
      ownerId: existingCar.ownerId || COMPANY_ID,
      fromLocalhost,
      drivingLicenceUrls,
      bookingMode,
      countryCode,
      currency,
      timezone,
      pickupAtUtc,
      returnAtUtc,
      localPickup,
      localReturn,
      bookingStatus: initialBookingStatus,
      pricingVersion: quote.pricingVersion,
      priceCalculatedAt: quote.calculatedAt,
      authoritativePrice: toAuthoritativePriceDoc(quote),
    });

    // HMR/cache safety: persist secondDriver even if cached schema was stale.
    newOrder.set("secondDriver", normalizedSecondDriver, { strict: false });

    if (nonConfirmedDates.length > 0) {
      newOrder.hasConflictDates = [
        ...new Set([...newOrder.hasConflictDates, ...conflicOrdersId]),
      ];

      await newOrder.save();
      await attachOrderToActiveDiscount(newOrder);
      // Keep Car.orders in sync for pending orders too.
      if (!existingCar.orders.some((id) => String(id) === String(newOrder._id))) {
        existingCar.orders.push(newOrder._id);
        await existingCar.save();
      }

      await updateConflictingOrders(conflicOrdersId, newOrder._id);

      // Уведомления по политике (orderNotificationPolicy)
      let notificationError = null;
      const orderPlain = newOrder.toObject ? newOrder.toObject() : { ...newOrder };
      const user = session?.user || { id: null, role: 0, isAdmin: false };
      const company = await Company.findById(COMPANY_ID);
      try {
        if (!offlineToSave) {
          await notifyOrderAction({
            order: orderPlain,
            user,
            action: "CREATE",
            source: "BACKEND",
            companyEmail: company?.email,
            locale: clientLocale,
          });
        }
      } catch (err) {
        notificationError = err?.message || "Notifications failed";
        console.error("[ORDER-ADD] notifyOrderAction failed (order created, 202):", {
          orderId: newOrder._id?.toString?.(),
          action: "CREATE",
          error: err?.message,
          stack: err?.stack,
        });
      }

      const paymentUrl = await maybeStartRentalPrepaymentOnCreate({
        orderDoc: newOrder,
        ownerCompany,
        isAdminSession,
        offline: offlineToSave,
      });

      return new Response(
        JSON.stringify({
          messageCode: "bookMesssages.bookPendingDates",
          dates: nonConfirmedDates,
          data: newOrder,
          ...(notificationError && { notificationError }),
          ...(paymentUrl && { paymentUrl }),
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Save the new order
    await newOrder.save();
    await attachOrderToActiveDiscount(newOrder);
    // Add the new order to the car's orders array
    if (!existingCar.orders.some((id) => String(id) === String(newOrder._id))) {
      existingCar.orders.push(newOrder._id);
      // Save the updated car document
      await existingCar.save();
    }

    // Уведомления по политике (orderNotificationPolicy)
    let notificationError = null;
    const orderPlain = newOrder.toObject ? newOrder.toObject() : { ...newOrder };
    const user = session?.user || { id: null, role: 0, isAdmin: false };
    const company = await Company.findById(COMPANY_ID);
    try {
      if (!offlineToSave) {
        await notifyOrderAction({
          order: orderPlain,
          user,
          action: "CREATE",
          source: "BACKEND",
          companyEmail: company?.email,
          locale: clientLocale,
        });
      }
    } catch (err) {
      notificationError = err?.message || "Notifications failed";
      console.error("[ORDER-ADD] notifyOrderAction failed (order created, 201):", {
        orderId: newOrder._id?.toString?.(),
        action: "CREATE",
        error: err?.message,
        stack: err?.stack,
      });
    }

    const paymentUrl = await maybeStartRentalPrepaymentOnCreate({
      orderDoc: newOrder,
      ownerCompany,
      isAdminSession,
      offline: offlineToSave,
    });

    const body = newOrder.toObject ? newOrder.toObject() : { ...newOrder };
    if (notificationError) body.notificationError = notificationError;
    if (paymentUrl) body.paymentUrl = paymentUrl;

    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Логгирование ошибки с деталями запроса
    console.error("API: Ошибка при обработке заказа:", error);
    return new Response(
      JSON.stringify({
        error: `Failed to add new order: ${error.message}`,
        details: error.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function attachOrderToActiveDiscount(orderDoc) {
  if (!orderDoc?._id) return;

  const activeDiscount = await DiscountSetting.findOne({ active: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!activeDiscount?.startDate || !activeDiscount?.endDate) return;

  const orderStart = toBusinessStartOfDay(
    orderDoc.rentalStartDate ?? orderDoc.timeIn,
    orderDoc.timezone
  );
  const orderEnd = toBusinessStartOfDay(
    orderDoc.rentalEndDate ?? orderDoc.timeOut,
    orderDoc.timezone
  );
  const discountStart = toBusinessStartOfDay(
    activeDiscount.startDate,
    orderDoc.timezone
  );
  const discountEnd = toBusinessStartOfDay(
    activeDiscount.endDate,
    orderDoc.timezone
  );
  if (!orderStart || !orderEnd || !discountStart || !discountEnd) return;

  // Discount is considered applied if booking range intersects discount range by day.
  const intersects =
    !orderEnd.isBefore(discountStart, "day") &&
    !orderStart.isAfter(discountEnd, "day");
  if (!intersects) return;

  await DiscountSetting.updateOne(
    { _id: activeDiscount._id },
    { $addToSet: { appliedOrderIds: orderDoc._id } }
  );
}

export const POST = async (request) => {
  await connectToDB();
  return orderGuard(postOrderAddHandler)(request);
};

// function that iterates over all conflicting orders adding to them new conflicts orders
async function updateConflictingOrders(conflicOrdersId, newOrderId) {
  try {
    // Iterate over each conflicting order ID
    for (const conflictOrderId of conflicOrdersId) {
      // Find the order by its ID
      const order = await Order.findById(conflictOrderId);

      if (order) {
        // Add the new order ID to the conflicting order's hasConflictDates array
        if (!order.hasConflictDates.includes(newOrderId)) {
          order.hasConflictDates.push(newOrderId);
          await order.save(); // Save the updated order
        }
      }
    }
  } catch (error) {
    console.error("Error updating conflicting orders:", error);
  }
}
