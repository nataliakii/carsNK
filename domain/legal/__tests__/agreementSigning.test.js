import { ESIGN_MODE } from "@/domain/legal/esign";
import { PARTNER_GATE_BLOCKER, PARTNER_GATE_STEP } from "@/domain/legal/partnerGate";
import {
  AGREEMENT_FORM_BLOCKER,
  AGREEMENT_SIGNING_BLOCKER,
  assertAgreementPackageAcceptable,
  evaluateAgreementFormBlockers,
  evaluateAgreementSigningBlockers,
  resolveClickwrapIp,
} from "@/domain/legal/agreementSigning";

const publishedDoc = { documentType: "partner-agreement", source: "published" };

describe("evaluateAgreementSigningBlockers", () => {
  it("is empty when the package is published, verified and unsigned", () => {
    expect(
      evaluateAgreementSigningBlockers({
        documents: [publishedDoc],
        containsDrafts: false,
        packageChecksum: "abc",
        signedCurrentVersion: false,
        verificationBlockers: [],
        esignMode: ESIGN_MODE.CLICKWRAP,
      })
    ).toEqual([]);
  });

  it("surfaces unpublished drafts with a link to the legal hub", () => {
    const blockers = evaluateAgreementSigningBlockers({
      documents: [{ ...publishedDoc, source: "draft" }],
      containsDrafts: true,
      packageChecksum: "abc",
    });
    expect(blockers).toEqual([
      {
        code: AGREEMENT_SIGNING_BLOCKER.UNPUBLISHED_DOCUMENTS,
        href: "/admin/legal",
      },
    ]);
  });

  it("does not silently disable an empty package", () => {
    const blockers = evaluateAgreementSigningBlockers({
      documents: [],
      containsDrafts: false,
      packageChecksum: "hash-of-empty",
    });
    expect(blockers[0].code).toBe(AGREEMENT_SIGNING_BLOCKER.EMPTY_PACKAGE);
    expect(blockers[0].href).toBe("/admin/legal");
  });

  it("lists verification blockers so the partner can see why", () => {
    const blockers = evaluateAgreementSigningBlockers({
      documents: [publishedDoc],
      packageChecksum: "abc",
      verificationBlockers: [
        {
          code: PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION,
          step: PARTNER_GATE_STEP.OPERATOR,
        },
      ],
    });
    expect(blockers.map((b) => b.code)).toEqual([
      PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION,
    ]);
  });

  it("blocks a non-clickwrap provider instead of leaving a grey button", () => {
    const blockers = evaluateAgreementSigningBlockers({
      documents: [publishedDoc],
      packageChecksum: "abc",
      esignMode: ESIGN_MODE.EXTERNAL,
    });
    expect(blockers.map((b) => b.code)).toContain(
      AGREEMENT_SIGNING_BLOCKER.CLICKWRAP_UNAVAILABLE
    );
  });
});

describe("evaluateAgreementFormBlockers", () => {
  it("lists every incomplete clickwrap field", () => {
    expect(evaluateAgreementFormBlockers({})).toEqual([
      AGREEMENT_FORM_BLOCKER.NEED_READ,
      AGREEMENT_FORM_BLOCKER.NEED_NAME,
      AGREEMENT_FORM_BLOCKER.NEED_ROLE,
      AGREEMENT_FORM_BLOCKER.NEED_AUTHORITY,
      AGREEMENT_FORM_BLOCKER.NEED_ACCEPTANCE,
    ]);
  });

  it("is empty when the form is complete", () => {
    expect(
      evaluateAgreementFormBlockers({
        hasRead: true,
        signerName: "Ana López",
        signerRole: "Administradora",
        authorityConfirmed: true,
        accepted: true,
      })
    ).toEqual([]);
  });
});

describe("assertAgreementPackageAcceptable", () => {
  it("refuses drafts so POST cannot bypass the publish step", () => {
    const result = assertAgreementPackageAcceptable({
      documents: [publishedDoc],
      anyDraft: true,
      packageChecksum: "abc",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "unpublished_documents",
    });
  });

  it("accepts a published package with a checksum", () => {
    expect(
      assertAgreementPackageAcceptable({
        documents: [publishedDoc],
        anyDraft: false,
        packageChecksum: "abc",
      }).ok
    ).toBe(true);
  });
});

describe("resolveClickwrapIp", () => {
  it("keeps a real client address", () => {
    expect(resolveClickwrapIp("203.0.113.10", "production")).toBe("203.0.113.10");
  });

  it("fills localhost outside production so local clickwrap can record", () => {
    expect(resolveClickwrapIp("", "development")).toBe("127.0.0.1");
  });

  it("does not invent an IP in production", () => {
    expect(resolveClickwrapIp("", "production")).toBe("");
  });
});
