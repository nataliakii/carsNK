/**
 * @jest-environment node
 *
 * Rehoming a declined customer: a superadmin creates an order in the admin
 * calendar for another company, and it has to be born as a PLATFORM booking
 * awaiting that company's confirmation — priced at that company's own fee rate,
 * whatever the browser claims.
 *
 * The pricing service is deliberately NOT mocked, so the Rovaro Booking Fee in
 * the assertions is the one the real resolver produced from the company record.
 */

const savedOrders = [];
const carSave = jest.fn(async () => {});

const SUPPLIER_ID = "64a000000000000000000001";
const PLATFORM_COMPANY_ID = "679903bd10e6c8a8c0f027bc";
const CAR_ID = "64a0000000000000000000c1";

/** Negotiated 30%, not the 10% platform default. */
let supplierCompany = {
  _id: SUPPLIER_ID,
  name: "Sunny Cars",
  email: "ops@sunny.example",
  country: "ES",
  marketplaceBookingFeeBps: 3000,
};

jest.mock("@lib/database", () => ({ connectToDB: jest.fn(async () => {}) }));
jest.mock("@lib/authOptions", () => ({ authOptions: {} }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock("@/middleware/orderGuard", () => ({ orderGuard: (handler) => handler }));

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
      model: "Seat Leon",
      carNumber: "C-1",
      regNumber: "AA-1111",
      offices: [],
      orders: [],
      save: carSave,
      // The real pricing service calls this; delivery is resolved separately
      // and fails closed to zero without a database.
      calculateTotalRentalPricePerDay: async () => ({
        total: 350,
        days: 7,
        breakdown: { baseRentalTotal: 350 },
      }),
    })),
    findOne: jest.fn(async () => null),
  },
}));

jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn(() => ({ lean: async () => supplierCompany })) },
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
jest.mock("@/domain/platform/companyBookingCities", () => ({
  loadCompanyBookingCities: jest.fn(async () => [{ name: "Malaga" }]),
}));
jest.mock("@/domain/platform/platformSettingsService", () => ({
  getPlatformMarketplaceFeeSettings: jest.fn(async () => ({})),
}));
jest.mock("@/domain/booking/availabilityEngine", () => ({
  AVAILABILITY_PURPOSE: { REQUEST: "REQUEST" },
  evaluateRentalAvailability: jest.fn(() => ({ hardConflict: false })),
  toLegacyCreateConflict: jest.fn(() => null),
}));
jest.mock("@/domain/delivery/calculateDeliveryPrice", () => ({
  calculateDeliveryPrice: jest.fn(async () => ({
    deliveryIn: 0,
    deliveryOut: 0,
    deliveryTotal: 0,
  })),
}));
jest.mock("@/domain/orders/rentalStripeCheckout", () => ({
  createRentalCheckoutSession: jest.fn(async () => ({
    ok: true,
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  })),
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

import { BOOKING_STATUS } from "@/domain/booking/bookingStatus";
import { BOOKING_MODES } from "@/domain/booking/bookingMode";
import { createRentalCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { notifyOrderAction } from "@/domain/orders/orderNotificationDispatcher";
import { POST } from "../route";

function body(overrides = {}) {
  return {
    carId: CAR_ID,
    customerName: "Ana Lopez",
    phone: "+34600000000",
    email: "ana@example.com",
    rentalStartDate: "2027-07-01",
    rentalEndDate: "2027-07-08",
    timeIn: "2027-07-01T09:00:00.000Z",
    timeOut: "2027-07-08T09:00:00.000Z",
    placeIn: "Malaga",
    placeOut: "Malaga",
    my_order: false,
    offline: false,
    confirmed: false,
    insurance: "TPL",
    ChildSeats: 0,
    locale: "en",
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

function asSuperadmin() {
  require("next-auth/next").getServerSession.mockResolvedValue({
    user: { isAdmin: true, name: "rovaro", role: 2, ownerId: null },
  });
  require("@models/user").User.findOne.mockResolvedValue({
    _id: "64a00000000000000000000f",
    role: 2,
  });
}

function asCompanyAdmin(companyId = SUPPLIER_ID) {
  require("next-auth/next").getServerSession.mockResolvedValue({
    user: { isAdmin: true, name: "sunny", role: 1, ownerId: companyId },
  });
  require("@models/user").User.findOne.mockResolvedValue({
    _id: "64a00000000000000000001f",
    role: 1,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  savedOrders.length = 0;
  supplierCompany = {
    _id: SUPPLIER_ID,
    name: "Sunny Cars",
    email: "ops@sunny.example",
    country: "ES",
    marketplaceBookingFeeBps: 3000,
  };
  require("next-auth/next").getServerSession.mockResolvedValue(null);
  require("@models/user").User.findOne.mockResolvedValue(null);
});

describe("a superadmin creating for another company", () => {
  test("stores a PLATFORM booking pending that supplier's confirmation", async () => {
    asSuperadmin();
    const { res } = await post(body());
    expect([201, 202]).toContain(res.status);
    expect(savedOrders).toHaveLength(1);

    const order = savedOrders[0];
    expect(order.source).toBe("PLATFORM");
    expect(order.bookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
    expect(order.bookingMode).toBe(BOOKING_MODES.MARKETPLACE_REQUEST);
    expect(order.confirmed).toBe(false);
    expect(order.offline).toBe(false);
    expect(order.ownerId).toBe(SUPPLIER_ID);
  });

  test("prices it at the target company's own booking fee rate", async () => {
    asSuperadmin();
    await post(body());
    const order = savedOrders[0];
    expect(order.authoritativePrice.grossMinor).toBe(35000);
    expect(order.authoritativePrice.marketplaceBookingFeeBps).toBe(3000);
    expect(order.bookingFinancialSnapshot).toEqual(
      expect.objectContaining({
        grossMinor: 35000,
        feeBps: 3000,
        bookingFeeMinor: 10500,
        supplierBalanceMinor: 24500,
      })
    );
  });

  test("follows the company's rate rather than a hardcoded percentage", async () => {
    supplierCompany = { ...supplierCompany, marketplaceBookingFeeBps: 1200 };
    asSuperadmin();
    await post(body());
    expect(savedOrders[0].bookingFinancialSnapshot).toEqual(
      expect.objectContaining({ feeBps: 1200, bookingFeeMinor: 4200 })
    );
  });

  test("gets a public booking reference, like a website request", async () => {
    asSuperadmin();
    await post(body());
    expect(savedOrders[0].publicReference).toMatch(/^RVR-/);
  });

  test("fires the existing new-request notification, not a new event", async () => {
    asSuperadmin();
    await post(body());
    expect(notifyOrderAction).toHaveBeenCalledTimes(1);
    const call = notifyOrderAction.mock.calls[0][0];
    expect(call.action).toBe("CREATE");
    expect(call.companyEmail).toBe("ops@sunny.example");
    expect(call.order.source).toBe("PLATFORM");
    expect(call.order.my_order).toBe(true);
  });

  test("takes no money at create — the customer pays after the supplier confirms", async () => {
    asSuperadmin();
    await post(body());
    expect(createRentalCheckoutSession).not.toHaveBeenCalled();
  });

  test("ignores the Offline checkbox rather than billing an offline record", async () => {
    asSuperadmin();
    await post(body({ offline: true, confirmed: true }));
    const order = savedOrders[0];
    expect(order.offline).toBe(false);
    expect(order.confirmed).toBe(false);
    expect(order.source).toBe("PLATFORM");
    expect(order.bookingStatus).toBe(
      BOOKING_STATUS.PENDING_SUPPLIER_CONFIRMATION
    );
  });

  test("ignores a hand-typed total so the fee cannot be charged on another figure", async () => {
    asSuperadmin();
    await post(body({ totalPrice: 90 }));
    const order = savedOrders[0];
    expect(order.totalPrice).toBe(350);
    expect(order.authoritativePrice.grossMinor).toBe(35000);
  });

  test("still needs a reachable customer, because that customer must pay", async () => {
    asSuperadmin();
    const { res } = await post(body({ email: "" }));
    expect(res.status).toBe(400);
    expect(savedOrders).toHaveLength(0);
  });
});

describe("a client that declares its own source", () => {
  test("is ignored on the platform path", async () => {
    asSuperadmin();
    await post(body({ source: "INTERNAL", my_order: false }));
    expect(savedOrders[0].source).toBe("PLATFORM");
  });

  test("is ignored on the internal path", async () => {
    asCompanyAdmin();
    await post(body({ source: "PLATFORM", my_order: false }));
    expect(savedOrders[0].source).toBe("INTERNAL");
  });
});

describe("a company admin creating for its own company", () => {
  test("still produces an INTERNAL record with no booking fee", async () => {
    asCompanyAdmin();
    const { res } = await post(body());
    expect([201, 202]).toContain(res.status);

    const order = savedOrders[0];
    expect(order.source).toBe("INTERNAL");
    expect(order.my_order).toBe(false);
    expect(order.bookingMode).toBe(BOOKING_MODES.OPS_CALENDAR);
    expect(order.bookingStatus).toBeUndefined();
    expect(order.bookingFinancialSnapshot).toBeUndefined();
    expect(order.publicReference).toBeUndefined();
    expect(order.authoritativePrice.marketplaceBookingFeeBps).toBeUndefined();
  });

  test("keeps the Offline checkbox blocking the car as its own record", async () => {
    asCompanyAdmin();
    await post(body({ offline: true, confirmed: true }));
    const order = savedOrders[0];
    expect(order.source).toBe("INTERNAL");
    expect(order.offline).toBe(true);
    expect(order.confirmed).toBe(true);
  });

  test("keeps its hand-typed total", async () => {
    asCompanyAdmin();
    await post(body({ totalPrice: 400 }));
    expect(savedOrders[0].totalPrice).toBe(400);
  });
});

describe("a superadmin creating on Rovaro's own company", () => {
  test("keeps an internal record instead of brokering to itself", async () => {
    supplierCompany = {
      _id: PLATFORM_COMPANY_ID,
      name: "Rovaro",
      email: "ops@rovaro.example",
      country: "ES",
    };
    require("@models/car").Car.findById.mockResolvedValue({
      _id: CAR_ID,
      ownerId: PLATFORM_COMPANY_ID,
      model: "Seat Leon",
      carNumber: "C-1",
      regNumber: "AA-1111",
      offices: [],
      orders: [],
      save: carSave,
      calculateTotalRentalPricePerDay: async () => ({
        total: 350,
        days: 7,
        breakdown: { baseRentalTotal: 350 },
      }),
    });
    asSuperadmin();
    await post(body());
    const order = savedOrders[0];
    expect(order.source).toBe("INTERNAL");
    expect(order.bookingStatus).toBeUndefined();
    expect(order.bookingFinancialSnapshot).toBeUndefined();
  });
});
