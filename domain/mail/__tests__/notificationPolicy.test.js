/**
 * @jest-environment node
 */
import {
  NOTIFICATION_EVENT,
  NOTIFICATION_MATRIX,
  buildNotificationIdempotencyKey,
} from "@/domain/mail/notificationEvents";
import {
  classifyCompanySettingChanges,
  classifyCarMaterialChanges,
} from "@/domain/mail/importantCompanyChanges";
import {
  normalizePartnerDeclineReason,
  recommendPartnerDeclineAction,
  PARTNER_DECLINE_REASON,
  PLATFORM_REFUND_RECOMMENDATION,
  COMPANY_DECLINE_CONFIRMATION_DISCLAIMER,
} from "@/domain/mail/partnerDeclinePolicy";
import {
  normalizeEmailPreferences,
  resolveCompanyPreferenceEmails,
} from "@/domain/mail/emailPreferences";
import { buildNotificationContent } from "@/domain/mail/notificationCopy";
import {
  buildBookingNotificationContext,
  orderFeePaidVerified,
  safeStripeRef,
} from "@/domain/mail/bookingNotificationContext";
import {
  isAutomaticMarketplaceFeeRefundForbidden,
  assertVoluntaryMarketplaceFeeRefund,
  blockAutomaticMarketplaceFeeRefund,
} from "@/domain/orders/marketplaceBookingFeeRefund";
import { ROLE } from "@models/user";

jest.mock("@/lib/email/sendDirect", () => ({
  sendEmailDirect: jest.fn().mockResolvedValue({ messageId: "mock-id" }),
}));
jest.mock("@/domain/mail/notificationIdempotency", () => ({
  hasNotificationBeenDelivered: jest.fn().mockResolvedValue(false),
  recordNotificationFailure: jest.fn().mockResolvedValue(undefined),
  buildNotificationIdempotencyKey: jest.requireActual(
    "@/domain/mail/notificationEvents"
  ).buildNotificationIdempotencyKey,
}));
jest.mock("@/domain/mail/notificationRecipients", () => ({
  resolveSuperadminRecipients: jest.fn(() => ["ops@example.com"]),
  resolveCompanyNotificationRecipients: jest.fn(async () => ({
    emails: ["admin-a@company.test"],
    company: { name: "Alpha Cars", email: "admin-a@company.test" },
  })),
  resolveCompanyAdminEmails: jest.fn(async () => ["admin-a@company.test"]),
  assertCompanyIsolation: jest.requireActual(
    "@/domain/mail/notificationRecipients"
  ).assertCompanyIsolation,
}));
jest.mock("@/domain/legal/auditTrail", () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(true),
}));

import { sendEmailDirect } from "@/lib/email/sendDirect";
import { hasNotificationBeenDelivered } from "@/domain/mail/notificationIdempotency";
import {
  resolveSuperadminRecipients,
  resolveCompanyNotificationRecipients,
  assertCompanyIsolation,
} from "@/domain/mail/notificationRecipients";
import { recordAuditEvent } from "@/domain/legal/auditTrail";
import {
  dispatchPlatformNotification,
  notifyBookingRequested,
  notifyBookingFeePaid,
  notifyBookingDeclined,
  notifyImportantCompanySettings,
  notifyCompanyCreated,
} from "@/domain/mail/notificationPolicy";

describe("platform notification matrix registry", () => {
  test("every matrix event declares company vs superadmin recipients", () => {
    for (const event of Object.values(NOTIFICATION_EVENT)) {
      expect(NOTIFICATION_MATRIX[event]).toEqual(
        expect.objectContaining({
          companyAdmins: expect.any(Boolean),
          superadmins: expect.any(Boolean),
        })
      );
    }
  });

  test("idempotency key is stable for retries", () => {
    const a = buildNotificationIdempotencyKey(
      NOTIFICATION_EVENT.BOOKING_FEE_PAID,
      "order1",
      "company"
    );
    const b = buildNotificationIdempotencyKey(
      NOTIFICATION_EVENT.BOOKING_FEE_PAID,
      "order1",
      "company"
    );
    expect(a).toBe(b);
    expect(a).toContain("booking.fee_paid");
    expect(a).toContain("order1");
  });
});

