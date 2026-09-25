/**
 * @jest-environment node
 */
import { sendPaidBookingEmails, assertSupplierRecipients } from "../paidBookingEmails";
import { MAIL_RENDER_KEY, MAIL_TYPE } from "@/domain/mail/mailTypes";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import MailLog from "@models/MailLog";
import Company from "@models/company";
import { User } from "@models/user";

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@models/MailLog", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/user", () => ({
  ROLE: { ADMIN: 1, SUPERADMIN: 2 },
  User: { find: jest.fn() },
}));

const COMPANY_A = "64b7f2c3a1b2c3d4e5f60788";
const COMPANY_B = "64b7f2c3a1b2c3d4e5f60711";
const MONGO_ID = "6ab65fce36f96a68058125cd";
const ORDER_NUMBER = "20260925134903";
const STRIPE_REF = "pi_3UJY122KmkWc8VQH0QOL0";
const ACCESS = "opaque-customer-access-token";

function paidOrder(extra = {}) {
  return {
    _id: MONGO_ID,
    orderNumber: ORDER_NUMBER,
    publicReference: "RVR-7K4P9",
    _customerAccessToken: ACCESS,
    my_order: true,
    source: "PLATFORM",
    ownerId: COMPANY_A,
    bookingMode: "MARKETPLACE_REQUEST",
    bookingStatus: "BOOKING_CONFIRMED",
    email: "customer@example.com",
    customerName: "Ana",
    phone: "+34600000000",
    carModel: "Seat Leon",
    clientLang: "en",
    placeIn: "Barcelona airport",
    placeOut: "Barcelona airport",
    pickupAtUtc: "2026-10-01T10:00:00.000Z",
    returnAtUtc: "2026-10-05T10:00:00.000Z",
    locationSnapshot: {
      pickup: { instructions: "Desk 4, terminal 1" },
    },
    currency: "EUR",
    totalPrice: 165,
    bookingFinancialSnapshot: {
      calculationVersion: 1,
      currency: "EUR",
      feeBps: 1000,
      feePercent: 10,
      grossMinor: 16500,
      bookingFeeMinor: 1650,
      supplierBalanceMinor: 14850,
      source: "configured",
    },
    payment: {
      status: "paid",
      paymentIntentId: STRIPE_REF,
      providerPaymentId: "cs_test_checkout",
    },
    ...extra,
  };
}

function companyDoc(id) {
  if (String(id) === COMPANY_A) {
    return {
      name: "Test Spanish Company",
      email: "a@co.test",
      meetingContactPhone: "+34930000000",
      emailPreferences: null,
    };
  }
  if (String(id) === COMPANY_B) {
    return { name: "Other Company", email: "b@co.test", emailPreferences: null };
  }
  return null;
}

