/**
 * @jest-environment node
 */
import {
  SmtpConfigError,
  resolveMailSender,
  resolveSmtpTransportOptions,
  sanitizeSmtpError,
} from "../smtpConfig";
import {
  getAdminTransferEmails,
  getInternalNotificationEmail,
  getPublicContactEmail,
  GREECE_ADMIN_CC_EMAIL,
  GREECE_INTERNAL_EMAIL,
  ROVARO_MAILBOX,
} from "@config/email";

const FAKE_PASS = "unit-test-smtp-pass";

function esSmtp(extra = {}) {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_SITE_COUNTRY: "ES",
    SMTP_HOST: "mail.site.eu",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "admin@rovaro.autos",
    SMTP_PASS: "",
    SMTP_PASSWORD: FAKE_PASS,
    MAIL_FROM_EMAIL: "admin@rovaro.autos",
    MAIL_FROM_NAME: "Rovaro",
    MAIL_REPLY_TO: "admin@rovaro.autos",
    ...extra,
  };
}

function grSmtp(extra = {}) {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_SITE_COUNTRY: "GR",
    SMTP_HOST: "mail.example.invalid",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "cars@bbqr.site",
    SMTP_PASS: FAKE_PASS,
    SMTP_PASSWORD: "",
    MAIL_FROM_EMAIL: "",
    MAIL_FROM_NAME: "",
    MAIL_REPLY_TO: "",
    ...extra,
  };
}

describe("resolveMailSender", () => {
  test("Spain/Rovaro uses Rovaro <admin@rovaro.autos>", () => {
    const sender = resolveMailSender(esSmtp());
    expect(sender.fromName).toBe("Rovaro");
    expect(sender.fromEmail).toBe("admin@rovaro.autos");
    expect(sender.replyTo).toBe("admin@rovaro.autos");
    expect(sender.fromHeader).toBe("Rovaro <admin@rovaro.autos>");
  });

  test("Spain defaults From to Rovaro mailbox when MAIL_FROM_* are unset", () => {
    const sender = resolveMailSender(
      esSmtp({
        MAIL_FROM_EMAIL: "",
        MAIL_FROM_NAME: "",
        MAIL_REPLY_TO: "",
      })
    );
    expect(sender.fromName).toBe("Rovaro");
    expect(sender.fromEmail).toBe(ROVARO_MAILBOX);
    expect(sender.replyTo).toBe(ROVARO_MAILBOX);
  });

  test("Greece keeps CarsNK and SMTP_USER as From", () => {
    const sender = resolveMailSender(grSmtp());
    expect(sender.fromName).toBe("CarsNK");
    expect(sender.fromEmail).toBe("cars@bbqr.site");
    expect(sender.replyTo).toBe("cars@bbqr.site");
    expect(sender.fromHeader).toBe("CarsNK <cars@bbqr.site>");
  });

  test("Greece does not switch From to Rovaro", () => {
    const sender = resolveMailSender(grSmtp());
    expect(sender.fromEmail).not.toBe(ROVARO_MAILBOX);
    expect(sender.fromName).not.toBe("Rovaro");
  });

  test("Spain rejects BBQR SMTP_USER instead of silently using it", () => {
    expect(() =>
      resolveMailSender(
        esSmtp({
          SMTP_USER: "cars@bbqr.site",
          MAIL_FROM_EMAIL: "",
        })
      )
    ).toThrow(SmtpConfigError);
    expect(() =>
      resolveMailSender(
        esSmtp({
          SMTP_USER: "cars@bbqr.site",
          MAIL_FROM_EMAIL: "",
        })
      )
    ).toThrow(/do not match the active site brand/);
  });
});

