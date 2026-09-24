import mongoose from "mongoose";
import { Car } from "@models/car";
import { Order } from "@models/order";
import { User, ROLE } from "@models/user";
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
import { assertCustomerLocationMethods } from "@/domain/orders/bookingLocationSelection";
import {
  ORDER_CREATE_CODE,
  createCorrelationId,
  customerMessageForCode,
  mapLocationQuoteCode,
  mapTermsErrorCode,
} from "@/domain/orders/orderCreateContract";
import { normalizeLocale } from "@domain/locationSeo/locationSeoService";
import { generateOrderNumber } from "@/domain/time/athensTime";
import { isOrderBookingRequestFromLocalhost } from "@/lib/http/orderRequestLocalhost";
import { parseOrderCustomerContact } from "@/domain/validation/orderCustomerContact";
import {
  buildTermsAcceptanceRecord,
  evaluateBookingTermsAcceptance,
} from "@/domain/orders/bookingTermsAcceptance";
import { pickCompanyRentalTermsForLanguage } from "@/domain/company/customerRentalTerms";
import { buildBookingLegalSnapshot } from "@/domain/legal/bookingLegalSnapshot";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import { resolveDocumentForDisplay } from "@/domain/legal/documentService";
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
import { getPlatformMarketplaceFeeSettings } from "@/domain/platform/platformSettingsService";
import {
  LocationQuoteError,
  quoteAuthoritativeLocations,
} from "@/domain/orders/authoritativeLocationQuote";
import { parseLocationQuoteInput } from "@/domain/orders/locationQuoteInput";
import { orderFieldsFromSnapshot } from "@/domain/orders/locationSnapshot";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import {
  PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
  PRICE_BREAKDOWN_MISMATCH,
  assertAuthoritativePriceReconciled,
  logPriceBreakdownMismatch,
} from "@/domain/orders/priceBreakdownReconciliation";
import { isStripeConfigured } from "@config/stripe";
import {
  PAYMENT_LINK_STATUS,
  resolveCompanyRentalPaymentPolicy,
  shouldChargeRentalOnCreate,
} from "@/domain/orders/companyRentalPaymentPolicy";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { localSnapshotFromUtc } from "@/domain/time/businessInstant";
import AuditLog from "@models/auditLog";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import { notifySuperadmin } from "@/domain/notifications/notifySuperadmin";
import {
  assertPartnerCanOperate,
  PARTNER_OPERATION_PURPOSE,
} from "@/domain/legal/partnerOperatingPolicy";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

/** Макс. попыток подобрать свободный orderNumber (шаг −1 сек к метке YYYYMMDDHHmmss в Athens). */
const ORDER_NUMBER_UNIQUENESS_MAX_ATTEMPTS = 100;

function paymentResult(status, url = null, message = null) {
  return { status, url: url || null, message: message || null };
}

async function warnMissingOwnerCompany(orderDoc, car) {
  const orderId = orderDoc?._id;
  try {
    await recordAuditEvent({
      action: "BOOKING_OWNER_MISSING",
      severity: "critical",
      result: "failure",
      orderData: {
        orderId,
        orderNumber: orderDoc?.orderNumber,
        carModel: orderDoc?.carModel || car?.model,
      },
      metadata: {
        carId: car?._id ? String(car._id) : "",
        ownerId: car?.ownerId ? String(car.ownerId) : "",
      },
    });
  } catch (err) {
    console.error("[ORDER-ADD] missing-owner audit failed", err?.message || err);
  }
  try {
    await notifySuperadmin({
      title: `⚠️ Booking saved without car owner — #${orderDoc?.orderNumber || orderId}`,
      bodyLines: [
        "A marketplace/client booking was saved but the selected car has no owner company.",
        "No partner email was sent (the platform company was not used as a fallback).",
        "",
        `Order: ${orderId}`,
        `Car: ${car?.model || orderDoc?.carModel || "—"} (${car?._id || "—"})`,
        `Car.ownerId: ${car?.ownerId || "missing"}`,
      ],
      meta: { orderId, type: "BOOKING_OWNER_MISSING" },
    });
  } catch (err) {
    console.error("[ORDER-ADD] missing-owner notify failed", err?.message || err);
  }
}

