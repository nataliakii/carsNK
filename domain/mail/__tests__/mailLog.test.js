/**
 * @jest-environment node
 */
import { MAIL_RENDER_KEY, MAIL_STATUS, MAIL_TYPE } from "../mailTypes";
import { buildMailLogDocument } from "../recordOutboundMail";
import { buildMailLogFilter, serializeMailLogListItem } from "../queryMailLog";
import { rebuildMailForResend } from "../resendOutboundMail";

jest.mock("@/lib/email/sendDirect", () => ({ sendEmailDirect: jest.fn() }));
jest.mock("@lib/database", () => ({ connectToDB: jest.fn() }));
jest.mock("@models/MailLog", () => ({ __esModule: true, default: {} }));
jest.mock("@/app/ui/email/renderEmail", () => ({
  renderCustomerOrderConfirmationEmail: jest.fn(() => ({
    title: "Current customer title",
    text: "Current customer text",
    html: "<p>Current customer html</p>",
  })),
  renderCustomerOfficialConfirmationEmail: jest.fn(() => ({
    title: "Official",
    text: "Official text",
    html: "<p>Official</p>",
    pdfFileName: "confirm.pdf",
    pdfData: { orderNumber: "1" },
  })),
  renderAdminOrderNotificationEmail: jest.fn(
    (title, body) => `<html>${title}:${body}</html>`
  ),
}));
jest.mock("@/app/ui/email/pdf/customerOfficialConfirmationPdf", () => ({
  buildCustomerOfficialConfirmationPdf: jest.fn(async () => Buffer.from("pdf")),
}));

describe("buildMailLogDocument", () => {
  test("stores recipients, type and render payload", () => {
    const doc = buildMailLogDocument({
      to: ["Customer@Example.com"],
      cc: ["ops@example.com"],
      from: "Rovaro <admin@rovaro.autos>",
      subject: "Booking",
      html: "<p>Hi</p>",
      text: "Hi",
      status: MAIL_STATUS.SENT,
      messageId: "m1",
      meta: {
        type: MAIL_TYPE.ORDER_CUSTOMER,
        orderId: "64b7f2c3a1b2c3d4e5f60789",
        renderKey: MAIL_RENDER_KEY.CUSTOMER_ORDER_CONFIRMATION,
        payload: { customerName: "Ada", email: "ada@example.com" },
      },
    });
    expect(doc.to).toEqual(["customer@example.com"]);
    expect(doc.type).toBe(MAIL_TYPE.ORDER_CUSTOMER);
    expect(doc.renderKey).toBe(MAIL_RENDER_KEY.CUSTOMER_ORDER_CONFIRMATION);
    expect(doc.payload).toEqual({
      customerName: "Ada",
      email: "ada@example.com",
    });
    expect(doc.orderId).toBe("64b7f2c3a1b2c3d4e5f60789");
  });

  test("records failed sends without throwing on bad ids", () => {
    const doc = buildMailLogDocument({
      to: ["ops@example.com"],
      status: MAIL_STATUS.FAILED,
      error: "SMTP authentication failed",
      meta: { orderId: "not-an-id" },
    });
    expect(doc.status).toBe(MAIL_STATUS.FAILED);
    expect(doc.orderId).toBeNull();
    expect(doc.error).toContain("SMTP");
  });
});

describe("mail log filters", () => {
  test("filters by order, type, status and recipient", () => {
    const filter = buildMailLogFilter({
      orderId: "64b7f2c3a1b2c3d4e5f60789",
      type: MAIL_TYPE.ORDER_CUSTOMER,
      status: MAIL_STATUS.SENT,
      recipient: "ada@example.com",
    });
    expect(filter.orderId).toBe("64b7f2c3a1b2c3d4e5f60789");
    expect(filter.type).toBe(MAIL_TYPE.ORDER_CUSTOMER);
    expect(filter.status).toBe(MAIL_STATUS.SENT);
    expect(filter.$or).toHaveLength(3);
  });
});

describe("serializeMailLogListItem", () => {
  test("omits html from the list shape", () => {
    const row = serializeMailLogListItem({
      _id: "64b7f2c3a1b2c3d4e5f60789",
      to: ["ada@example.com"],
      subject: "Hi",
      type: MAIL_TYPE.ORDER_CUSTOMER,
      status: MAIL_STATUS.SENT,
      html: "<p>secret</p>",
      sentAt: new Date("2026-09-21T12:00:00.000Z"),
    });
    expect(row.id).toBe("64b7f2c3a1b2c3d4e5f60789");
    expect(row.html).toBeUndefined();
    expect(row.canResend).toBe(true);
  });
});

describe("rebuildMailForResend", () => {
  test("re-renders customer confirmation with current templates", async () => {
    const rebuilt = await rebuildMailForResend({
      subject: "Old subject",
      text: "Old text",
      html: "<p>Old</p>",
      renderKey: MAIL_RENDER_KEY.CUSTOMER_ORDER_CONFIRMATION,
      payload: { customerName: "Ada" },
    });
    expect(rebuilt.title).toBe("Current customer title");
    expect(rebuilt.html).toBe("<p>Current customer html</p>");
  });

  test("falls back to stored html when there is no render key", async () => {
    const rebuilt = await rebuildMailForResend({
      subject: "Stored",
      text: "Body",
      html: "<p>Stored html</p>",
    });
    expect(rebuilt.title).toBe("Stored");
    expect(rebuilt.html).toBe("<p>Stored html</p>");
    expect(rebuilt.message).toBe("Body");
  });
});
