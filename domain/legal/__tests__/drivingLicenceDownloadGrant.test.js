process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

import {
  DOWNLOAD_GRANT_TTL_SECONDS,
  createDownloadGrant,
  verifyDownloadGrant,
} from "@/domain/legal/drivingLicenceDownloadGrant";

const NOW = new Date("2026-06-10T12:00:00Z");
const ORDER_ID = "64a0000000000000000000aa";
const REFERENCE = "carsnk/orders/licence-intake/2026-06/abc123";

function grant(overrides = {}) {
  return createDownloadGrant({
    orderId: ORDER_ID,
    storageReference: REFERENCE,
    storageType: "authenticated",
    resourceType: "image",
    now: NOW,
    ...overrides,
  });
}

describe("issuing a download grant", () => {
  it("names exactly one document on one order", () => {
    const issued = grant();
    expect(issued.ok).toBe(true);

    const verified = verifyDownloadGrant(issued.grant, { now: NOW });
    expect(verified).toEqual({
      ok: true,
      orderId: ORDER_ID,
      storageReference: REFERENCE,
      storageType: "authenticated",
      resourceType: "image",
    });
  });

  it("is short-lived, measured in minutes", () => {
    expect(DOWNLOAD_GRANT_TTL_SECONDS).toBeLessThanOrEqual(300);
    expect(DOWNLOAD_GRANT_TTL_SECONDS).toBeGreaterThan(0);
    expect(grant().ttlSeconds).toBe(DOWNLOAD_GRANT_TTL_SECONDS);
  });

  it("refuses to issue a grant with nothing to point at", () => {
    expect(grant({ orderId: "" }).ok).toBe(false);
    expect(grant({ storageReference: "" }).ok).toBe(false);
  });

  it("carries no delivery URL", () => {
    expect(grant().grant).not.toContain("http");
    expect(grant().grant).not.toContain("cloudinary");
  });
});

describe("a download link expires", () => {
  it("still works just before the deadline", () => {
    const issued = grant();
    const justBefore = new Date(
      NOW.getTime() + (DOWNLOAD_GRANT_TTL_SECONDS - 5) * 1000
    );
    expect(verifyDownloadGrant(issued.grant, { now: justBefore }).ok).toBe(true);
  });

  it("stops working once the deadline passes", () => {
    const issued = grant();
    const after = new Date(NOW.getTime() + (DOWNLOAD_GRANT_TTL_SECONDS + 5) * 1000);
    const result = verifyDownloadGrant(issued.grant, { now: after });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("GRANT_EXPIRED");
  });
});

describe("a grant cannot be forged or re-pointed", () => {
  it("rejects a tampered document reference", () => {
    const issued = grant();
    const [version, , signature] = issued.grant.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        v: version,
        oid: ORDER_ID,
        ref: "someone/elses/document",
        st: "authenticated",
        rt: "image",
        exp: Math.floor(NOW.getTime() / 1000) + DOWNLOAD_GRANT_TTL_SECONDS,
      }),
      "utf8"
    ).toString("base64url");

    const result = verifyDownloadGrant(`${version}.${forgedBody}.${signature}`, {
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("GRANT_SIGNATURE_INVALID");
  });

  it("rejects junk and empty input", () => {
    for (const value of ["", "  ", "nope", "g1.a.b", null, undefined]) {
      expect(verifyDownloadGrant(value, { now: NOW }).ok).toBe(false);
    }
  });

  it("keeps the order id inside the signed payload so it cannot be swapped", () => {
    const issued = grant();
    const verified = verifyDownloadGrant(issued.grant, { now: NOW });
    // The route compares this against the order in the request path.
    expect(verified.orderId).toBe(ORDER_ID);
    expect(verified.orderId).not.toBe("64a0000000000000000000bb");
  });
});