async function maybeStartRentalPrepaymentOnCreate({
  orderDoc,
  ownerCompany,
  isAdminSession,
  offline,
}) {
  const bookingMode = orderDoc?.bookingMode;
  const isClientOrder = orderDoc?.my_order === true;
  try {
    const stripeConfigured = isStripeConfigured();
    const policy = resolveCompanyRentalPaymentPolicy(ownerCompany, {
      stripeConfigured,
      bookingMode,
    });
    if (
      !shouldChargeRentalOnCreate(policy, {
        isAdminSession: Boolean(isAdminSession),
        offline: Boolean(offline),
        isClientOrder,
        bookingMode,
      })
    ) {
      return paymentResult(PAYMENT_LINK_STATUS.NOT_REQUIRED);
    }
    const pay = await createRentalCheckoutSession(String(orderDoc._id), {
      company: ownerCompany,
      emailCustomer: false,
    });
    if (pay.ok && pay.url) {
      return paymentResult(PAYMENT_LINK_STATUS.READY, pay.url);
    }
    if (pay.code === "stripe_not_configured") {
      console.error(
        "[ORDER-ADD] rental checkout skipped: Stripe is not configured"
      );
      return paymentResult(
        PAYMENT_LINK_STATUS.NOT_CONFIGURED,
        null,
        pay.message
      );
    }
    if (pay.code === "prepayment_too_low") {
      console.error(
        "[ORDER-ADD] rental checkout skipped: prepayment too low for Stripe",
        pay.message
      );
      return paymentResult(
        PAYMENT_LINK_STATUS.AMOUNT_TOO_LOW,
        null,
        pay.message
      );
    }
    if (pay.onSite) {
      return paymentResult(PAYMENT_LINK_STATUS.NOT_REQUIRED);
    }
    console.error("[ORDER-ADD] rental checkout failed:", pay.message || pay);
    return paymentResult(
      PAYMENT_LINK_STATUS.FAILED,
      null,
      pay.message || "Checkout failed"
    );
  } catch (err) {
    console.error("[ORDER-ADD] rental checkout failed:", err?.message || err);
    return paymentResult(
      PAYMENT_LINK_STATUS.FAILED,
      null,
      err?.message || "Checkout failed"
    );
  }
}

