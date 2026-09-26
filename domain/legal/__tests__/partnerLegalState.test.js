import {
  PARTNER_LEGAL_STATE,
  partnerPackageChecksum,
  resolvePartnerLegalState,
} from "../partnerLegalState";
import { buildCompanySetupTasks } from "../companySetupTasks";

const manifest = [
  {
    type: "PARTNER_AGREEMENT",
    documentId: "agreement-id",
    version: 2,
    checksum: "agreement-hash",
  },
  {
    type: "PARTNER_OPERATING_RULES",
    documentId: "rules-id",
    version: 1,
    checksum: "rules-hash",
  },
  {
    type: "DATA_PROTECTION_SCHEDULE",
    documentId: "dpa-id",
    version: 1,
    checksum: "dpa-hash",
  },
];

function acceptance(docs = manifest) {
  return {
    documents: docs.map((doc) => ({
      documentType: doc.type,
      bindingDocumentId: doc.documentId,
      bindingVersion: doc.version,
      bindingChecksum: doc.checksum,
    })),
  };
}

describe("canonical partner legal package state", () => {
  test("missing one required published source version means NOT_PUBLISHED and no badge", () => {
    const result = resolvePartnerLegalState({
      currentPackage: {
        complete: false,
        manifest: manifest.slice(0, 2),
        missingDocumentTypes: ["DATA_PROTECTION_SCHEDULE"],
      },
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.NOT_PUBLISHED);
    expect(result.legalActionCount).toBe(0);
    expect(result.missingDocumentTypes).toEqual(["DATA_PROTECTION_SCHEDULE"]);
  });

  test("a previously ordered sparse manifest is still handled as NOT_PUBLISHED", () => {
    const result = resolvePartnerLegalState({
      currentPackage: {
        complete: false,
        manifest: [manifest[0], null, manifest[2]],
        missingDocumentTypes: ["PARTNER_OPERATING_RULES"],
      },
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.NOT_PUBLISHED);
    expect(result.legalActionCount).toBe(0);
    expect(result.missingDocumentTypes).toEqual(["PARTNER_OPERATING_RULES"]);
  });

  test("complete package without an acceptance creates one action", () => {
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest },
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.ACCEPTANCE_REQUIRED);
    expect(result.legalActionCount).toBe(1);
  });

  test("acceptance compares each document independently, not matching version numbers", () => {
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest },
      latestAcceptance: acceptance(),
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.ACCEPTED_CURRENT);
    expect(result.legalActionCount).toBe(0);
  });

  test("material Partner Agreement v2 with unchanged rules/DPA v1 requires one reacceptance", () => {
    const current = [
      { ...manifest[0], version: 2, checksum: "new-agreement-hash" },
      manifest[1],
      manifest[2],
    ];
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest: current },
      latestAcceptance: acceptance([
        { ...manifest[0], version: 1, checksum: "old-agreement-hash" },
        manifest[1],
        manifest[2],
      ]),
      pendingLegalTask: {
        required: true,
        documentTypes: ["PARTNER_AGREEMENT"],
      },
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.REACCEPTANCE_REQUIRED);
    expect(result.legalActionCount).toBe(1);
    expect(result.changedDocumentTypes).toEqual(["PARTNER_AGREEMENT"]);
    const tasks = buildCompanySetupTasks({
      verificationStatus: "VERIFIED",
      legalState: result.state,
      legalActionCount: result.legalActionCount,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("TERMS_UPDATE_REQUIRED");
  });

  test("a checksum mismatch with only editorial publication does not require reacceptance", () => {
    const current = [
      { ...manifest[0], checksum: "editorial-hash" },
      ...manifest.slice(1),
    ];
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest: current },
      latestAcceptance: acceptance(),
      pendingLegalTask: null,
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.ACCEPTED_CURRENT);
    expect(result.legalActionCount).toBe(0);
  });

  test("package checksum is independent of caller/database order and document labels", () => {
    expect(partnerPackageChecksum(manifest)).toBe(
      partnerPackageChecksum(
        [...manifest]
          .reverse()
          .map((doc) => ({ ...doc, title: "localized label" }))
      )
    );
  });

  test("matches stored hyphenated document-type aliases against canonical type IDs", () => {
    const legacyAcceptance = {
      documents: manifest.map((doc) => ({
        documentType: doc.type.toLowerCase().replaceAll("_", "-"),
        bindingDocumentId: doc.documentId,
        bindingVersion: doc.version,
        bindingChecksum: doc.checksum,
      })),
    };
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest },
      latestAcceptance: legacyAcceptance,
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.ACCEPTED_CURRENT);
  });

  test("legacy acceptances without document ids still match by version and checksum", () => {
    const legacyAcceptance = {
      packageChecksum: "legacy-rendered-snapshot-checksum",
      manifest: [],
      documents: manifest.map((doc) => ({
        documentType: doc.type.toLowerCase().replaceAll("_", "-"),
        bindingDocumentId: "",
        bindingVersion: doc.version,
        bindingChecksum: doc.checksum,
        version: doc.version,
        checksum: doc.checksum,
      })),
    };
    const result = resolvePartnerLegalState({
      currentPackage: { complete: true, manifest },
      latestAcceptance: legacyAcceptance,
    });
    expect(result.state).toBe(PARTNER_LEGAL_STATE.ACCEPTED_CURRENT);
    expect(result.legalActionCount).toBe(0);
  });
});
