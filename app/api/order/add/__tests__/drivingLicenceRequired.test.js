/**
 * @jest-environment node
 *
 * A public PLATFORM request cannot become an order without a driving licence,
 * and a refusal must leave nothing behind: no saved order, no Stripe session.
 */

process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

const savedOrders = [];
const carSave = jest.fn(async () => {});

jest.mock("@lib/database", () => ({ connectToDB: jest.fn(async () => {}) }));
jest.mock("@lib/authOptions", () => ({ authOptions: {} }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock("@/middleware/orderGuard", () => ({
  orderGuard: (handler) => handler,
}));

jest.mock("@models/order", () => {
  class Order {
    constructor(doc) {
      Object.assign(this, doc);
      this._id = "64a0000000000000000000aa";
      this.hasConflictDates = [];
    }
    set(field, value) {
      this[field] = value;
    }
    toObject() {
      return { ...this };
    }
    async save() {
      savedOrders.push({ ...this });
    }
  }
  Order.findOne = jest.fn(() => ({ select: () => ({ lean: async () => null }) }));
  Order.find = jest.fn(async () => []);
  Order.findById = jest.fn(() => ({ lean: async () => null }));
  return { Order };
});

jest.mock("@models/car", () => ({
  Car: {
    findById: jest.fn(async () => ({
      _id: "64a0000000000000000000c1",
      ownerId: "64a000000000000000000001",
      model: "Fiat Panda",
      carNumber: "C-1",
      regNumber: "AA-1111",
      orders: [],
      save: carSave,
    })),
    findOne: jest.fn(async () => null),
  },
}));

jest.mock("@models/company", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(() => ({
      lean: async () => ({
        _id: "64a000000000000000000001",
        name: "Sunny Cars",
        email: "ops@sunny.example",
        country: "GR",
      }),
    })),
  },
}));

jest.mock("@models/user", () => ({
  User: { findOne: jest.fn(async () => null) },
  ROLE: { ADMIN: 1, SUPERADMIN: 2 },
}));
jest.mock("@models/DiscountSetting", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(() => ({ sort: () => ({ lean: async () => null }) })),
    updateOne: jest.fn(async () => {}),
  },
}));
jest.mock("@models/auditLog", () => ({
  __esModule: true,
  default: { create: jest.fn(async () => {}) },
}));

