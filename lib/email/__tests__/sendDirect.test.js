/**
 * @jest-environment node
 */

const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn(() => ({ sendMail, verify }));

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport },
  createTransport,
}));

jest.mock("@/app/ui/email/templates/signature", () => ({
  EMAIL_SIGNATURE_HTML: "",
  EMAIL_SIGNATURE_TEXT: "",
}));

jest.mock("@/domain/mail/recordOutboundMail", () => ({
  recordOutboundMail: jest.fn().mockResolvedValue(undefined),
}));

const FAKE_PASS = "unit-test-smtp-pass";

const SMTP_ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_SITE_COUNTRY",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_PASSWORD",
  "MAIL_FROM_EMAIL",
  "MAIL_FROM_NAME",
  "MAIL_REPLY_TO",
  "EMAIL_TESTING",
  "EMAIL_TEST_ADDRESS",
];

describe("sendEmailDirect", () => {
  const original = {};

  beforeAll(() => {
    for (const key of SMTP_ENV_KEYS) {
      original[key] = process.env[key];
    }
  });

  beforeEach(() => {
    jest.resetModules();
    sendMail.mockReset().mockResolvedValue({ messageId: "m1", accepted: ["ok"] });
    verify.mockReset().mockResolvedValue(true);
    createTransport.mockClear();
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    process.env.SMTP_HOST = "mail.site.eu";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "admin@rovaro.autos";
    process.env.SMTP_PASS = FAKE_PASS;
    process.env.SMTP_PASSWORD = FAKE_PASS;
    process.env.MAIL_FROM_EMAIL = "admin@rovaro.autos";
    process.env.MAIL_FROM_NAME = "Rovaro";
    process.env.MAIL_REPLY_TO = "admin@rovaro.autos";
    delete process.env.EMAIL_TESTING;
    delete process.env.EMAIL_TEST_ADDRESS;
  });

  afterAll(() => {
    for (const key of SMTP_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  async function loadSendDirect() {
    const mod = await import("../sendDirect");
    mod.resetEmailTransporter();
    return mod;
  }

  test("uses resolved Rovaro sender as envelope From, never the customer", async () => {
    const { sendEmailDirect } = await loadSendDirect();
    await sendEmailDirect({
      title: "Booking",
      message: "Hello",
      to: ["customer@example.com"],
      replyTo: "customer@example.com",
    });

    expect(createTransport).toHaveBeenCalled();
    const transportOpts = createTransport.mock.calls[0][0];
    expect(transportOpts.secure).toBe(true);
    expect(transportOpts.auth.user).toBe("admin@rovaro.autos");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const payload = sendMail.mock.calls[0][0];
    expect(payload.from).toBe("Rovaro <admin@rovaro.autos>");
    expect(payload.sender).toBe("admin@rovaro.autos");
    expect(payload.envelope.from).toBe("admin@rovaro.autos");
    expect(payload.envelope.from).not.toBe("customer@example.com");
    expect(payload.replyTo).toBe("customer@example.com");
    expect(payload.to).toEqual(["customer@example.com"]);
  });

  test("rejects header injection in subject, recipient and replyTo", async () => {
    const { sendEmailDirect } = await loadSendDirect();

    await expect(
      sendEmailDirect({
        title: "Hello\r\nBcc: victim@example.com",
        message: "x",
        to: ["ops@example.com"],
      })
    ).rejects.toThrow(/Invalid subject/);

    await expect(
      sendEmailDirect({
        title: "Hello",
        message: "x",
        to: ["ops@example.com\r\nBcc: victim@example.com"],
      })
    ).rejects.toThrow(/Invalid/);

    await expect(
      sendEmailDirect({
        title: "Hello",
        message: "x",
        to: ["ops@example.com"],
        replyTo: "customer@example.com\nBcc: victim@example.com",
      })
    ).rejects.toThrow(/Invalid replyTo/);

    expect(sendMail).not.toHaveBeenCalled();
  });

  test("sanitises SMTP errors and does not throw the password", async () => {
    sendMail.mockRejectedValue(
      new Error(`Invalid login pass=${FAKE_PASS} user=admin@rovaro.autos`)
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmailDirect } = await loadSendDirect();

    await expect(
      sendEmailDirect({
        title: "Booking",
        message: "Hello",
        to: ["ops@example.com"],
      })
    ).rejects.toThrow("SMTP authentication failed");

    try {
      await sendEmailDirect({
        title: "Booking",
        message: "Hello",
        to: ["ops@example.com"],
      });
    } catch (err) {
      expect(String(err.message)).not.toContain(FAKE_PASS);
      expect(String(err.stack || "")).not.toContain(FAKE_PASS);
    }

    const logged = errorSpy.mock.calls.map((args) => args.join(" ")).join(" ");
    expect(logged).not.toContain(FAKE_PASS);
    errorSpy.mockRestore();
  });

  test("ignores a caller-supplied from address", async () => {
    const { sendEmailDirect } = await loadSendDirect();
    await sendEmailDirect({
      title: "Booking",
      message: "Hello",
      to: ["ops@example.com"],
      from: "customer@example.com",
      sender: "customer@example.com",
    });
    const payload = sendMail.mock.calls[0][0];
    expect(payload.from).toBe("Rovaro <admin@rovaro.autos>");
    expect(payload.envelope.from).toBe("admin@rovaro.autos");
  });

  test("logs a successful send for the superadmin history", async () => {
    const { sendEmailDirect } = await loadSendDirect();
    const { recordOutboundMail } = await import("@/domain/mail/recordOutboundMail");
    recordOutboundMail.mockClear();

    await sendEmailDirect({
      title: "Booking",
      message: "Hello",
      to: ["customer@example.com"],
      meta: { type: "order.customer", orderId: "64b7f2c3a1b2c3d4e5f60789" },
    });

    expect(recordOutboundMail).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        subject: "Booking",
        to: ["customer@example.com"],
        meta: expect.objectContaining({ type: "order.customer" }),
      })
    );
  });

  test("logs a failed send without dropping the SMTP error", async () => {
    sendMail.mockRejectedValue(new Error("connection refused"));
    const { sendEmailDirect } = await loadSendDirect();
    const { recordOutboundMail } = await import("@/domain/mail/recordOutboundMail");
    recordOutboundMail.mockClear();

    await expect(
      sendEmailDirect({
        title: "Booking",
        message: "Hello",
        to: ["ops@example.com"],
      })
    ).rejects.toThrow();

    expect(recordOutboundMail).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        subject: "Booking",
      })
    );
  });

  test("EMAIL_TESTING without sink skips SMTP and never targets the customer", async () => {
    process.env.EMAIL_TESTING = "true";
    delete process.env.EMAIL_TEST_ADDRESS;
    const { sendEmailDirect } = await loadSendDirect();
    const { recordOutboundMail } = await import("@/domain/mail/recordOutboundMail");
    recordOutboundMail.mockClear();

    const result = await sendEmailDirect({
      title: "Booking confirmed",
      message: "Hello",
      to: ["customer@example.com"],
      cc: ["partner@example.com"],
      meta: { type: "order.customer" },
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
    expect(result.intendedTo).toEqual(["customer@example.com"]);
    expect(recordOutboundMail).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "skipped",
        subject: "[TEST] Booking confirmed",
        to: ["customer@example.com"],
      })
    );
  });

  test("EMAIL_TESTING with sink redirects SMTP away from original recipients", async () => {
    process.env.EMAIL_TESTING = "true";
    process.env.EMAIL_TEST_ADDRESS = "qa-sink@example.com";
    const { sendEmailDirect } = await loadSendDirect();

    await sendEmailDirect({
      title: "Payment link",
      message: "Pay",
      to: ["customer@example.com"],
      cc: ["admin@rovaro.autos"],
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const payload = sendMail.mock.calls[0][0];
    expect(payload.to).toEqual(["qa-sink@example.com"]);
    expect(payload.cc).toBeUndefined();
    expect(payload.subject).toBe("[TEST] Payment link");
    expect(payload.to).not.toContain("customer@example.com");
    expect(payload.envelope.to).toEqual(["qa-sink@example.com"]);
  });
});
