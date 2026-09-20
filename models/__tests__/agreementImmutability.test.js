/**
 * A signed agreement snapshot must stay exactly as it was signed.
 *
 * These exercise the guard the model installs on every update path, so the
 * protection is verified without needing a database connection.
 */

import {
  assertOnlyLifecycleFields,
  MUTABLE_AFTER_SIGNING,
} from "@models/PartnerAgreementAcceptance";

describe("signed agreement immutability", () => {
  it("allows marking an agreement as superseded", () => {
    expect(() =>
      assertOnlyLifecycleFields({
        $set: { supersededAt: new Date(), supersededByAgreementId: "AGR-2" },
      })
    ).not.toThrow();
  });

  it("allows recording termination", () => {
    expect(() =>
      assertOnlyLifecycleFields({
        $set: { terminatedAt: new Date(), terminationReason: "Partner left" },
      })
    ).not.toThrow();
  });

  it("allows an e-sign status callback", () => {
    expect(() =>
      assertOnlyLifecycleFields({ $set: { esignStatus: "completed" } })
    ).not.toThrow();
  });

  it("refuses to rewrite the accepted document versions", () => {
    expect(() =>
      assertOnlyLifecycleFields({
        $set: { documents: [{ documentType: "partner-agreement", version: 2 }] },
      })
    ).toThrow(/immutable/i);
  });

  it("refuses to change the checksum", () => {
    expect(() =>
      assertOnlyLifecycleFields({ $set: { packageChecksum: "0".repeat(64) } })
    ).toThrow(/immutable/i);
  });

  it("refuses to change the signer or the acceptance timestamp", () => {
    expect(() =>
      assertOnlyLifecycleFields({ $set: { signerName: "Someone Else" } })
    ).toThrow(/immutable/i);
    expect(() =>
      assertOnlyLifecycleFields({ $set: { acceptedAt: new Date(0) } })
    ).toThrow(/immutable/i);
  });

  it("refuses a top-level replacement document", () => {
    expect(() => assertOnlyLifecycleFields({ signerRole: "Owner" })).toThrow(
      /immutable/i
    );
  });

  it("names the offending fields so the refusal is debuggable", () => {
    expect(() =>
      assertOnlyLifecycleFields({ $set: { signerEmail: "x@y.z", ipAddress: "1.2.3.4" } })
    ).toThrow(/signerEmail.*ipAddress|ipAddress.*signerEmail/);
  });

  it("keeps the mutable allowlist narrow", () => {
    expect([...MUTABLE_AFTER_SIGNING].sort()).toEqual([
      "copySentAt",
      "esignEnvelopeId",
      "esignStatus",
      "supersededAt",
      "supersededByAgreementId",
      "terminatedAt",
      "terminationReason",
      "updatedAt",
    ]);
  });
});