jest.mock("@/domain/legal/partnerOperatingPolicy", () => ({
  PARTNER_OPERATION_PURPOSE: { BOOKING: "BOOKING" },
  assertPartnerCanOperate: jest.fn(async () => ({ allowed: true })),
}));
jest.mock("@/domain/platform/companyCountryScope", () => ({
  isCompanyInSiteCountry: jest.fn(() => true),
}));
jest.mock("@/domain/legal/documentService", () => ({
  resolveDocumentForDisplay: jest.fn(async () => ({
    doc: {
      checksum: "terms-checksum",
      version: 3,
      documentType: "CUSTOMER_BOOKING_TERMS",
      language: "en",
    },
  })),
}));
jest.mock("@/domain/orders/bookingTermsAcceptance", () => ({
  evaluateBookingTermsAcceptance: jest.fn(() => ({ ok: true })),
  buildTermsAcceptanceRecord: jest.fn(() => ({
    platform: { accepted: true, acceptedAt: new Date("2026-06-10T12:00:00Z") },
    company: { available: false },
    privacy: null,
  })),
}));
jest.mock("@/domain/company/customerRentalTerms", () => ({
  pickCompanyRentalTermsForLanguage: jest.fn(() => ({ available: false })),
}));
jest.mock("@/domain/legal/bookingLegalSnapshot", () => ({
  buildBookingLegalSnapshot: jest.fn(() => ({ customerBookingTerms: {} })),
}));
jest.mock("@/domain/platform/companyBookingCities", () => ({
  loadCompanyBookingCities: jest.fn(async () => [{ name: "Athens" }]),
}));
jest.mock("@/domain/booking/resolveRentalContext", () => ({
  resolveRentalBookingContext: jest.fn(() => ({
    timezone: "Europe/Athens",
    currency: "EUR",
    countryCode: "GR",
    bookingMode: "MARKETPLACE_REQUEST",
    initialBookingStatus: "PENDING_SUPPLIER_CONFIRMATION",
  })),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { REQUEST: "REQUEST" },
  evaluateRentalAvailability: jest.fn(() => ({ hardConflict: false })),
  toLegacyCreateConflict: jest.fn(() => null),
}));
jest.mock("@/domain/orders/rentalPricingService", () => {
  class RentalPricingError extends Error {}
  return {
    RentalPricingError,
    calculateAuthoritativeRentalPrice: jest.fn(async () => ({
      rentalDays: 7,
      pricingVersion: 1,
      calculatedAt: new Date("2026-06-10T12:00:00Z"),
      compatibility: { rentalTotal: 350, deliveryTotal: 0 },
      pickupFeeMinor: 0,
      returnFeeMinor: 0,
    })),
    detectClientTotalMismatch: jest.fn(() => null),
    toAuthoritativePriceDoc: jest.fn(() => ({ grossMinor: 35000 })),
  };
});
jest.mock("@/domain/platform/platformSettingsService", () => ({
  getPlatformMarketplaceFeeSettings: jest.fn(async () => ({})),
}));
jest.mock("@/domain/orders/priceBreakdownReconciliation", () => ({
  PRICE_BREAKDOWN_CUSTOMER_MESSAGE: "price",
  PRICE_BREAKDOWN_MISMATCH: "PRICE_BREAKDOWN_MISMATCH",
  assertAuthoritativePriceReconciled: jest.fn(() => ({ ok: true })),
  logPriceBreakdownMismatch: jest.fn(),
}));
jest.mock("@/domain/orders/bookingFinancialSnapshot", () => ({
  bookingFinancialSnapshotFromQuote: jest.fn(() => ({ grossMinor: 35000 })),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  createRentalCheckoutSession: jest.fn(async () => ({
    ok: true,
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  })),
}));
jest.mock("@/domain/orders/companyRentalPaymentPolicy", () => ({
  PAYMENT_LINK_STATUS: {
    READY: "READY",
    NOT_REQUIRED: "NOT_REQUIRED",
    FAILED: "FAILED",
    NOT_CONFIGURED: "NOT_CONFIGURED",
    AMOUNT_TOO_LOW: "AMOUNT_TOO_LOW",
  },
  resolveCompanyRentalPaymentPolicy: jest.fn(() => ({})),
  shouldChargeRentalOnCreate: jest.fn(() => true),
}));
jest.mock("@config/stripe", () => ({ isStripeConfigured: jest.fn(() => true) }));
jest.mock("@/domain/orders/orderNotificationDispatcher", () => ({
  notifyOrderAction: jest.fn(async () => {}),
}));
jest.mock("@/domain/notifications/notifySuperadmin", () => ({
  notifySuperadmin: jest.fn(async () => {}),
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn(async () => true),
}));
jest.mock("@/domain/orders/authoritativeLocationQuote", () => {
  class LocationQuoteError extends Error {}
  return {
    LocationQuoteError,
    quoteAuthoritativeLocations: jest.fn(async () => ({
      snapshot: null,
      eligibleOffices: [],
    })),
  };
});
jest.mock("@/domain/platform/bookingLocations", () => ({
  canonicalizeBookingLocation: jest.fn((name) => name),
  isAllowedBookingLocation: jest.fn(() => true),
  locationRequiresAddressDetail: jest.fn(() => false),
}));
jest.mock("@/domain/orders/customerBookingPlaces", () => ({
  resolveAllowedCustomerPlaceNames: jest.fn(() => ["Athens"]),
}));
jest.mock("@/domain/orders/carOffices", () => ({
  isPlaceMatchingCarOffice: jest.fn(() => true),
  resolveBookingDisplayOffices: jest.fn(() => []),
}));