describe("important vs routine company settings", () => {
  test("does not email for routine display/preference changes", () => {
    const result = classifyCompanySettingChanges(
      { langAdmin: "en", slogan: "A", emailPreferences: {} },
      { langAdmin: "es", slogan: "B", emailPreferences: { primary: "x@y.z" } }
    );
    expect(result.important).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  test("one summary when multiple important fields change together", () => {
    const result = classifyCompanySettingChanges(
      {
        email: "old@co.test",
        listedOnMarketplace: true,
        prepaymentPercent: 10,
      },
      {
        email: "new@co.test",
        listedOnMarketplace: false,
        prepaymentPercent: 15,
      }
    );
    expect(result.important).toBe(true);
    expect(result.changes.length).toBeGreaterThanOrEqual(2);
    const content = buildNotificationContent(
      NOTIFICATION_EVENT.IMPORTANT_SETTINGS_CHANGED,
      "superadmin",
      {
        companyName: "Acme",
        changes: result.changes,
        actorEmail: "ops@example.com",
      }
    );
    expect(content.subject).toBe("Important company update: Acme");
    expect(content.text).toContain("Primary email");
  });

  test("material car field changes are detected", () => {
    const result = classifyCarMaterialChanges(
      { isActive: true, deposit: 200 },
      { isActive: false, deposit: 500 }
    );
    expect(result.important).toBe(true);
    expect(result.changes.map((c) => c.field)).toEqual(
      expect.arrayContaining(["isActive", "deposit"])
    );
  });
});

describe("recipient isolation + preferences", () => {
  test("superadmin recipients come from central config only", () => {
    process.env.MAIL_INTERNAL_TO = "ops@example.com";
    process.env.AUTH_SUPERADMIN_EMAIL = "login@example.com";
    const emails = resolveSuperadminRecipients();
    expect(emails.every((e) => typeof e === "string" && e.includes("@"))).toBe(
      true
    );
    expect(emails.join(",")).not.toMatch(/natalia|personal/i);
  });

  test("company preference emails never accept client-controlled lists", () => {
    const company = {
      email: "primary@co.test",
      email2: "secondary@co.test",
      emailPreferences: {
        primaryOperationalEmail: "ops@co.test",
        additionalRecipients: [
          {
            email: "bookings@co.test",
            bookingEmailsEnabled: true,
            transferEmailsEnabled: false,
          },
          {
            email: "transfers@co.test",
            bookingEmailsEnabled: false,
            transferEmailsEnabled: true,
          },
        ],
      },
    };
    const booking = resolveCompanyPreferenceEmails(company, "booking");
    expect(booking).toContain("ops@co.test");
    expect(booking).toContain("bookings@co.test");
    expect(booking).not.toContain("transfers@co.test");

    const transfer = resolveCompanyPreferenceEmails(company, "transfer");
    expect(transfer).toContain("transfers@co.test");
    expect(transfer).not.toContain("bookings@co.test");
  });

  test("assertCompanyIsolation flags foreign addresses", () => {
    const check = assertCompanyIsolation(
      ["admin-a@company.test", "other@evil.test"],
      ["admin-a@company.test"]
    );
    expect(check.ok).toBe(false);
    expect(check.foreign).toContain("other@evil.test");
  });

  test("normalizeEmailPreferences drops invalid rows", () => {
    const prefs = normalizeEmailPreferences({
      primaryOperationalEmail: "not-an-email",
      additionalRecipients: ["ok@co.test", { email: "bad" }, "ok@co.test"],
    });
    expect(prefs.primaryOperationalEmail).toBe("");
    expect(prefs.additionalRecipients).toEqual([
      {
        email: "ok@co.test",
        bookingEmailsEnabled: true,
        transferEmailsEnabled: true,
      },
    ]);
  });
});

describe("dispatchPlatformNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MAIL_INTERNAL_TO = "ops@example.com";
    process.env.AUTH_SUPERADMIN_EMAIL = "ops@example.com";
    hasNotificationBeenDelivered.mockResolvedValue(false);
    resolveCompanyNotificationRecipients.mockResolvedValue({
      emails: ["admin-a@company.test"],
      company: { name: "Alpha Cars", email: "admin-a@company.test" },
    });
  });

  test("company created notifies company + superadmin with correct subjects", async () => {
    await notifyCompanyCreated({
      companyId: "c1",
      companyName: "Alpha Cars",
      country: "ES",
      creatorEmail: "creator@example.com",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(sendEmailDirect).toHaveBeenCalledTimes(2);
    const subjects = sendEmailDirect.mock.calls.map((c) => c[0].title);
    expect(subjects).toContain("Welcome to Rovaro — complete your company setup");
    expect(subjects).toContain("New company created: Alpha Cars");
    const companyMail = sendEmailDirect.mock.calls.find((c) =>
      c[0].title.startsWith("Welcome")
    )[0];
    expect(companyMail.message).not.toMatch(/superadmin|verification/i);
    expect(companyMail.message).toMatch(/three simple steps/i);
  });

  test("booking requested hides contacts from company before fee paid", async () => {
    await notifyBookingRequested({
      orderId: "o1",
      companyId: "c1",
      companyName: "Alpha Cars",
      orderNumber: "20260101120000",
      customerName: "Jane Doe",
      phone: "+34600111222",
      email: "jane@example.com",
      carModel: "Seat Leon",
      pickup: "Madrid",
      return: "Barcelona",
      totalFormatted: "EUR 500.00",
      feeFormatted: "EUR 50.00",
      remainingFormatted: "EUR 450.00",
      revealContacts: false,
    });
    const companyCall = sendEmailDirect.mock.calls.find((c) =>
      String(c[0].title).startsWith("New booking request —")
    );
    expect(companyCall).toBeTruthy();
    expect(companyCall[0].title).toContain("Seat Leon");
    expect(companyCall[0].message).not.toContain("Jane");
    expect(companyCall[0].message).not.toContain("+34600111222");
    expect(companyCall[0].message).not.toContain("jane@example.com");
    expect(companyCall[0].message).toMatch(/Booking Fee is paid/i);
    expect(companyCall[0].message).not.toMatch(/partner-confirm|token=/i);
    expect(companyCall[0].message).toContain("/admin/orders?orderId=o1");

    const superCall = sendEmailDirect.mock.calls.find(
      (c) =>
        c[0].title === "New booking request: 20260101120000 — Alpha Cars"
    );
    expect(superCall[0].message).toContain("jane@example.com");
  });

  test("booking fee paid does not send the legacy admin template", async () => {
    const result = await notifyBookingFeePaid({
      orderId: "o2",
      companyId: "c1",
      companyName: "Alpha Cars",
      orderNumber: "20260101130000",
      customerName: "Jane Doe",
      phone: "+34600111222",
      email: "jane@example.com",
      totalFormatted: "EUR 500.00",
      feeFormatted: "EUR 50.00",
      remainingFormatted: "EUR 450.00",
      feePercent: 10,
      stripeRef: "pi_abc…xyz",
      status: "paid",
    });
    expect(sendEmailDirect).not.toHaveBeenCalled();
    expect(result.results.company.reason).toBe("no_content");
    expect(result.results.superadmin.reason).toBe("no_content");
  });

  test("webhook retry does not duplicate when already delivered", async () => {
    hasNotificationBeenDelivered.mockResolvedValue(true);
    await notifyBookingFeePaid({
      orderId: "o2",
      companyId: "c1",
      orderNumber: "x",
    });
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("email failure does not throw (business state preserved)", async () => {
    sendEmailDirect.mockRejectedValueOnce(new Error("SMTP down"));
    const result = await dispatchPlatformNotification(
      NOTIFICATION_EVENT.BOOKING_ACCEPTED,
      {
        entityId: "o3",
        companyId: "c1",
        orderId: "o3",
        context: { companyName: "Alpha", orderNumber: "n1" },
      }
    );
    expect(result.ok).toBe(true);
    expect(result.results.superadmin.ok).toBe(false);
  });

  test("notifyImportantCompanySettings skips when no changes", async () => {
    const result = await notifyImportantCompanySettings({
      companyId: "c1",
      changes: [],
    });
    expect(result.skipped).toBe(true);
    expect(sendEmailDirect).not.toHaveBeenCalled();
  });

  test("company isolation: company mail goes only to that company's recipients", async () => {
    await notifyBookingRequested({
      orderId: "o4",
      companyId: "c1",
      companyName: "Alpha Cars",
      orderNumber: "n4",
      revealContacts: false,
    });
    const companyCall = sendEmailDirect.mock.calls.find((c) =>
      c[0].to?.includes("admin-a@company.test")
    );
    expect(companyCall[0].to).toEqual(["admin-a@company.test"]);
    expect(resolveCompanyNotificationRecipients).toHaveBeenCalledWith(
      "c1",
      "booking",
      expect.objectContaining({ fallbackEmails: expect.any(Array) })
    );
  });
});

describe("partner decline recommendation + refund rules", () => {
  test("structured reason required; Other needs explanation", () => {
    expect(normalizePartnerDeclineReason("").ok).toBe(false);
    expect(normalizePartnerDeclineReason("other", "").ok).toBe(false);
    expect(
      normalizePartnerDeclineReason("other", "custom note").ok
    ).toBe(true);
    expect(
      normalizePartnerDeclineReason(
        PARTNER_DECLINE_REASON.VEHICLE_UNAVAILABLE
      ).ok
    ).toBe(true);
  });

  test("recommendation rules never set autoRefund", () => {
    const cases = [
      {
        reasonCode: PARTNER_DECLINE_REASON.CUSTOMER_REQUIREMENTS,
        expect: PLATFORM_REFUND_RECOMMENDATION.KEEP_FEE_OFFER_ALTERNATIVE,
      },
      {
        reasonCode: PARTNER_DECLINE_REASON.VEHICLE_UNAVAILABLE,
        alternativeAvailable: true,
        expect: PLATFORM_REFUND_RECOMMENDATION.OFFER_ANOTHER_VEHICLE,
      },
      {
        reasonCode: PARTNER_DECLINE_REASON.INCORRECT_LISTING_OR_PRICE,
        expect: PLATFORM_REFUND_RECOMMENDATION.REFUND_BOOKING_FEE,
      },
      {
        reasonCode: PARTNER_DECLINE_REASON.SAFETY_OR_FRAUD,
        expect: PLATFORM_REFUND_RECOMMENDATION.MANUAL_REVIEW,
      },
    ];
    for (const row of cases) {
      const rec = recommendPartnerDeclineAction(row);
      expect(rec.autoRefund).toBe(false);
      expect(rec.finalDecision).toBe(false);
      expect(rec.recommendation).toBe(row.expect);
    }
  });

  test("decline confirmation disclaimer forbids promising refunds", () => {
    expect(COMPANY_DECLINE_CONFIRMATION_DISCLAIMER).toMatch(/Rovaro handles/i);
    expect(COMPANY_DECLINE_CONFIRMATION_DISCLAIMER).toMatch(/not promise/i);
  });

  test("partner decline never auto-refunds; only superadmin may refund", () => {
    expect(isAutomaticMarketplaceFeeRefundForbidden("partner_rejection")).toBe(
      true
    );
    expect(blockAutomaticMarketplaceFeeRefund("partner_rejection").ok).toBe(
      false
    );
    expect(
      assertVoluntaryMarketplaceFeeRefund({
        actorRole: ROLE.ADMIN,
        reason: "please",
      }).ok
    ).toBe(false);
    expect(
      assertVoluntaryMarketplaceFeeRefund({
        actorRole: ROLE.SUPERADMIN,
        reason: "exceptional goodwill",
      }).ok
    ).toBe(true);
  });

  test("decline notify includes recommendation as display-only", async () => {
    jest.clearAllMocks();
    hasNotificationBeenDelivered.mockResolvedValue(false);
    await notifyBookingDeclined({
      orderId: "o5",
      companyId: "c1",
      companyName: "Alpha Cars",
      orderNumber: "n5",
      customerName: "Jane",
      reasonCode: PARTNER_DECLINE_REASON.INCORRECT_LISTING_OR_PRICE,
      feePaid: true,
      feeFormatted: "EUR 50.00",
      alternativeAvailable: false,
    });
    const superCall = sendEmailDirect.mock.calls.find((c) =>
      String(c[0].title).startsWith("Decision required")
    );
    expect(superCall[0].message).toMatch(/not a final refund decision/i);
    expect(superCall[0].message).toMatch(/Do not auto-refund/i);
    const companyCall = sendEmailDirect.mock.calls.find((c) =>
      String(c[0].title).startsWith("Booking declined")
    );
    expect(companyCall[0].message).toContain(
      COMPANY_DECLINE_CONFIRMATION_DISCLAIMER
    );
  });

  test("audit metadata from rental-terms notify has no secrets", async () => {
    jest.clearAllMocks();
    hasNotificationBeenDelivered.mockResolvedValue(false);
    await dispatchPlatformNotification(
      NOTIFICATION_EVENT.RENTAL_TERMS_UPDATED,
      {
        entityId: "c1:hash",
        companyId: "c1",
        context: {
          companyName: "Alpha",
          actorEmail: "a@co.test",
          previousHash: "aaa",
          newHash: "bbb",
          signedUrl: "https://evil/signed?token=SECRET",
          password: "nope",
        },
      }
    );
    expect(recordAuditEvent).toHaveBeenCalled();
    const meta = recordAuditEvent.mock.calls[0][0].metadata;
    expect(JSON.stringify(meta)).not.toMatch(/SECRET|password|signedUrl/i);
  });
});

describe("booking notification context / contact gating", () => {
  test("contacts hidden until verified payment state", () => {
    expect(
      orderFeePaidVerified({ payment: { status: "pending" } })
    ).toBe(false);
    expect(
      orderFeePaidVerified({ payment: { status: "paid", paidAt: new Date() } })
    ).toBe(true);

    const before = buildBookingNotificationContext(
      {
        _id: "o1",
        orderNumber: "n1",
        customerName: "Jane Doe",
        phone: "+34000",
        email: "j@e.test",
        payment: { status: "pending" },
        authoritativePrice: { grossMinor: 50000, currency: "EUR" },
        bookingMode: "request",
      },
      { companyName: "Alpha" }
    );
    expect(before.revealContacts).toBe(false);
    expect(before.phone).toBe("");
    expect(before.email).toBe("");

    const after = buildBookingNotificationContext(
      {
        _id: "o1",
        orderNumber: "n1",
        customerName: "Jane Doe",
        phone: "+34000",
        email: "j@e.test",
        payment: { status: "paid", paidAt: new Date() },
        authoritativePrice: { grossMinor: 50000, currency: "EUR" },
        bookingMode: "request",
      },
      { revealContacts: true }
    );
    expect(after.phone).toBe("+34000");
    expect(after.email).toBe("j@e.test");
  });

  test("safeStripeRef never includes full secrets", () => {
    expect(
      safeStripeRef({
        payment: { paymentIntentId: "pi_abcdefghijklmnopqrstuvwxyz012345" },
      })
    ).toMatch(/…/);
    expect(safeStripeRef({ payment: {} })).toBe("");
  });
});