async function notifyAfterCreate({
  newOrder,
  payResult,
  session,
  company,
  clientLocale,
  offlineToSave,
}) {
  let notificationError = null;
  const orderPlain = newOrder.toObject ? newOrder.toObject() : { ...newOrder };
  orderPlain.paymentUrl = payResult?.url || null;
  orderPlain.paymentLinkStatus = payResult?.status || "";
  orderPlain.paymentLinkMessage = payResult?.message || "";
  const user = session?.user || { id: null, role: 0, isAdmin: false };
  try {
    if (!offlineToSave) {
      // notifyOrderAction → notificationPolicy for company/superadmin matrix
      // emails on CREATE, while keeping telegram + partner-confirm token links.
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
    console.error("[ORDER-ADD] notifyOrderAction failed (order created):", {
      orderId: newOrder._id?.toString?.(),
      action: "CREATE",
      error: err?.message,
      stack: err?.stack,
    });
  }
  return { notificationError, orderPlain };
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
  const correlationId =
    request.headers.get("x-correlation-id") || createCorrelationId();
  let savedOrderId = "";
  let existingCarId = "";
  let ownerCompanyId = "";
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
      pickupMethod,
      returnMethod,
      location,
      pickupOfficeId,
      returnOfficeId,
      pickupPlaceId,
      returnPlaceId,
      placeInId,
      placeOutId,
      sameReturnLocation,
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
      termsAcceptance: termsAcceptanceRaw,
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
        createdByRole = Number(adminUser.role) === ROLE.SUPERADMIN ? 1 : 0;
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

    // Public and admin customer orders require a valid email and phone.
    // Offline calendar stubs may omit name/phone/email; a filled email must still be valid.
    const contactResult = parseOrderCustomerContact({
      offline: offlineToSave,
      email,
      phone,
      customerName,
    });
    if (!contactResult.ok) {
      return new Response(
        JSON.stringify({
          message: contactResult.message,
          messageKey: contactResult.messageKey,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    const safeEmail = contactResult.email;
    const normalizedPhone = contactResult.phone;
    const customerNameToSave = contactResult.customerName;

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

    const placeInDetailTrim =
      typeof placeInDetail === "string" ? placeInDetail.trim() : "";
    const placeOutDetailTrim =
      typeof placeOutDetail === "string" ? placeOutDetail.trim() : "";

    let placeInToSave = typeof placeIn === "string" ? placeIn.trim() : "";
    let placeOutToSave = typeof placeOut === "string" ? placeOut.trim() : "";
    let placeInDetailToSave = placeInDetailTrim;
    let placeOutDetailToSave = placeOutDetailTrim;
    let locationSnapshotToSave = null;
    let locationQuote = null;
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
    const pickupMethodToSave =
      locationInput.pickup.kind === "office"
        ? "office"
        : locationInput.pickup.kind === "delivery"
          ? "delivery"
          : String(pickupMethod || "").trim().toLowerCase() === "office"
            ? "office"
            : String(pickupMethod || "").trim().toLowerCase() === "delivery"
              ? "delivery"
              : "";
    const returnMethodToSave =
      locationInput.dropoff.kind === "office"
        ? "office"
        : locationInput.dropoff.kind === "delivery"
          ? "delivery"
          : String(returnMethod || "").trim().toLowerCase() === "office"
            ? "office"
            : String(returnMethod || "").trim().toLowerCase() === "delivery"
              ? "delivery"
              : "";

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
      : null;
    const ownerMissing = !existingCar.ownerId || !ownerCompany;

    if (!isAdminSession && ownerCompany) {
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
      const bookingGate = await assertPartnerCanOperate(ownerCompany._id, {
        company: ownerCompany,
        purpose: PARTNER_OPERATION_PURPOSE.BOOKING,
      });
      if (!bookingGate.allowed) {
        console.error("[ORDER-ADD] company not ready", {
          correlationId,
          code: ORDER_CREATE_CODE.COMPANY_NOT_READY,
          failingGuard: "assertPartnerCanOperate",
          companyId: String(ownerCompany?._id || ""),
          carId: String(existingCar?._id || ""),
          reason: bookingGate.reason || bookingGate.code || "",
        });
        return new Response(
          JSON.stringify({
            error: ORDER_CREATE_CODE.COMPANY_NOT_READY,
            message: customerMessageForCode(ORDER_CREATE_CODE.COMPANY_NOT_READY),
            correlationId,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const clientLangEarly = normalizeLocale(clientLocale);
    let termsAcceptanceToSave;
    let legalSnapshotToSave;
    const skipBookingTerms = isAdminSession || offlineToSave;
    if (!skipBookingTerms) {
      const { doc: platformDoc } = await resolveDocumentForDisplay({
        documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
        language: clientLangEarly,
      });
      const companyTerms = pickCompanyRentalTermsForLanguage(
        ownerCompany?.customerRentalTerms,
        clientLangEarly
      );
      const termsCheck = evaluateBookingTermsAcceptance({
        skip: false,
        payload: termsAcceptanceRaw,
        platform: platformDoc
          ? {
              available: true,
              checksum: platformDoc.checksum,
              version: platformDoc.version,
              documentType: platformDoc.documentType,
              language: platformDoc.language,
            }
          : { available: false },
        company: companyTerms,
      });
      if (!termsCheck.ok) {
        const termsCode = mapTermsErrorCode(termsCheck.code);
        console.error("[ORDER-ADD] terms rejected", {
          correlationId,
          code: termsCode,
          failingGuard: "evaluateBookingTermsAcceptance",
          termsCode: termsCheck.code,
          companyId: String(ownerCompany?._id || ""),
          carId: String(existingCar?._id || ""),
        });
        return new Response(
          JSON.stringify({
            message: customerMessageForCode(termsCode),
            messageKey: `order.${termsCheck.code}`,
            error: termsCode,
            correlationId,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      const { doc: privacyDoc } = await resolveDocumentForDisplay({
        documentType: LEGAL_DOCUMENT_TYPE.PRIVACY_POLICY,
        language: clientLangEarly,
      }).catch(() => ({ doc: null }));
      termsAcceptanceToSave = buildTermsAcceptanceRecord({
        payload: termsAcceptanceRaw,
        platform: {
          available: true,
          checksum: platformDoc.checksum,
          version: platformDoc.version,
          documentType: platformDoc.documentType,
          language: platformDoc.language,
        },
        company: companyTerms.available
          ? {
              ...companyTerms,
              documentId:
                ownerCompany?.customerRentalTerms?.documentId ||
                `supplier-terms-${ownerCompany?._id || ""}`,
              version: ownerCompany?.customerRentalTerms?.publishedVersion || 0,
              checksum: companyTerms.sourceHash,
            }
          : companyTerms,
        privacy: privacyDoc
          ? {
              version: privacyDoc.version,
              checksum: privacyDoc.checksum,
              language: privacyDoc.language,
            }
          : null,
      });
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
      const spainMarketplace =
        isSpainBookingSite(siteCountry) &&
        isMarketplaceRequestMode(bookingMode);
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

      if (spainMarketplace) {
        const methodCheck = assertCustomerLocationMethods(locationInput);
        if (!methodCheck.ok) {
          return new Response(
            JSON.stringify({
              message: methodCheck.message,
              error: methodCheck.code,
              correlationId,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const wantsQuotedLocation =
        Boolean(location) ||
        pickupMethodToSave === "office" ||
        pickupMethodToSave === "delivery" ||
        returnMethodToSave === "office" ||
        returnMethodToSave === "delivery";
      if (wantsQuotedLocation || spainMarketplace) {
        try {
          locationQuote = await quoteAuthoritativeLocations({
            car: existingCar,
            company: ownerCompany,
            pickup: {
              kind:
                pickupMethodToSave ||
                (isPlaceMatchingCarOffice(placeInToSave, displayOffices)
                  ? "office"
                  : "delivery"),
              officeId: locationInput.pickup.officeId,
              placeId: locationInput.pickup.placeId,
            },
            dropoff: {
              kind:
                returnMethodToSave ||
                (isPlaceMatchingCarOffice(placeOutToSave, displayOffices)
                  ? "office"
                  : "delivery"),
              officeId: locationInput.dropoff.officeId,
              placeId: locationInput.dropoff.placeId,
              sameAsPickup: locationInput.dropoff.sameAsPickup,
            },
            language: clientLocale,
          });
          locationSnapshotToSave = locationQuote.snapshot;
          const quotedFields = orderFieldsFromSnapshot(locationSnapshotToSave);
          placeInToSave = quotedFields.placeIn || placeInToSave;
          placeOutToSave = quotedFields.placeOut || placeOutToSave;
          placeInDetailToSave = quotedFields.placeInDetail || placeInDetailToSave;
          placeOutDetailToSave =
            quotedFields.placeOutDetail || placeOutDetailToSave;
        } catch (err) {
          if (err instanceof LocationQuoteError) {
            const locationCode = mapLocationQuoteCode(err.code);
            const officeFailure =
              locationCode === ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE;
            console.error("[ORDER-ADD] location rejected", {
              correlationId,
              code: locationCode,
              failingGuard: "quoteAuthoritativeLocations",
              quoteCode: err.code,
              companyId: String(ownerCompany?._id || ""),
              carId: String(existingCar?._id || ""),
              officeId: locationInput.pickup.officeId || "",
            });
            return new Response(
              JSON.stringify({
                message: officeFailure
                  ? customerMessageForCode(ORDER_CREATE_CODE.OFFICE_NOT_AVAILABLE)
                  : err.message,
                messageKey: `order.${err.code}`,
                error: locationCode,
                correlationId,
              }),
              {
                status: err.code === "PLACES_UNAVAILABLE" ? 503 : 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          throw err;
        }
      }

      // Spain marketplace: after a verified placeId/officeId quote, do not
      // reject on city-name allowlist (hotel locality may differ from city list).
      // Legacy Greece still uses the name allowlist when there is no payload quote.
      const skipNameAllowlist =
        spainMarketplace && Boolean(locationSnapshotToSave);
      if (!skipNameAllowlist) {
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
          message:
            availability.userSafeReason ||
            customerMessageForCode(ORDER_CREATE_CODE.CAR_NOT_AVAILABLE),
          error: ORDER_CREATE_CODE.CAR_NOT_AVAILABLE,
          correlationId,
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
      const useQuotedFees = Boolean(locationSnapshotToSave);
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
        placeInDetail: placeInDetailToSave,
        placeOutDetail: placeOutDetailToSave,
        placeInLat: useQuotedFees
          ? locationSnapshotToSave?.pickup?.lat
          : undefined,
        placeInLon: useQuotedFees
          ? locationSnapshotToSave?.pickup?.lon
          : undefined,
        placeOutLat: useQuotedFees
          ? locationSnapshotToSave?.return?.lat
          : undefined,
        placeOutLon: useQuotedFees
          ? locationSnapshotToSave?.return?.lon
          : undefined,
        placeInLocality: useQuotedFees
          ? locationSnapshotToSave?.pickup?.city
          : undefined,
        placeOutLocality: useQuotedFees
          ? locationSnapshotToSave?.return?.city
          : undefined,
        carOffices: locationQuote?.eligibleOffices,
        company: ownerCompany,
        platformSettings: await getPlatformMarketplaceFeeSettings(),
        bookingMode,
        ignoreClientGeo: isMarketplaceRequestMode(bookingMode),
        quotedPickupFeeMinor: useQuotedFees
          ? Math.round((Number(locationSnapshotToSave.pickup?.feeMajor) || 0) * 100)
          : undefined,
        quotedReturnFeeMinor: useQuotedFees
          ? Math.round(
              (Number(locationSnapshotToSave.return?.feeMajor) || 0) * 100
            )
          : undefined,
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

    if (termsAcceptanceToSave) {
      const priceDoc = toAuthoritativePriceDoc(quote);
      const grossMinor = Number(priceDoc?.grossMinor || 0) || 0;
      const feeMinor =
        Number(
          priceDoc?.prepaymentMinor ??
            priceDoc?.platformAmountMinor ??
            priceDoc?.bookingFeeMinor ??
            0
        ) || 0;
      const feePercent =
        Number(
          priceDoc?.prepaymentPercent ??
            priceDoc?.bookingFeePercent ??
            (grossMinor > 0 ? (feeMinor / grossMinor) * 100 : 0)
        ) || 0;
      legalSnapshotToSave = buildBookingLegalSnapshot({
        platform: termsAcceptanceToSave.platform,
        privacy: termsAcceptanceToSave.privacy,
        supplierTerms: termsAcceptanceToSave.company
          ? {
              documentId: termsAcceptanceToSave.company.documentId,
              version: termsAcceptanceToSave.company.version,
              language: termsAcceptanceToSave.company.language,
              checksum:
                termsAcceptanceToSave.company.checksum ||
                termsAcceptanceToSave.company.sourceHash,
            }
          : null,
        language: clientLangEarly,
        acceptedAt: termsAcceptanceToSave.platform?.acceptedAt || new Date(),
        customerEmail: safeEmail || "",
        ipAddress: "",
        userAgent: String(request.headers.get("user-agent") || "").slice(0, 500),
        priceMinor: grossMinor,
        bookingFeeMinor: feeMinor,
        bookingFeePercent: feePercent,
        supplierBalanceMinor: Math.max(0, grossMinor - feeMinor),
        carId: String(existingCar?._id || ""),
        pickup: String(placeInToSave || placeIn || ""),
        dropoff: String(placeOutToSave || placeOut || ""),
      });
    }

    if (isMarketplaceRequestMode(bookingMode) && quote) {
      const reconciled = assertAuthoritativePriceReconciled({
        authoritativePrice: toAuthoritativePriceDoc(quote),
        locationSnapshot: locationSnapshotToSave,
      });
      if (!reconciled.ok) {
        logPriceBreakdownMismatch({
          companyId: ownerCompany?._id,
          breakdown: reconciled.breakdown,
          stage: "order_add",
        });
        return new Response(
          JSON.stringify({
            message: PRICE_BREAKDOWN_CUSTOMER_MESSAGE,
            code: PRICE_BREAKDOWN_MISMATCH,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (locationSnapshotToSave && quote) {
      // Keep snapshot fees from the authoritative location quote — do not
      // silently reprice from a later tariff recalculation.
      locationSnapshotToSave = {
        ...locationSnapshotToSave,
        pickup: {
          ...locationSnapshotToSave.pickup,
          feeMajor: (Number(quote.pickupFeeMinor) || 0) / 100,
        },
        return: {
          ...locationSnapshotToSave.return,
          feeMajor: (Number(quote.returnFeeMinor) || 0) / 100,
        },
      };
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
    if (legalSnapshotToSave) {
      legalSnapshotToSave = {
        ...legalSnapshotToSave,
        ipAddress: clientIP,
        customerEmail: legalSnapshotToSave.customerEmail || safeEmail || "",
      };
    }
    const geo = await getGeoFromIpApi(rawClientIp);
    const clientCountry = geo.country || "";
    const clientRegion = geo.region || "";
    const clientCity = geo.city || "";

    existingCarId = String(existingCar._id || "");
    ownerCompanyId = String(ownerCompany?._id || "");
    const idempotentOrder = orderNumber
      ? await Order.findOne({
          orderNumber: String(orderNumber).trim(),
          car: existingCar._id,
          email: safeEmail,
        }).lean()
      : null;
    if (idempotentOrder) {
      return new Response(JSON.stringify(idempotentOrder), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      customerName: customerNameToSave,
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
      pickupMethod: pickupMethodToSave || undefined,
      returnMethod: returnMethodToSave || undefined,
      locationSnapshot: locationSnapshotToSave || undefined,
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
      ownerId:
        existingCar.ownerId ||
        (isMarketplaceRequestMode(bookingMode) ? null : COMPANY_ID),
      fromLocalhost,
      drivingLicenceUrls,
      termsAcceptance: termsAcceptanceToSave,
      legalSnapshot: legalSnapshotToSave,
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
    if (pickupMethodToSave) {
      newOrder.set("pickupMethod", pickupMethodToSave, { strict: false });
    }
    if (returnMethodToSave) {
      newOrder.set("returnMethod", returnMethodToSave, { strict: false });
    }
    if (locationSnapshotToSave) {
      newOrder.set("locationSnapshot", locationSnapshotToSave, { strict: false });
    }
    if (termsAcceptanceToSave) {
      newOrder.set("termsAcceptance", termsAcceptanceToSave, { strict: false });
    }
    if (legalSnapshotToSave) {
      newOrder.set("legalSnapshot", legalSnapshotToSave, { strict: false });
    }

    if (nonConfirmedDates.length > 0) {
      newOrder.hasConflictDates = [
        ...new Set([...newOrder.hasConflictDates, ...conflicOrdersId]),
      ];

      await newOrder.save();
      savedOrderId = String(newOrder._id || "");
      await attachOrderToActiveDiscount(newOrder);
      // Keep Car.orders in sync for pending orders too.
      if (!existingCar.orders.some((id) => String(id) === String(newOrder._id))) {
        existingCar.orders.push(newOrder._id);
        await existingCar.save();
      }

      await updateConflictingOrders(conflicOrdersId, newOrder._id);

      const payResult = await maybeStartRentalPrepaymentOnCreate({
        orderDoc: newOrder,
        ownerCompany,
        isAdminSession,
        offline: offlineToSave,
      });
      if (ownerMissing) {
        await warnMissingOwnerCompany(newOrder, existingCar);
      }
      const { notificationError, orderPlain } = await notifyAfterCreate({
        newOrder,
        payResult,
        session,
        company: ownerCompany,
        clientLocale,
        offlineToSave,
      });

      return new Response(
        JSON.stringify({
          messageCode: "bookMesssages.bookPendingDates",
          dates: nonConfirmedDates,
          data: orderPlain,
          ...(notificationError && { notificationError }),
          paymentUrl: payResult.url,
          paymentLinkStatus: payResult.status,
          paymentLinkMessage: payResult.message,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Save the new order
    await newOrder.save();
    savedOrderId = String(newOrder._id || "");
    await attachOrderToActiveDiscount(newOrder);
    // Add the new order to the car's orders array
    if (!existingCar.orders.some((id) => String(id) === String(newOrder._id))) {
      existingCar.orders.push(newOrder._id);
      // Save the updated car document
      await existingCar.save();
    }

    const payResult = await maybeStartRentalPrepaymentOnCreate({
      orderDoc: newOrder,
      ownerCompany,
      isAdminSession,
      offline: offlineToSave,
    });
    if (ownerMissing) {
      await warnMissingOwnerCompany(newOrder, existingCar);
    }
    const { notificationError, orderPlain } = await notifyAfterCreate({
      newOrder,
      payResult,
      session,
      company: ownerCompany,
      clientLocale,
      offlineToSave,
    });

    const body = { ...orderPlain };
    if (notificationError) body.notificationError = notificationError;
    body.paymentUrl = payResult.url;
    body.paymentLinkStatus = payResult.status;
    body.paymentLinkMessage = payResult.message;

    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ORDER-ADD] create failed", {
      correlationId,
      code: ORDER_CREATE_CODE.ORDER_CREATE_FAILED,
      failingGuard: "postOrderAddHandler",
      orderId: savedOrderId || "",
      carId: existingCarId,
      companyId: ownerCompanyId,
      errorName: error?.name || "Error",
      errorMessage: error?.message || "",
    });
    if (savedOrderId) {
      const saved = await Order.findById(savedOrderId).lean().catch(() => null);
      if (saved) {
        return new Response(
          JSON.stringify({
            ...saved,
            notificationError: "Notifications or follow-up steps failed after the order was saved.",
            correlationId,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
    return new Response(
      JSON.stringify({
        error: ORDER_CREATE_CODE.ORDER_CREATE_FAILED,
        message: customerMessageForCode(ORDER_CREATE_CODE.ORDER_CREATE_FAILED),
        correlationId,
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