import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { createUploadReceipt } from "@/domain/legal/drivingLicenceUploadReceipt";
import { POST } from "../route";

const VALID_RECEIPT = createUploadReceipt({
  storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
  storageType: "authenticated",
  checksum: "a".repeat(64),
  uploadedAt: new Date(),
  byteSize: 2048,
  contentType: "image/jpeg",
}).receipt;

function licence(overrides = {}) {
  return {
    holderName: "Ana Lopez",
    licenceNumber: "ES-1234567",
    issuingCountry: "ES",
    expiryDate: "2035-01-31",
    issueDate: "2015-03-02",
    uploadReceipt: VALID_RECEIPT,
    ...overrides,
  };
}

function body(overrides = {}) {
  return {
    carId: "64a0000000000000000000c1",
    customerName: "Ana Lopez",
    phone: "+34600000000",
    email: "ana@example.com",
    rentalStartDate: "2027-07-01",
    rentalEndDate: "2027-07-08",
    timeIn: "2027-07-01T09:00:00.000Z",
    timeOut: "2027-07-08T09:00:00.000Z",
    placeIn: "Athens",
    placeOut: "Athens",
    pickupMethod: "office",
    returnMethod: "office",
    my_order: true,
    locale: "en",
    termsAcceptance: { platform: { accepted: true } },
    drivingLicence: licence(),
    ...overrides,
  };
}

