process.env.DRIVING_LICENCE_RECEIPT_SECRET = "test-licence-receipt-secret-value";

import {
  UPLOAD_RECEIPT_TTL_MS,
  checksumForBytes,
  createUploadReceipt,
  verifyUploadReceipt,
} from "@/domain/legal/drivingLicenceUploadReceipt";

const NOW = new Date("2026-06-10T12:00:00Z");
const CHECKSUM = "c".repeat(64);

function descriptor(overrides = {}) {
  return {
    storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
    storageType: "authenticated",
    checksum: CHECKSUM,
    uploadedAt: NOW,
    byteSize: 204_800,
    contentType: "image/jpeg",
    ...overrides,
  };
}

describe("proving an upload happened", () => {
  it("round-trips the stored document descriptor", () => {
    const minted = createUploadReceipt(descriptor());
    expect(minted.ok).toBe(true);

    const verified = verifyUploadReceipt(minted.receipt, { now: NOW });
    expect(verified.ok).toBe(true);
    expect(verified.upload).toEqual({
      storageReference: "carsnk/orders/licence-intake/2026-06/abc123",
      storageType: "authenticated",
      checksum: CHECKSUM,
      uploadedAt: NOW,
      byteSize: 204_800,
      contentType: "image/jpeg",
    });
  });

  it("does not put a delivery URL inside the receipt", () => {
    const minted = createUploadReceipt(descriptor());
    expect(minted.receipt).not.toContain("http");
    expect(minted.receipt).not.toContain("res.cloudinary.com");
  });

  it("refuses to mint a receipt without a real checksum", () => {
    expect(createUploadReceipt(descriptor({ checksum: "short" })).ok).toBe(false);
    expect(createUploadReceipt(descriptor({ storageReference: "" })).ok).toBe(false);
  });
});

describe("a client cannot forge an upload", () => {
  it("rejects a receipt with a tampered payload", () => {
    const minted = createUploadReceipt(descriptor());
    const [version, body, signature] = minted.receipt.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        v: version,
        ref: "someone/elses/document",
        st: "authenticated",
        sum: CHECKSUM,
        at: NOW.toISOString(),
        size: 1,
        mime: "image/jpeg",
      }),
      "utf8"
    ).toString("base64url");

    const result = verifyUploadReceipt(`${version}.${forgedBody}.${signature}`, {
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("RECEIPT_SIGNATURE_INVALID");
  });

  it("rejects an invented receipt, an empty one and junk", () => {
    for (const value of ["", "   ", "nonsense", "v1.abc.def", null, undefined]) {
      expect(verifyUploadReceipt(value, { now: NOW }).ok).toBe(false);
    }
  });

  it("rejects a receipt signed with a different secret", () => {
    const minted = createUploadReceipt(descriptor());
    const original = process.env.DRIVING_LICENCE_RECEIPT_SECRET;
    process.env.DRIVING_LICENCE_RECEIPT_SECRET = "a-completely-different-secret";
    try {
      expect(verifyUploadReceipt(minted.receipt, { now: NOW }).ok).toBe(false);
    } finally {
      process.env.DRIVING_LICENCE_RECEIPT_SECRET = original;
    }
  });
});

describe("a receipt does not last forever", () => {
  it("accepts a receipt inside its lifetime", () => {
    const minted = createUploadReceipt(descriptor());
    const later = new Date(NOW.getTime() + UPLOAD_RECEIPT_TTL_MS - 1000);
    expect(verifyUploadReceipt(minted.receipt, { now: later }).ok).toBe(true);
  });

  it("rejects a receipt replayed after it expired", () => {
    const minted = createUploadReceipt(descriptor());
    const later = new Date(NOW.getTime() + UPLOAD_RECEIPT_TTL_MS + 1000);
    const result = verifyUploadReceipt(minted.receipt, { now: later });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("RECEIPT_EXPIRED");
  });
});

describe("checksum", () => {
  it("is a stable sha-256 of the bytes", () => {
    const checksum = checksumForBytes(Buffer.from("licence-bytes"));
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(checksumForBytes(Buffer.from("licence-bytes"))).toBe(checksum);
    expect(checksumForBytes(Buffer.from("other-bytes"))).not.toBe(checksum);
  });
});
