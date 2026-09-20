/**
 * Signed one-time confirmation tokens.
 *
 * The security property that matters: a link cannot be forged, cannot outlive
 * its expiry, and cannot be minted at all when no signing secret is
 * configured — there is deliberately no fallback secret.
 */

const ORDER_ID = "652f1a2b3c4d5e6f70819293";

function loadModule() {
  let mod;
  jest.isolateModules(() => {
    mod = require("@/domain/booking/partnerConfirmationToken");
  });
  return mod;
}

const ORIGINAL_ENV = {
  BOOKING_CONFIRM_SECRET: process.env.BOOKING_CONFIRM_SECRET,
  EMAIL_ACTION_SECRET: process.env.EMAIL_ACTION_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
};

function withSecret() {
  process.env.BOOKING_CONFIRM_SECRET = "test-confirmation-secret";
  delete process.env.EMAIL_ACTION_SECRET;
  delete process.env.NEXTAUTH_SECRET;
}

function withoutSecret() {
  delete process.env.BOOKING_CONFIRM_SECRET;
  delete process.env.EMAIL_ACTION_SECRET;
  delete process.env.NEXTAUTH_SECRET;
}

afterAll(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("signing and verification", () => {
  beforeEach(withSecret);

  it("round-trips the order and company", () => {
    const { signConfirmationToken, verifyConfirmationToken } = loadModule();
    const signed = signConfirmationToken({
      orderId: ORDER_ID,
      companyId: "company-1",
    });
    const parsed = verifyConfirmationToken(signed.token);

    expect(parsed.ok).toBe(true);
    expect(parsed.orderId).toBe(ORDER_ID);
    expect(parsed.companyId).toBe("company-1");
    expect(parsed.jti).toBe(signed.jti);
  });

  it("issues a distinct jti per link so each can be consumed once", () => {
    const { signConfirmationToken } = loadModule();
    const a = signConfirmationToken({ orderId: ORDER_ID });
    const b = signConfirmationToken({ orderId: ORDER_ID });

    expect(a.jti).not.toBe(b.jti);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("stores only a hash, never the raw token", () => {
    const { signConfirmationToken, hashConfirmationToken } = loadModule();
    const signed = signConfirmationToken({ orderId: ORDER_ID });

    expect(signed.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.tokenHash).not.toContain(signed.token);
    expect(hashConfirmationToken(signed.token)).toBe(signed.tokenHash);
  });

  it("rejects a tampered payload", () => {
    const { signConfirmationToken, verifyConfirmationToken } = loadModule();
    const signed = signConfirmationToken({ orderId: ORDER_ID });
    const [, signature] = signed.token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        p: "confirm_availability",
        o: "000000000000000000000000",
        c: "",
        jti: "x",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const result = verifyConfirmationToken(`${forgedPayload}.${signature}`);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("bad_signature");
  });

  it("rejects a malformed token", () => {
    const { verifyConfirmationToken } = loadModule();
    expect(verifyConfirmationToken("not-a-token").code).toBe("malformed");
    expect(verifyConfirmationToken("").code).toBe("malformed");
  });

  it("rejects an expired token with 410", () => {
    const { signConfirmationToken, verifyConfirmationToken } = loadModule();
    const signed = signConfirmationToken({ orderId: ORDER_ID, ttlHours: 1 });

    const realNow = Date.now;
    Date.now = () => realNow() + 2 * 3600 * 1000;
    try {
      const result = verifyConfirmationToken(signed.token);
      expect(result.ok).toBe(false);
      expect(result.code).toBe("expired");
      expect(result.status).toBe(410);
    } finally {
      Date.now = realNow;
    }
  });

  it("rejects a token signed with a different secret", () => {
    const { signConfirmationToken } = loadModule();
    const signed = signConfirmationToken({ orderId: ORDER_ID });

    process.env.BOOKING_CONFIRM_SECRET = "a-completely-different-secret";
    const { verifyConfirmationToken } = loadModule();

    expect(verifyConfirmationToken(signed.token).code).toBe("bad_signature");
  });
});

describe("no fallback secret", () => {
  beforeEach(withoutSecret);

  it("refuses to sign when no secret is configured", () => {
    const { signConfirmationToken } = loadModule();
    expect(() => signConfirmationToken({ orderId: ORDER_ID })).toThrow(
      /must be set/i
    );
  });

  it("refuses to verify rather than accepting a weak default", () => {
    const { verifyConfirmationToken } = loadModule();
    const result = verifyConfirmationToken("anything.anything");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("no_secret");
    expect(result.status).toBe(500);
  });
});
