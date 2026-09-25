/**
 * @jest-environment node
 */
process.env.NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET || "test-secret-for-company-email-actions";
process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";

const mockSave = jest.fn().mockResolvedValue(undefined);
const createdDocs = [];

jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("@models/order", () => ({ Order: { findById: jest.fn() } }));
jest.mock("@models/company", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock("@models/OrderSupportMessage", () => {
  const create = jest.fn();
  const find = jest.fn();
  const findOne = jest.fn();
  return {
    __esModule: true,
    SUPPORT_MESSAGE_REASONS: [
      "booking_question",
      "vehicle_unavailable",
      "customer_details",
      "payment_issue",
      "pickup_return_issue",
      "other",
    ],
    SUPPORT_DELIVERY_STATUS: {
      PENDING: "pending",
      SENT: "sent",
      FAILED: "failed",
      SKIPPED: "skipped",
    },
    default: { create, find, findOne },
  };
});

import { sendEmailDirect } from "@/lib/email/sendDirect";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import Company from "@models/company";
import OrderSupportMessage from "@models/OrderSupportMessage";
import { ROVARO_MAILBOX } from "@config/email";
import { ROLE } from "@models/user";
import { signCompanyEmailActionToken } from "../companyEmailActionToken";
import {
  getRovaroSupportMailbox,
  listSupportMessagesForOrder,
  resolvePartnerSupportAccess,
  sendPartnerSupportMessage,
  superadminOrderStaffUrl,
  validateSupportMessage,
} from "../partnerSupportMessage";
import { renderPartnerSupportMessageEmail } from "@/app/ui/email/templates/partnerSupportMessage";

const ORDER_ID = "64b7f0c2a1b2c3d4e5f60789";
const COMPANY_A = "64b7f0c2a1b2c3d4e5f60701";
const COMPANY_B = "64b7f0c2a1b2c3d4e5f60702";

function makeOrder(overrides = {}) {
  return {
    _id: ORDER_ID,
    orderNumber: "RV-1001",
    ownerId: COMPANY_A,
    carModel: "Seat Leon",
    carNumber: "1234ABC",
    rentalStartDate: new Date("2026-06-01T10:00:00.000Z"),
    rentalEndDate: new Date("2026-06-05T10:00:00.000Z"),
    placeIn: "Malaga airport",
    placeOut: "Malaga airport",
    confirmed: false,
    status: "ACTIVE",
    customerName: "Secret Customer",
    phone: "+340000",
    email: "customer@example.com",
    drivingLicenceUrls: ["https://res.cloudinary.com/demo/licence.jpg"],
    ...overrides,
  };
}

function makeSaved(overrides = {}) {
  const doc = {
    _id: "64b7f0c2a1b2c3d4e5f60999",
    orderId: ORDER_ID,
    message: "Need a later pickup",
    reason: "booking_question",
    createdAt: new Date("2026-04-01T12:00:00.000Z"),
    emailStatus: "pending",
    telegramStatus: "pending",
    save: mockSave,
    ...overrides,
  };
  createdDocs.push(doc);
  return doc;
}

describe("validateSupportMessage", () => {
  test("rejects short and overlong text", () => {
    expect(validateSupportMessage({ message: "x" }).ok).toBe(false);
    expect(validateSupportMessage({ message: "ab".repeat(2001) }).ok).toBe(false);
    expect(validateSupportMessage({ message: "Hello", reason: "nope" }).ok).toBe(
      false
    );
  });

  test("accepts 2–4000 chars and known reasons", () => {
    const ok = validateSupportMessage({
      message: "Hi",
      reason: "payment_issue",
    });
    expect(ok).toEqual({ ok: true, message: "Hi", reason: "payment_issue" });
  });
});

describe("resolvePartnerSupportAccess", () => {
  test("unauthenticated without token is 401", async () => {
    const result = await resolvePartnerSupportAccess({});
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  test("token for another action is rejected", async () => {
    const token = signCompanyEmailActionToken({
      orderId: ORDER_ID,
      action: "accept",
    });
    const result = await resolvePartnerSupportAccess({ token });
    expect(result.ok).toBe(false);
  });

  test("valid message token binds that order", async () => {
    const token = signCompanyEmailActionToken({
      orderId: ORDER_ID,
      action: "message",
    });
    const result = await resolvePartnerSupportAccess({ token, orderId: "other" });
    expect(result).toMatchObject({
      ok: true,
      source: "email_token",
      orderId: ORDER_ID,
    });
  });
});

describe("sendPartnerSupportMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;
    Company.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({ name: "Costa Cars SL" }),
      }),
    });
    OrderSupportMessage.findOne.mockReturnValue({
      lean: async () => null,
    });
    OrderSupportMessage.create.mockImplementation(async (doc) => makeSaved(doc));
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
    sendTelegramDirect.mockResolvedValue(true);
  });

  test("stores the message on the order and emails the fixed Rovaro mailbox", async () => {
    const order = makeOrder();
    const result = await sendPartnerSupportMessage({
      order,
      message: "Need a later pickup",
      reason: "booking_question",
      actor: {
        source: "session",
        user: {
          id: "user-1",
          email: "partner@costa.test",
          role: ROLE.ADMIN,
          ownerId: COMPANY_A,
        },
        idempotencyKey: "idem-1",
        ipAddress: "1.2.3.4",
        userAgent: "jest",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(OrderSupportMessage.create).toHaveBeenCalledTimes(1);
    const saved = OrderSupportMessage.create.mock.calls[0][0];
    expect(saved.orderId).toBe(ORDER_ID);
    expect(saved.companyId).toBe(COMPANY_A);
    expect(saved.companyName).toBe("Costa Cars SL");
    expect(saved.message).toBe("Need a later pickup");
    expect(saved.reason).toBe("booking_question");
    expect(saved.ipAddress).toBe("1.2.3.4");

    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
    const email = sendEmailDirect.mock.calls[0][0];
    expect(email.to).toEqual([ROVARO_MAILBOX]);
    expect(email.to).toEqual(["admin@rovaro.autos"]);
    expect(email.title).toBe("[Rovaro] Partner message about booking RV-1001");
    expect(email.html).toContain("Costa Cars SL");
    expect(email.html).toContain("Need a later pickup");
    expect(email.html).not.toMatch(/CarsNK|Natali Cars|BBQR|carsnk\.gr|localhost/i);
    expect(email.html).not.toContain("Secret Customer");
    expect(email.html).toContain(superadminOrderStaffUrl(ORDER_ID));
    expect(email.html).toContain("rovaro.autos");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTNER_SUPPORT_MESSAGE_SENT" })
    );
  });

  test("escapes XSS in the HTML email", async () => {
    const xss = `<script>alert("xss")</script><img src=x onerror=alert(1)>`;
    await sendPartnerSupportMessage({
      order: makeOrder(),
      message: xss,
      reason: "other",
      actor: { source: "email_token", idempotencyKey: "xss-1" },
    });
    const html = sendEmailDirect.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("/brand/rovaro/wordmark-compact.png");
  });

  test("double submit with the same key does not create a second row", async () => {
    const existing = makeSaved({ idempotencyKey: "same-key" });
    OrderSupportMessage.findOne.mockReturnValue({
      lean: async () => existing,
    });

    const result = await sendPartnerSupportMessage({
      order: makeOrder(),
      message: "Need a later pickup",
      reason: "booking_question",
      actor: { source: "session", idempotencyKey: "same-key" },
    });

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(OrderSupportMessage.create).not.toHaveBeenCalled();
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("Telegram failure does not fail the request after a successful save", async () => {
    sendTelegramDirect.mockRejectedValue(new Error("telegram down"));
    const result = await sendPartnerSupportMessage({
      order: makeOrder(),
      message: "Still send this",
      reason: "other",
      actor: { source: "email_token", idempotencyKey: "tg-1" },
    });
    expect(result.ok).toBe(true);
    expect(sendEmailDirect).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  test("email failure still keeps the saved message and returns success", async () => {
    sendEmailDirect.mockRejectedValue(new Error("SMTP down"));
    const result = await sendPartnerSupportMessage({
      order: makeOrder(),
      message: "Keep this note",
      reason: "other",
      actor: { source: "email_token", idempotencyKey: "mail-fail" },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Rovaro support/i);
    expect(OrderSupportMessage.create).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  test("Telegram text omits customer PII and licence URLs", async () => {
    await sendPartnerSupportMessage({
      order: makeOrder(),
      message: "Car is late",
      reason: "pickup_return_issue",
      actor: { source: "email_token", idempotencyKey: "pii-1" },
    });
    const telegram = sendTelegramDirect.mock.calls[0][0];
    expect(telegram).not.toContain("Secret Customer");
    expect(telegram).not.toContain("+340000");
    expect(telegram).not.toContain("customer@example.com");
    expect(telegram).not.toContain("cloudinary.com");
  });
});

describe("listSupportMessagesForOrder", () => {
  test("superadmin history query returns stored messages", async () => {
    OrderSupportMessage.find.mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: "64b7f0c2a1b2c3d4e5f60999",
            orderId: ORDER_ID,
            message: "Need a later pickup",
            reason: "booking_question",
            companyName: "Costa Cars SL",
            emailStatus: "sent",
            createdAt: new Date("2026-04-01T12:00:00.000Z"),
          },
        ],
      }),
    });
    const items = await listSupportMessagesForOrder(ORDER_ID);
    expect(items).toHaveLength(1);
    expect(items[0].message).toBe("Need a later pickup");
    expect(items[0].orderId).toBe(ORDER_ID);
  });
});

describe("Rovaro branding helpers", () => {
  test("support mailbox is the fixed Rovaro address", () => {
    expect(getRovaroSupportMailbox()).toBe("admin@rovaro.autos");
  });

  test("staff email and template never mention CarsNK", () => {
    const html = renderPartnerSupportMessageEmail({
      bookingReference: "RV-1001",
      companyName: "Costa Cars SL",
      sender: "partner@costa.test",
      reasonLabel: "Question about booking",
      message: "Hello",
      bookingLines: [{ label: "Car", value: "Seat Leon" }],
      staffOrderUrl: superadminOrderStaffUrl(ORDER_ID),
    });
    expect(html).toContain("Rovaro");
    expect(html).toContain("NK Platform Studio");
    expect(html).toContain("admin@rovaro.autos");
    expect(html).not.toMatch(/CarsNK|Natali Cars|BBQR|carsnk\.gr/i);
    expect(superadminOrderStaffUrl(ORDER_ID)).toContain("/admin/emails?orderId=");
    expect(superadminOrderStaffUrl(ORDER_ID)).toContain("rovaro.autos");
  });
});
