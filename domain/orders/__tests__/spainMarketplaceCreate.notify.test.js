/**
 * @jest-environment node
 */
import { notifyOrderAction } from "../orderNotificationDispatcher";
import { sendEmailDirect } from "@/lib/email/sendDirect";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@/lib/telegram/sendDirect", () => ({ sendTelegramDirect: jest.fn() }));
jest.mock("@/domain/booking/partnerBookingConfirmation", () => ({
  issueConfirmationToken: jest.fn().mockResolvedValue({
    ok: true,
    token: "partner-token",
  }),
}));
jest.mock("@models/auditLog", () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue({}) },
}));

describe("Spain marketplace create notifications", () => {
  const originalEmailTesting = process.env.EMAIL_TESTING;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_TESTING = "false";
    sendEmailDirect.mockResolvedValue({ messageId: "id" });
  });

  afterAll(() => {
    process.env.EMAIL_TESTING = originalEmailTesting;
  });

  const user = { id: "u1", isAdmin: false, role: 0 };

  test("owner A receives the company email, not owner B", async () => {
    await notifyOrderAction({
      order: {
        _id: "order-1",
        orderNumber: "1",
        carModel: "Seat Leon",
        my_order: true,
        confirmed: false,
        bookingMode: "MARKETPLACE_REQUEST",
        ownerId: "company-a",
        email: "ana@example.com",
        rentalStartDate: "2026-10-01T10:00:00.000Z",
        rentalEndDate: "2026-10-05T10:00:00.000Z",
        timeIn: "2026-10-01T10:00:00.000Z",
        timeOut: "2026-10-05T10:00:00.000Z",
      },
      user,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: "owner-a@example.com",
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    const companyMail = sendEmailDirect.mock.calls.find((call) =>
      call[0].to.includes("owner-a@example.com")
    );
    const leaked = sendEmailDirect.mock.calls.find((call) =>
      (call[0].to || []).includes("owner-b@example.com")
    );
    expect(companyMail).toBeTruthy();
    expect(leaked).toBeFalsy();
    const customerMail = sendEmailDirect.mock.calls.find((call) =>
      call[0].to.includes("ana@example.com")
    );
    expect(customerMail[0].html).not.toContain("checkout.stripe.com");
  });

  test("missing owner does not email a platform company address", async () => {
    await notifyOrderAction({
      order: {
        _id: "order-2",
        orderNumber: "2",
        carModel: "Seat Leon",
        my_order: true,
        confirmed: false,
        bookingMode: "MARKETPLACE_REQUEST",
        email: "ana@example.com",
        rentalStartDate: "2026-10-01T10:00:00.000Z",
        rentalEndDate: "2026-10-05T10:00:00.000Z",
        timeIn: "2026-10-01T10:00:00.000Z",
        timeOut: "2026-10-05T10:00:00.000Z",
      },
      user,
      action: "CREATE",
      source: "BACKEND",
      companyEmail: undefined,
      notifyLocales: { langAdmin: "en", langSuperadmin: "en" },
    });

    const partnerish = sendEmailDirect.mock.calls.filter((call) =>
      (call[0].to || []).some((addr) =>
        /owner|partner|company-b/i.test(String(addr))
      )
    );
    expect(partnerish).toHaveLength(0);
  });
});