describe("paid booking emails", () => {
  const originalInternal = process.env.MAIL_INTERNAL_TO;
  const originalSuper = process.env.AUTH_SUPERADMIN_EMAIL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MAIL_INTERNAL_TO = "ops@rovaro.autos";
    process.env.AUTH_SUPERADMIN_EMAIL = "ops@rovaro.autos";
    MailLog.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
    Company.findById.mockImplementation((id) => ({
      select: () => ({ lean: () => Promise.resolve(companyDoc(id)) }),
    }));
    User.find.mockImplementation((query) => ({
      select: () => ({
        lean: () => {
          const ownerId = String(query?.ownerId || "");
          if (ownerId === COMPANY_A) {
            return Promise.resolve([
              {
                email: "a@co.test",
                ownerId,
                disabledAt: null,
                lastLoginAt: new Date(),
              },
            ]);
          }
          if (ownerId === COMPANY_B) {
            return Promise.resolve([
              {
                email: "b@co.test",
                ownerId,
                disabledAt: null,
                lastLoginAt: new Date(),
              },
            ]);
          }
          return Promise.resolve([]);
        },
      }),
    }));
  });

  afterAll(() => {
    if (originalInternal === undefined) delete process.env.MAIL_INTERNAL_TO;
    else process.env.MAIL_INTERNAL_TO = originalInternal;
    if (originalSuper === undefined) delete process.env.AUTH_SUPERADMIN_EMAIL;
    else process.env.AUTH_SUPERADMIN_EMAIL = originalSuper;
  });

  test("customer, supplier, and superadmin receive different templates", async () => {
    const result = await sendPaidBookingEmails({ order: paidOrder() });
    expect(result.settled).toBe(true);
    expect(sendEmailDirect).toHaveBeenCalledTimes(3);

    const calls = sendEmailDirect.mock.calls.map((call) => call[0]);
    const customer = calls.find((call) => call.to.includes("customer@example.com"));
    const supplier = calls.find(
      (call) => call.meta.renderKey === MAIL_RENDER_KEY.SUPPLIER_BOOKING_PAID
    );
    const superadmin = calls.find(
      (call) => call.meta.renderKey === MAIL_RENDER_KEY.SUPERADMIN_BOOKING_PAYMENT_RECEIVED
    );

    expect(customer.meta.renderKey).toBe(MAIL_RENDER_KEY.CUSTOMER_BOOKING_CONFIRMED);
    expect(customer.meta.type).toBe(MAIL_TYPE.CUSTOMER_BOOKING_CONFIRMED);
    expect(supplier.meta.renderKey).toBe(MAIL_RENDER_KEY.SUPPLIER_BOOKING_PAID);
    expect(superadmin.meta.renderKey).toBe(MAIL_RENDER_KEY.SUPERADMIN_BOOKING_PAYMENT_RECEIVED);
    expect(customer.meta.renderKey).not.toBe(supplier.meta.renderKey);
    expect(customer.meta.renderKey).not.toBe(superadmin.meta.renderKey);
    expect(supplier.to).toEqual(["a@co.test"]);
    expect(superadmin.to).toEqual(["ops@rovaro.autos"]);

    const customerBlob = `${customer.html}\n${customer.message}`;
    expect(customer.title).toBe("Booking confirmed — Seat Leon, 1–5 Oct");
    expect(customerBlob).toContain("Your booking is confirmed");
    expect(customerBlob).toContain("We have received your €16.50 Rovaro Booking Fee.");
    expect(customerBlob).toContain("Total rental price");
    expect(customerBlob).toContain("€165.00");
    expect(customerBlob).toContain("Paid to Rovaro");
    expect(customerBlob).toContain("€16.50");
    expect(customerBlob).toContain("Pay to the rental company");
    expect(customerBlob).toContain("€148.50");
    expect(customerBlob).toContain("Test Spanish Company");
    expect(customerBlob).toContain("+34930000000");
    expect(customerBlob).toContain("a@co.test");
    expect(customerBlob).toContain("Desk 4, terminal 1");
    expect(customerBlob).toContain(
      "The rental company can now review your driving documents and contact you regarding collection."
    );
    expect(customerBlob).toContain("View booking details");
    expect(customerBlob).toContain("Booking reference: RVR-7K4P9");
    expect(customer.message).toContain("/en/booking/RVR-7K4P9?access=");
    expect(customer.html).toContain("View booking details");
    expect(customer.html).not.toMatch(/>https?:\/\//);
    expect(customerBlob).not.toMatch(/\/admin\b/);
    expect(customerBlob).not.toMatch(/admin\/login|sign in to admin/i);
    expect(customerBlob).not.toContain(MONGO_ID);
    expect(customerBlob).not.toContain(ORDER_NUMBER);
    expect(customerBlob).not.toContain(STRIPE_REF);
    expect(customerBlob).not.toContain("cs_test_checkout");
    expect(customerBlob).not.toContain("BOOKING_CONFIRMED");
    expect(customerBlob).not.toMatch(/Fee %|Gross:|Remaining to company|Stripe ref/i);
    expect(customer.meta.payload).not.toHaveProperty("accessToken");

    const supplierBlob = `${supplier.html}\n${supplier.message}`;
    expect(supplier.title).toBe("Booking confirmed — customer payment received");
    expect(supplierBlob).toMatch(/paid the Rovaro Booking Fee/i);
    expect(supplierBlob).toMatch(/driving documents/i);
    expect(supplierBlob).toContain("€148.50");
    expect(supplierBlob).toContain("Seat Leon");
    expect(supplierBlob).toContain("Ana");
    expect(supplier.html).toContain("Open confirmed booking");
    expect(supplier.html).not.toMatch(/>https?:\/\//);
    expect(supplier.message).toContain(`/admin/orders?orderId=${MONGO_ID}`);
    expect(supplierBlob).not.toContain(ACCESS);
    expect(supplier.to).not.toContain("customer@example.com");
    expect(supplier.to).not.toContain("b@co.test");

    const adminBlob = `${superadmin.html}\n${superadmin.message}`;
    expect(superadmin.title).toBe("Booking payment received — RVR-7K4P9");
    expect(adminBlob).toContain("RVR-7K4P9");
    expect(adminBlob).toContain(MONGO_ID);
    expect(adminBlob).toContain("Test Spanish Company");
    expect(adminBlob).toContain("€165.00");
    expect(adminBlob).toContain("€16.50");
    expect(adminBlob).toContain("10%");
    expect(adminBlob).toContain("€148.50");
    expect(adminBlob).toContain(STRIPE_REF);
    expect(adminBlob).toContain("BOOKING_CONFIRMED");
    expect(superadmin.html).toContain("Open booking");
    expect(superadmin.html).not.toMatch(/>https?:\/\//);
    expect(superadmin.message).toContain(`/admin/orders?orderId=${MONGO_ID}`);
    expect(adminBlob).not.toContain(ACCESS);
  });

  test("company isolation rejects a foreign supplier recipient", () => {
    expect(assertSupplierRecipients(["b@co.test"], ["a@co.test"]).ok).toBe(false);
    expect(assertSupplierRecipients(["a@co.test"], ["a@co.test"]).ok).toBe(true);
  });

  test("a second send is deduped", async () => {
    const sent = new Set();
    MailLog.findOne.mockImplementation((query) => ({
      select: () => ({
        lean: () =>
          Promise.resolve(sent.has(`${query.type}:${String(query.orderId)}`) ? { _id: "row" } : null),
      }),
    }));
    sendEmailDirect.mockImplementation(async (payload) => {
      sent.add(`${payload.meta.type}:${String(payload.meta.orderId)}`);
      return { messageId: "m1" };
    });

    const first = await sendPaidBookingEmails({ order: paidOrder() });
    expect(first.settled).toBe(true);
    expect(sendEmailDirect).toHaveBeenCalledTimes(3);

    const second = await sendPaidBookingEmails({ order: paidOrder() });
    expect(second.deduped).toBe(true);
    expect(second.settled).toBe(true);
    expect(sendEmailDirect).toHaveBeenCalledTimes(3);
  });

  test("email failure does not throw and does not mark the send settled", async () => {
    sendEmailDirect.mockRejectedValue(new Error("smtp down"));
    const order = paidOrder();
    const result = await sendPaidBookingEmails({ order });
    expect(result.settled).toBe(false);
    expect(order.payment.status).toBe("paid");
    expect(order.payment.paymentIntentId).toBe(STRIPE_REF);
    expect(order.bookingStatus).toBe("BOOKING_CONFIRMED");
  });
});
