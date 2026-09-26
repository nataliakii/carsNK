import crypto from "crypto";

import { MASTER_AGREEMENT_PACKAGE } from "./documentTypes";

export const PARTNER_LEGAL_STATE = Object.freeze({
  NOT_PUBLISHED: "NOT_PUBLISHED",
  ACCEPTANCE_REQUIRED: "ACCEPTANCE_REQUIRED",
  REACCEPTANCE_REQUIRED: "REACCEPTANCE_REQUIRED",
  ACCEPTED_CURRENT: "ACCEPTED_CURRENT",
});

/** Fixed contractual order: this order is shared by all consumers/checksums. */
export const PARTNER_PACKAGE_ORDER = Object.freeze([
  "PARTNER_AGREEMENT",
  "PARTNER_OPERATING_RULES",
  "DATA_PROTECTION_SCHEDULE",
]);

const TYPE_TO_SLUG = Object.freeze({
  PARTNER_AGREEMENT: MASTER_AGREEMENT_PACKAGE[0],
  PARTNER_OPERATING_RULES: MASTER_AGREEMENT_PACKAGE[1],
  DATA_PROTECTION_SCHEDULE: MASTER_AGREEMENT_PACKAGE[2],
});

export function normalizePartnerPackageType(value) {
  const raw = String(value || "").trim();
  const canonical = raw.replaceAll("-", "_").toUpperCase();
  return Object.hasOwn(TYPE_TO_SLUG, canonical) ? canonical : "";
}

export function partnerDocumentSlug(value) {
  const canonical = normalizePartnerPackageType(value);
  return canonical ? TYPE_TO_SLUG[canonical] : "";
}

export function orderedPartnerManifest(documents = []) {
  const byType = new Map(
    (Array.isArray(documents) ? documents : [])
      .filter(Boolean)
      .map((doc) => [
        normalizePartnerPackageType(doc.type || doc.documentType),
        doc,
      ])
  );
  return PARTNER_PACKAGE_ORDER.map((type) => {
    const doc = byType.get(type);
    if (!doc) return null;
    return {
      type,
      documentId: String(doc.documentId || doc._id || doc.id || ""),
      version: Number(doc.version) || 0,
      checksum: String(doc.checksum || ""),
    };
  });
}

export function partnerPackageChecksum(manifest = []) {
  const ordered = orderedPartnerManifest(manifest);
  if (
    ordered.some(
      (doc) => !doc || !doc.documentId || !doc.version || !doc.checksum
    )
  ) {
    return "";
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(ordered))
    .digest("hex");
}

export function packageMatchesAcceptance(
  currentManifest = [],
  acceptance = null
) {
  const current = orderedPartnerManifest(currentManifest);
  const acceptedDocs = Array.isArray(acceptance?.documents)
    ? acceptance.documents
    : [];
  if (
    !acceptance ||
    current.length !== PARTNER_PACKAGE_ORDER.length ||
    acceptedDocs.length < PARTNER_PACKAGE_ORDER.length
  ) {
    return false;
  }
  const acceptedByType = new Map(
    acceptedDocs.map((doc) => [
      normalizePartnerPackageType(doc.type || doc.documentType),
      doc,
    ])
  );
  return current.every((doc) => {
    const accepted = acceptedByType.get(doc.type);
    if (!accepted) return false;
    const acceptedId = String(
      accepted.bindingDocumentId || accepted.documentId || ""
    );
    const idMatches = acceptedId ? acceptedId === doc.documentId : true;
    return (
      idMatches &&
      Number(accepted.bindingVersion ?? accepted.version) === doc.version &&
      String(accepted.bindingChecksum || accepted.checksum || "") ===
        doc.checksum
    );
  });
}

/** One canonical state for navbar task counts, page rendering and acceptance. */
export function resolvePartnerLegalState({
  currentPackage,
  latestAcceptance = null,
  pendingLegalTask = null,
} = {}) {
  const manifest = orderedPartnerManifest(currentPackage?.manifest || []);
  const complete =
    currentPackage?.complete === true &&
    manifest.length === PARTNER_PACKAGE_ORDER.length &&
    manifest.every(
      (doc) => doc && doc.documentId && doc.version && doc.checksum
    );

  if (!complete) {
    return {
      state: PARTNER_LEGAL_STATE.NOT_PUBLISHED,
      legalActionCount: 0,
      missingDocumentTypes: Array.isArray(currentPackage?.missingDocumentTypes)
        ? currentPackage.missingDocumentTypes
        : PARTNER_PACKAGE_ORDER.filter(
            (type) => !manifest.find((doc) => doc?.type === type)
          ),
      manifest,
    };
  }
  if (!latestAcceptance) {
    return {
      state: PARTNER_LEGAL_STATE.ACCEPTANCE_REQUIRED,
      legalActionCount: 1,
      missingDocumentTypes: [],
      manifest,
    };
  }

  const matches = packageMatchesAcceptance(manifest, latestAcceptance);
  const materialPending = Boolean(pendingLegalTask?.required);
  const state =
    !matches && materialPending
      ? PARTNER_LEGAL_STATE.REACCEPTANCE_REQUIRED
      : PARTNER_LEGAL_STATE.ACCEPTED_CURRENT;

  return {
    state,
    legalActionCount:
      state === PARTNER_LEGAL_STATE.ACCEPTANCE_REQUIRED ||
      state === PARTNER_LEGAL_STATE.REACCEPTANCE_REQUIRED
        ? 1
        : 0,
    missingDocumentTypes: [],
    manifest,
    changedDocumentTypes:
      state === PARTNER_LEGAL_STATE.REACCEPTANCE_REQUIRED
        ? pendingLegalTask.documentTypes || []
        : [],
  };
}

export function partnerLegalStateToPublication(state) {
  if (state === PARTNER_LEGAL_STATE.ACCEPTANCE_REQUIRED)
    return "READY_TO_ACCEPT";
  if (state === PARTNER_LEGAL_STATE.REACCEPTANCE_REQUIRED)
    return "UPDATE_REQUIRED";
  if (state === PARTNER_LEGAL_STATE.ACCEPTED_CURRENT) return "ACCEPTED";
  return "NOT_PUBLISHED";
}