describe("resolveSmtpTransportOptions", () => {
  test("port 465 produces secure: true", () => {
    const opts = resolveSmtpTransportOptions(esSmtp({ SMTP_PORT: "465" }));
    expect(opts.port).toBe(465);
    expect(opts.secure).toBe(true);
    expect(opts.requireTLS).toBeUndefined();
    expect(opts.tls.rejectUnauthorized).not.toBe(false);
    expect(opts.host).toBe("mail.site.eu");
    expect(opts.auth.user).toBe("admin@rovaro.autos");
    expect(opts.auth.pass).toBe(FAKE_PASS);
  });

  test("port 465 defaults to implicit TLS when SMTP_SECURE is unset", () => {
    const opts = resolveSmtpTransportOptions(
      esSmtp({ SMTP_PORT: "465", SMTP_SECURE: "" })
    );
    expect(opts.secure).toBe(true);
  });

  test("port 587 produces secure: false and STARTTLS", () => {
    const opts = resolveSmtpTransportOptions(
      esSmtp({ SMTP_PORT: "587", SMTP_SECURE: "false" })
    );
    expect(opts.port).toBe(587);
    expect(opts.secure).toBe(false);
    expect(opts.requireTLS).toBe(true);
  });

  test("SMTP_PASSWORD alias is accepted when SMTP_PASS is empty", () => {
    const opts = resolveSmtpTransportOptions(
      esSmtp({ SMTP_PASS: "", SMTP_PASSWORD: FAKE_PASS })
    );
    expect(opts.auth.pass).toBe(FAKE_PASS);
  });

  test("invalid port is rejected", () => {
    expect(() =>
      resolveSmtpTransportOptions(esSmtp({ SMTP_PORT: "abc" }))
    ).toThrow(/Invalid SMTP port/);
    expect(() =>
      resolveSmtpTransportOptions(esSmtp({ SMTP_PORT: "0" }))
    ).toThrow(/Invalid SMTP port/);
    expect(() =>
      resolveSmtpTransportOptions(esSmtp({ SMTP_PORT: "465", SMTP_SECURE: "false" }))
    ).toThrow(/implicit TLS/);
  });

  test("missing production password fails closed", () => {
    expect(() =>
      resolveSmtpTransportOptions(
        esSmtp({
          NODE_ENV: "production",
          SMTP_PASS: "",
          SMTP_PASSWORD: "",
        })
      )
    ).toThrow("SMTP is not configured");
  });

  test("Spain production rejects BBQR SMTP_USER", () => {
    expect(() =>
      resolveSmtpTransportOptions(
        esSmtp({
          NODE_ENV: "production",
          SMTP_USER: "admin@bbqr.site",
        })
      )
    ).toThrow(/do not match the active site brand/);
  });
});

describe("sanitizeSmtpError", () => {
  test("does not include credentials or mailbox passwords", () => {
    const err = new Error(
      `Invalid login: user=admin@rovaro.autos pass=${FAKE_PASS} SMTP_PASSWORD=${FAKE_PASS}`
    );
    const safe = sanitizeSmtpError(err);
    expect(safe).toBe("SMTP authentication failed");
    expect(safe).not.toContain(FAKE_PASS);
    expect(safe).not.toContain("admin@rovaro.autos");
    expect(safe).not.toMatch(/SMTP_PASSWORD/i);
  });

  test("maps connection failures without host details", () => {
    const err = new Error("connect ETIMEDOUT mail.site.eu:465");
    const safe = sanitizeSmtpError(err);
    expect(safe).toBe("SMTP connection failed");
    expect(safe).not.toContain("mail.site.eu");
  });
});

describe("internal notification recipients", () => {
  const originalCountry = process.env.NEXT_PUBLIC_SITE_COUNTRY;
  const originalInternal = process.env.MAIL_INTERNAL_TO;
  const originalDeveloper = process.env.DEVELOPER_EMAIL;
  const originalAdminTo = process.env.MAIL_FROM_TO_ADMIN;

  function clearRecipientOverrides() {
    delete process.env.MAIL_INTERNAL_TO;
    delete process.env.DEVELOPER_EMAIL;
    delete process.env.MAIL_FROM_TO_ADMIN;
  }

  afterEach(() => {
    if (originalCountry === undefined) delete process.env.NEXT_PUBLIC_SITE_COUNTRY;
    else process.env.NEXT_PUBLIC_SITE_COUNTRY = originalCountry;
    if (originalInternal === undefined) delete process.env.MAIL_INTERNAL_TO;
    else process.env.MAIL_INTERNAL_TO = originalInternal;
    if (originalDeveloper === undefined) delete process.env.DEVELOPER_EMAIL;
    else process.env.DEVELOPER_EMAIL = originalDeveloper;
    if (originalAdminTo === undefined) delete process.env.MAIL_FROM_TO_ADMIN;
    else process.env.MAIL_FROM_TO_ADMIN = originalAdminTo;
  });

  test("Spain public contact is the Rovaro mailbox, not BBQR", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "ES";
    clearRecipientOverrides();
    expect(getPublicContactEmail()).toBe(ROVARO_MAILBOX);
    expect(getInternalNotificationEmail()).toBe(ROVARO_MAILBOX);
    expect(getAdminTransferEmails()).toEqual([ROVARO_MAILBOX]);
    expect(getAdminTransferEmails()).not.toContain(GREECE_ADMIN_CC_EMAIL);
  });

  test("Greece keeps historical BBQR inboxes", () => {
    process.env.NEXT_PUBLIC_SITE_COUNTRY = "GR";
    clearRecipientOverrides();
    expect(getPublicContactEmail()).toBe(GREECE_INTERNAL_EMAIL);
    expect(getInternalNotificationEmail()).toBe(GREECE_INTERNAL_EMAIL);
    expect(getAdminTransferEmails()).toEqual([
      GREECE_INTERNAL_EMAIL,
      GREECE_ADMIN_CC_EMAIL,
    ]);
  });
});
