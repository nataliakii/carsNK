/**
 * @jest-environment node
 */
process.env.TRANSFER_CLAIM_SECRET =
  process.env.TRANSFER_CLAIM_SECRET || "test-transfer-claim-secret";

const {
  createTransferClaimToken,
  verifyTransferClaimToken,
  hashToken,
} = require("../claimToken");

describe("transfer claimToken", () => {
  test("legacy HMAC round-trips transferId and companyId", () => {
    const token = createTransferClaimToken({
      transferId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      companyId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      expSec: 3600,
    });
    const verified = verifyTransferClaimToken(token);
    expect(verified.ok).toBe(true);
    expect(verified.transferId).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(verified.companyId).toBe("bbbbbbbbbbbbbbbbbbbbbbbb");
  });

  test("rejects tampered legacy token", () => {
    const token = createTransferClaimToken({
      transferId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      companyId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const bad = token.slice(0, -2) + "xx";
    expect(verifyTransferClaimToken(bad).ok).toBe(false);
  });

  test("hashToken produces sha256 hex", () => {
    expect(hashToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });

  test("throws when TRANSFER_CLAIM_SECRET and NEXTAUTH_SECRET are empty", () => {
    const prevClaim = process.env.TRANSFER_CLAIM_SECRET;
    const prevNext = process.env.NEXTAUTH_SECRET;
    jest.resetModules();
    delete process.env.TRANSFER_CLAIM_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      const { createTransferClaimToken: createWithoutSecret } = require("../claimToken");
      expect(() =>
        createWithoutSecret({
          transferId: "aaaaaaaaaaaaaaaaaaaaaaaa",
          companyId: "bbbbbbbbbbbbbbbbbbbbbbbb",
        })
      ).toThrow(/TRANSFER_CLAIM_SECRET or NEXTAUTH_SECRET is required/);
    } finally {
      process.env.TRANSFER_CLAIM_SECRET = prevClaim;
      process.env.NEXTAUTH_SECRET = prevNext;
    }
  });
});
