/**
 * @jest-environment node
 */
import {
  MARKETPLACE_EMAIL_COPY,
  sendCustomerDeclineEmail,
  sendCustomerNewPaymentLinkEmail,
  sendCustomerPaymentExpiredEmail,
  sendCustomerPaymentLinkUnavailableEmail,
  sendCustomerPaymentRequestEmail,
  sendPaidConfirmationEmails,
} from "../marketplaceBookingEmails";
import { sendEmailDirect } from "@/lib/email/sendDirect";
import MailLog from "@models/MailLog";
import Company from "@models/company";

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
jest.mock("@/domain/mail/notificationPolicy", () => ({
  notifyBookingFeePaid: jest.fn().mockResolvedValue({ ok: true }),
}));

import { notifyBookingFeePaid } from "@/domain/mail/notificationPolicy";

const order = {
  _id: "64b7f2c3a1b2c3d4e5f60789",
  my_order: true,
  source: "PLATFORM",
  orderNumber: "20260921120000",
  ownerId: "64b7f2c3a1b2c3d4e5f60788",
  email: "ana@example.com",
  customerName: "Ana",
  phone: "+34600000000",
  carModel: "Seat Leon",
  placeIn: "Barcelona",
  placeOut: "Madrid",
  pickupAtUtc: "2026-10-01T10:00:00.000Z",
  returnAtUtc: "2026-10-05T10:00:00.000Z",
  clientLang: "en",
  authoritativePrice: {
    currency: "EUR",
    grossMinor: 100000,
    prepaymentMinor: 10000,
    balanceMinor: 90000,
  },
};

