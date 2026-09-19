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
});
