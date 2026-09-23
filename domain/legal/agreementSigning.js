/**
 * Why the Partner Agreement accept button must stay disabled.
 *
 * The partner screen used to fold every reason into one boolean, so a
 * missing name, an unpublished draft package and an unverified profile all
 * looked the same: a grey button. This module lists the reasons so the UI
 * can show them, and so POST can refuse the same cases with a stable code.
 */

import { ESIGN_MODE } from "./esign";
import { PARTNER_GATE_STEP } from "./partnerGate";

/** Conditions that block recording an acceptance even with a complete form. */
export const AGREEMENT_SIGNING_BLOCKER = Object.freeze({
  EMPTY_PACKAGE: "empty_package",
  UNPUBLISHED_DOCUMENTS: "unpublished_documents",
  MISSING_CHECKSUM: "missing_checksum",
  ALREADY_SIGNED: "already_signed",
  CLICKWRAP_UNAVAILABLE: "clickwrap_unavailable",
});

/** Form fields the partner still has to complete. */
export const AGREEMENT_FORM_BLOCKER = Object.freeze({
  NEED_READ: "need_read",
  NEED_NAME: "need_name",
  NEED_ROLE: "need_role",
  NEED_AUTHORITY: "need_authority",
  NEED_ACCEPTANCE: "need_acceptance",
});

/**
 * Package- and verification-level reasons the accept button must stay off.
 *
 * @param {{
 *   documents?: Array<object>,
 *   containsDrafts?: boolean,
 *   packageChecksum?: string,
 *   signedCurrentVersion?: boolean,
 *   verificationBlockers?: Array<{ code: string, step?: string }>,
 *   esignMode?: string,
 * }} input
 * @returns {Array<{ code: string, step?: string, href?: string }>}
 */
export function evaluateAgreementSigningBlockers({
  documents = [],
  containsDrafts = false,
  packageChecksum = "",
  signedCurrentVersion = false,
  verificationBlockers = [],
  esignMode = ESIGN_MODE.CLICKWRAP,
} = {}) {
  const blockers = [];

  if (!documents.length) {
    blockers.push({
      code: AGREEMENT_SIGNING_BLOCKER.EMPTY_PACKAGE,
    });
  } else if (containsDrafts) {
    blockers.push({
      code: AGREEMENT_SIGNING_BLOCKER.UNPUBLISHED_DOCUMENTS,
    });
  }

  if (documents.length && !String(packageChecksum || "").trim()) {
    blockers.push({ code: AGREEMENT_SIGNING_BLOCKER.MISSING_CHECKSUM });
  }

  if (signedCurrentVersion) {
    blockers.push({ code: AGREEMENT_SIGNING_BLOCKER.ALREADY_SIGNED });
  }

  const mode = String(esignMode || ESIGN_MODE.CLICKWRAP);
  if (mode !== ESIGN_MODE.CLICKWRAP) {
    blockers.push({
      code: AGREEMENT_SIGNING_BLOCKER.CLICKWRAP_UNAVAILABLE,
    });
  }

  for (const blocker of verificationBlockers) {
    if (!blocker?.code) continue;
    blockers.push({
      code: blocker.code,
      step: blocker.step,
      href:
        blocker.step === PARTNER_GATE_STEP.PROFILE
          ? "/admin/company/legal"
          : blocker.step === PARTNER_GATE_STEP.AGREEMENT
            ? "/admin/company/legal?tab=terms"
            : undefined,
    });
  }

  return blockers;
}

/**
 * Incomplete clickwrap fields. These are listed next to the button so an
 * empty name or an unticked box is never a silent disable.
 *
 * @param {{
 *   hasRead?: boolean,
 *   signerName?: string,
 *   signerRole?: string,
 *   authorityConfirmed?: boolean,
 *   accepted?: boolean,
 * }} input
 * @returns {string[]}
 */
export function evaluateAgreementFormBlockers({
  hasRead = false,
  signerName = "",
  signerRole = "",
  authorityConfirmed = false,
  accepted = false,
} = {}) {
  const blockers = [];
  if (!hasRead) blockers.push(AGREEMENT_FORM_BLOCKER.NEED_READ);
  if (!String(signerName || "").trim()) {
    blockers.push(AGREEMENT_FORM_BLOCKER.NEED_NAME);
  }
  if (!String(signerRole || "").trim()) {
    blockers.push(AGREEMENT_FORM_BLOCKER.NEED_ROLE);
  }
  if (!authorityConfirmed) blockers.push(AGREEMENT_FORM_BLOCKER.NEED_AUTHORITY);
  if (!accepted) blockers.push(AGREEMENT_FORM_BLOCKER.NEED_ACCEPTANCE);
  return blockers;
}

/**
 * Server-side counterpart of the package blockers. Call after the package
 * has been built so a client cannot bypass the unpublished-document rule.
 *
 * @param {{ documents?: Array<object>, anyDraft?: boolean, packageChecksum?: string }} pkg
 */
export function assertAgreementPackageAcceptable(pkg) {
  if (!pkg?.documents?.length) {
    return {
      ok: false,
      status: 500,
      code: "no_documents",
      message: "No agreement documents are available",
    };
  }
  if (pkg.anyDraft) {
    return {
      ok: false,
      status: 409,
      code: "unpublished_documents",
      message:
        "Agreement documents are still drafts and cannot be accepted until they are published",
    };
  }
  if (!String(pkg.packageChecksum || "").trim()) {
    return {
      ok: false,
      status: 500,
      code: "missing_checksum",
      message: "The agreement package has no checksum",
    };
  }
  return { ok: true };
}

/**
 * Local/dev requests often have no forwarded IP. Clickwrap still needs one
 * in the audit trail; production keeps requiring a real client address.
 *
 * @param {string} [ipAddress]
 * @param {string} [nodeEnv]
 */
export function resolveClickwrapIp(ipAddress, nodeEnv = process.env.NODE_ENV) {
  const trimmed = String(ipAddress || "").trim();
  if (trimmed) return trimmed;
  if (nodeEnv !== "production") return "127.0.0.1";
  return "";
}
