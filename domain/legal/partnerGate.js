/**
 * The single answer to "may this partner trade?".
 *
 * Two independent conditions have to hold, and they are already defined
 * elsewhere: `canPartnerOperate` owns the verification rule, and the presence
 * of a non-superseded acceptance of the current package owns the agreement
 * rule. This module only composes them, so the UI can render one authoritative
 * server-computed answer instead of re-deriving the rule in the browser.
 *
 * It decides nothing new and must stay that way.
 */

import {
  PARTNER_VERIFICATION_STATUS,
  canPartnerOperate,
} from "./partnerVerification";

/** Screen the partner has to go to in order to clear a blocker. */
export const PARTNER_GATE_STEP = Object.freeze({
  PROFILE: "profile",
  AGREEMENT: "agreement",
  /** Nothing the partner can do — Rovaro has to act. */
  OPERATOR: "operator",
});

export const PARTNER_GATE_BLOCKER = Object.freeze({
  NO_PROFILE: "no_profile",
  PROFILE_INCOMPLETE: "profile_incomplete",
  AWAITING_VERIFICATION: "awaiting_verification",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  AGREEMENT_NOT_SIGNED: "agreement_not_signed",
  AGREEMENT_OUTDATED: "agreement_outdated",
});

const S = PARTNER_VERIFICATION_STATUS;

/**
 * @param {{
 *   profile: object|null,
 *   completeness: { ready: boolean }|null,
 *   activeAgreement: { packageChecksum?: string }|null,
 *   currentPackageChecksum?: string,
 * }} input
 * @returns {{
 *   canOperate: boolean,
 *   verificationStatus: string|null,
 *   agreementSigned: boolean,
 *   agreementOutdated: boolean,
 *   blockers: Array<{ code: string, step: string }>,
 * }}
 */
export function evaluatePartnerOperatingGate({
  profile,
  completeness,
  activeAgreement,
  currentPackageChecksum = "",
}) {
  const status = profile?.verificationStatus || null;
  const blockers = [];

  if (!profile) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.NO_PROFILE,
      step: PARTNER_GATE_STEP.PROFILE,
    });
  } else if (status === S.REJECTED) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.REJECTED,
      step: PARTNER_GATE_STEP.PROFILE,
    });
  } else if (status === S.SUSPENDED) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.SUSPENDED,
      step: PARTNER_GATE_STEP.OPERATOR,
    });
  } else if (status === S.PENDING_VERIFICATION) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION,
      step: PARTNER_GATE_STEP.OPERATOR,
    });
  } else if (!canPartnerOperate(status)) {
    blockers.push({
      code: completeness?.ready
        ? PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION
        : PARTNER_GATE_BLOCKER.PROFILE_INCOMPLETE,
      step: PARTNER_GATE_STEP.PROFILE,
    });
  }

  const signedChecksum = activeAgreement?.packageChecksum || "";
  const agreementSigned = Boolean(signedChecksum);
  const agreementOutdated =
    agreementSigned &&
    Boolean(currentPackageChecksum) &&
    signedChecksum !== currentPackageChecksum;

  if (!agreementSigned) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.AGREEMENT_NOT_SIGNED,
      step: PARTNER_GATE_STEP.AGREEMENT,
    });
  } else if (agreementOutdated) {
    blockers.push({
      code: PARTNER_GATE_BLOCKER.AGREEMENT_OUTDATED,
      step: PARTNER_GATE_STEP.AGREEMENT,
    });
  }

  return {
    canOperate: blockers.length === 0,
    verificationStatus: status,
    agreementSigned,
    agreementOutdated,
    blockers,
  };
}