async function post(payload) {
  const request = new Request("https://rovaro.autos/api/order/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const res = await POST(request);
  return { res, body: await res.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  savedOrders.length = 0;
  // clearAllMocks keeps implementations, so the public (session-less) default has
  // to be restored or an admin session from an earlier block leaks in here.
  require("next-auth/next").getServerSession.mockResolvedValue(null);
  require("@models/user").User.findOne.mockResolvedValue(null);
});

describe("a public PLATFORM request without licence data", () => {
  it("is rejected outright", async () => {
    const { res, body: payload } = await post(body({ drivingLicence: undefined }));
    expect(res.status).toBe(400);
    expect(payload.error).toBe("DRIVING_LICENCE_REQUIRED");
    expect(payload.licenceCode).toBe("LICENCE_REQUIRED");
    expect(payload.messageKey).toBe("order.licenceRequired");
  });

  it("creates no order and no Stripe session", async () => {
    await post(body({ drivingLicence: undefined }));
    expect(savedOrders).toHaveLength(0);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
    expect(carSave).not.toHaveBeenCalled();
  });

  it("accepts photo-only licence data when the upload receipt is valid", async () => {
    const { res } = await post(
      body({
        drivingLicence: {
          uploadReceipt: VALID_RECEIPT,
        },
      })
    );
    expect([201, 202]).toContain(res.status);
    expect(savedOrders).toHaveLength(1);
    expect(savedOrders[0].drivingLicenceSnapshot).toEqual(
      expect.objectContaining({
        storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
        holderName: "",
        licenceNumber: "",
      })
    );
  });

  it("never echoes the upload receipt back to the customer", async () => {
    const { body: payload } = await post(
      body({ drivingLicence: licence({ uploadReceipt: "" }) })
    );
    expect(JSON.stringify(payload)).not.toContain(VALID_RECEIPT);
  });
});

describe("a failed licence upload", () => {
  it("creates no order and no Stripe session when the receipt is missing", async () => {
    const { res, body: payload } = await post(
      body({ drivingLicence: licence({ uploadReceipt: "" }) })
    );
    expect(res.status).toBe(400);
    expect(payload.licenceCode).toBe("LICENCE_UPLOAD_MISSING");
    expect(savedOrders).toHaveLength(0);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates no order when the receipt is forged", async () => {
    const [version, payloadPart] = VALID_RECEIPT.split(".");
    const { res, body: payload } = await post(
      body({
        drivingLicence: licence({
          uploadReceipt: `${version}.${payloadPart}.forged`,
        }),
      })
    );
    expect(res.status).toBe(400);
    expect(payload.licenceCode).toBe("LICENCE_UPLOAD_FAILED");
    expect(savedOrders).toHaveLength(0);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  it("ignores a client-supplied upload descriptor with no receipt", async () => {
    const { res, body: payload } = await post(
      body({
        drivingLicence: licence({
          uploadReceipt: "",
          upload: {
            storageReference: "carsnk/orders/anything",
            checksum: "b".repeat(64),
            uploadedAt: new Date().toISOString(),
          },
        }),
      })
    );
    expect(res.status).toBe(400);
    expect(payload.licenceCode).toBe("LICENCE_UPLOAD_MISSING");
    expect(savedOrders).toHaveLength(0);
  });
});

describe("a complete public PLATFORM request", () => {
  it("is created and stores the licence snapshot", async () => {
    const { res } = await post(body());
    expect([201, 202]).toContain(res.status);
    expect(savedOrders).toHaveLength(1);

    const snapshot = savedOrders[0].drivingLicenceSnapshot;
    expect(snapshot).toEqual(
      expect.objectContaining({
        storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
        checksum: "a".repeat(64),
        holderName: "Ana Lopez",
        licenceNumber: "ES-1234567",
        issuingCountry: "ES",
        verificationStatus: "PENDING",
      })
    );
    expect(snapshot.uploadedAt).toBeInstanceOf(Date);
    expect(snapshot.expiryDate).toBeInstanceOf(Date);
    expect(snapshot.issueDate).toBeInstanceOf(Date);
  });

  it("does not persist client-supplied raw licence URLs", async () => {
    await post(
      body({
        drivingLicenceUrls: ["https://res.cloudinary.com/demo/image/upload/x.jpg"],
      })
    );
    expect(savedOrders[0].drivingLicenceUrls).toEqual([]);
  });

  it("marks the booking as a PLATFORM source", async () => {
    await post(body());
    expect(savedOrders[0].source).toBe("PLATFORM");
  });
});

describe("an INTERNAL contractor record is unaffected", () => {
  beforeEach(() => {
    const { getServerSession } = require("next-auth/next");
    const { User } = require("@models/user");
    getServerSession.mockResolvedValue({
      user: { isAdmin: true, name: "ops", role: 1, ownerId: "64a000000000000000000001" },
    });
    User.findOne.mockResolvedValue({ _id: "64a00000000000000000000f", role: 1 });
  });

  it("is created with no licence data at all", async () => {
    const { res } = await post(
      body({ my_order: false, offline: true, confirmed: true, drivingLicence: undefined })
    );
    expect([201, 202]).toContain(res.status);
    expect(savedOrders).toHaveLength(1);
    expect(savedOrders[0].source).toBe("INTERNAL");
    expect(savedOrders[0].drivingLicenceSnapshot).toBeUndefined();
  });

  it("is still created when the admin books on a customer's behalf without a licence", async () => {
    const { res } = await post(body({ my_order: true, drivingLicence: undefined }));
    expect([201, 202]).toContain(res.status);
    expect(savedOrders).toHaveLength(1);
    expect(savedOrders[0].drivingLicenceSnapshot).toBeUndefined();
  });
});

describe("the ordering that makes a partial booking impossible", () => {
  it("refuses before the availability search, the price quote and the save", async () => {
    const {
      evaluateRentalAvailability,
    } = require("@/domain/booking/availabilityEngine");
    const {
      calculateAuthoritativeRentalPrice,
    } = require("@/domain/orders/rentalPricingService");

    await post(body({ drivingLicence: undefined }));

    expect(evaluateRentalAvailability).not.toHaveBeenCalled();
    expect(calculateAuthoritativeRentalPrice).not.toHaveBeenCalled();
    expect(savedOrders).toHaveLength(0);
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });
});