describe("marketplace booking emails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MailLog.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    });
    sendEmailDirect.mockResolvedValue({ messageId: "m1" });
  });

  test("customer and partner emails contain office/address snapshot", async () => {
    const located = {
      ...order,
      locationSnapshot: {
        pickup: {
          kind: "office",
          name: "Rovaro BCN",
          address: "Carrer de Mallorca 1, Barcelona",
          feeMajor: 0,
        },
        return: {
          kind: "delivery",
          address: "Hotel Arts, Barcelona",
          city: "Barcelona",
          country: "ES",
          feeMajor: 25,
        },
        currency: "EUR",
      },
    };
    await sendCustomerPaymentRequestEmail({
      order: located,
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_test",
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.html).toContain("Carrer de Mallorca 1");
    expect(payload.html).toContain("Hotel Arts");
    expect(payload.html).toContain("Office pickup");
    expect(payload.html).toContain("Delivery return");
  });

  test("EN/ES payment subjects and branding", async () => {
    expect(MARKETPLACE_EMAIL_COPY.en.paymentSubject).toBe(
      "Your Rovaro car is available — complete your booking"
    );
    expect(MARKETPLACE_EMAIL_COPY.es.paymentSubject).toBe(
      "Tu coche Rovaro está disponible — completa tu reserva"
    );
    await sendCustomerPaymentRequestEmail({
      order,
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_test",
      expiresAt: new Date("2026-09-21T20:00:00.000Z"),
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.title).toBe(MARKETPLACE_EMAIL_COPY.en.paymentSubject);
    expect(payload.html).toContain("Pay now");
    expect(payload.html).toContain("https://checkout.stripe.com/c/pay/cs_test");
    expect(payload.html).toContain("admin@rovaro.autos");
    expect(payload.html).toContain("NK Platform Studio");
    expect(payload.html).toContain("Rovaro");
    expect(payload.html).not.toContain("BBQR");
    expect(payload.html).not.toContain("CarsNK");
    expect(payload.html).not.toContain("Natali Cars");
    expect(payload.html).toContain("€100 Rovaro booking fee · Non-refundable");
    expect(payload.to).toEqual(["ana@example.com"]);
  });

  test("15% snapshot is used in the payment CTA and remaining balance", async () => {
    await sendCustomerPaymentRequestEmail({
      order: {
        ...order,
        authoritativePrice: {
          ...order.authoritativePrice,
          marketplaceBookingFeeBps: 1500,
          platformAmountMinor: 15000,
          prepaymentMinor: 15000,
          balanceMinor: 85000,
          supplierBalanceMinor: 85000,
        },
      },
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_test",
      expiresAt: new Date("2026-09-21T20:00:00.000Z"),
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.html).toContain("Pay now");
    expect(payload.html).toContain("Pay at pickup");
    expect(payload.html).toContain("€150 Rovaro booking fee · Non-refundable");
    expect(payload.html).not.toContain("Pay 10% non-refundable Rovaro Booking Fee");
  });

  test("reject email says no money was taken", async () => {
    await sendCustomerDeclineEmail({ order, reason: "no car" });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.html).toContain("No money was taken");
    expect(payload.html).toContain("admin@rovaro.autos");
  });

  test("webhook replay does not resend paid emails", async () => {
    MailLog.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: "existing" }) }),
    });
    Company.findById.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ email: "owner@a.test", name: "Owner A" }),
      }),
    });
    const result = await sendPaidConfirmationEmails({ order });
    expect(result.customer.deduped).toBe(true);
    expect(result.partner.via).toBe("notification_policy");
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("payment notification failure does not change booking status", async () => {
    notifyBookingFeePaid.mockRejectedValueOnce(new Error("smtp down"));
    Company.findById.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ email: "owner@a.test", name: "Owner A" }),
      }),
    });
    const paid = {
      ...order,
      bookingStatus: "BOOKING_CONFIRMED",
      payment: { status: "paid" },
    };
    const result = await sendPaidConfirmationEmails({ order: paid });
    expect(paid.bookingStatus).toBe("BOOKING_CONFIRMED");
    expect(paid.payment.status).toBe("paid");
    expect(paid.supplierRemainingPaidAt).toBeUndefined();
    expect(result.partner.ok).toBe(false);
  });

  test("partner paid email includes customer PII only after pay", async () => {
    Company.findById.mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve({ email: "owner@a.test", name: "Owner A" }),
      }),
    });
    await sendPaidConfirmationEmails({ order });
    expect(notifyBookingFeePaid).toHaveBeenCalled();
    const payload = notifyBookingFeePaid.mock.calls[0][0];
    expect(payload.customerName).toBe("Ana");
    expect(payload.phone).toBe("+34600000000");
    expect(payload.email).toBe("ana@example.com");
    expect(JSON.stringify(payload)).not.toMatch(/licence|password|token=/i);
  });

  test("expired email says no money was taken and points to Rovaro", async () => {
    await sendCustomerPaymentExpiredEmail({
      order,
      stripeSessionId: "cs_old",
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.title).toBe(MARKETPLACE_EMAIL_COPY.en.expiredSubject);
    expect(payload.html).toContain("No money was taken");
    expect(payload.html).toContain("admin@rovaro.autos");
    expect(payload.html).toContain(order.orderNumber);
    expect(payload.meta.payload.stripeSessionId).toBe("cs_old");
  });

  test("11. unavailable payment-link email is sent once", async () => {
    await sendCustomerPaymentLinkUnavailableEmail({
      order,
      stripeSessionId: "cs_open",
    });
    MailLog.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: "existing" }) }),
    });
    const second = await sendCustomerPaymentLinkUnavailableEmail({
      order,
      stripeSessionId: "cs_open",
    });
    expect(second.deduped).toBe(true);
    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
  });

  test("12. customer unavailable email does not disclose compliance reason", async () => {
    expect(MARKETPLACE_EMAIL_COPY.en.unavailableBody).toBe(
      "This payment link is no longer available. Please contact Rovaro support."
    );
    expect(MARKETPLACE_EMAIL_COPY.es.unavailableBody).toBe(
      "Este enlace de pago ya no está disponible. Contacta con el soporte de Rovaro."
    );
    await sendCustomerPaymentLinkUnavailableEmail({
      order,
      stripeSessionId: "cs_open",
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.message).toContain(
      "This payment link is no longer available. Please contact Rovaro support."
    );
    expect(payload.html).toContain(
      "This payment link is no longer available. Please contact Rovaro support."
    );
    const blob = `${payload.title}\n${payload.message}\n${payload.html}`;
    expect(blob).not.toMatch(/suspend/i);
    expect(blob).not.toMatch(/reject/i);
    expect(blob).not.toMatch(/verif/i);
    expect(blob).not.toMatch(/agreement/i);
    expect(blob).not.toMatch(/compliance/i);
    expect(blob).not.toMatch(/legal profile/i);
  });

  test("reissue email contains the new Stripe URL", async () => {
    await sendCustomerNewPaymentLinkEmail({
      order,
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_new",
      expiresAt: new Date("2026-09-21T22:00:00.000Z"),
      stripeSessionId: "cs_new",
    });
    const payload = sendEmailDirect.mock.calls[0][0];
    expect(payload.html).toContain("https://checkout.stripe.com/c/pay/cs_new");
    expect(payload.html).toContain("NK Platform Studio");
    expect(payload.html).not.toContain("BBQR");
    expect(payload.meta.payload.stripeSessionId).toBe("cs_new");
  });

  test("MailLog does not incorrectly dedupe two Stripe sessions", async () => {
    MailLog.findOne.mockImplementation((query) => ({
      select: () => ({
        lean: () =>
          Promise.resolve(
            query["payload.stripeSessionId"] === "cs_old"
              ? { _id: "sent-old" }
              : null
          ),
      }),
    }));
    const first = await sendCustomerPaymentRequestEmail({
      order,
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_old",
      stripeSessionId: "cs_old",
    });
    const second = await sendCustomerPaymentRequestEmail({
      order,
      paymentUrl: "https://checkout.stripe.com/c/pay/cs_new",
      stripeSessionId: "cs_new",
    });
    expect(first.deduped).toBe(true);
    expect(second.deduped).toBe(false);
    expect(sendEmailDirect).toHaveBeenCalledTimes(1);
  });
});
