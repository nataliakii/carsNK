/**
 * Partner-review queue rules shared by the Legal hub and its tests.
 *
 * Needs review: first-time KYB (`PENDING_VERIFICATION`) and verified companies
 * that proposed field changes. Everything else belongs in All partners.
 * A deep link follows the company's real status so a draft is never shown
 * under the empty pending message.
 */

import { coercePendingChangeList } from "./verifiedProfileChanges";
import { evaluatePartnerOperatingGate } from "./partnerGate";
import { REJECTION_DECISION } from "./partnerVerification";

export { REJECTION_DECISION };

export const PARTNER_REVIEW_FILTER = Object.freeze({
  PENDING: "pending",
  ALL: "all",
});

const PENDING = "PENDING_VERIFICATION";

export function isPendingReviewStatus(status) {
  return status === PENDING;
}

/** True when the partner proposed legal-field edits that still need an OK. */
export function rowHasPendingProfileChanges(row) {
  return coercePendingChangeList(row?.verification?.pendingChanges).length > 0;
}

/**
 * Companies a superadmin must act on: new KYB, or an OK on proposed edits.
 */
export function isNeedsReviewRow(row) {
  if (isPendingReviewStatus(row?.verification?.status)) return true;
  return rowHasPendingProfileChanges(row);
}

export function filterForVerificationStatus(status) {
  return isPendingReviewStatus(status)
    ? PARTNER_REVIEW_FILTER.PENDING
    : PARTNER_REVIEW_FILTER.ALL;
}

export function filterForPartnerRow(row) {
  return isNeedsReviewRow(row)
    ? PARTNER_REVIEW_FILTER.PENDING
    : PARTNER_REVIEW_FILTER.ALL;
}

/**
 * Which operator buttons belong on the review card.
 * Draft is not a review decision: no approve and no reject.
 * Pending: Approve / Request changes / Reject. Verified: Suspend only.
 */
export function reviewControlsForStatus(status) {
  const none = {
    moveToReview: false,
    approve: false,
    requestChanges: false,
    reject: false,
    suspend: false,
    reopenDraft: false,
  };
  if (status === "DRAFT") return { ...none, moveToReview: true };
  if (status === PENDING) {
    return { ...none, approve: true, requestChanges: true, reject: true };
  }
  if (status === "VERIFIED") return { ...none, suspend: true };
  if (status === "SUSPENDED") {
    return { ...none, approve: true, requestChanges: true, reject: true };
  }
  if (status === "REJECTED") return { ...none, reopenDraft: true };
  return none;
}

/**
 * Plain-language application status for the review header badge.
 * REJECTED + changes_requested → "Changes requested"; otherwise "Rejected".
 * Never returns raw enum strings like PENDING_VERIFICATION.
 */
export const REVIEW_DISPLAY_STATUS = Object.freeze({
  DRAFT: "draft",
  AWAITING_REVIEW: "awaiting_review",
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  NONE: "none",
});

export const REVIEW_DISPLAY_STATUS_LABEL = Object.freeze({
  [REVIEW_DISPLAY_STATUS.DRAFT]: "Draft",
  [REVIEW_DISPLAY_STATUS.AWAITING_REVIEW]: "Awaiting review",
  [REVIEW_DISPLAY_STATUS.APPROVED]: "Approved",
  [REVIEW_DISPLAY_STATUS.CHANGES_REQUESTED]: "Changes requested",
  [REVIEW_DISPLAY_STATUS.REJECTED]: "Rejected",
  [REVIEW_DISPLAY_STATUS.SUSPENDED]: "Suspended",
  [REVIEW_DISPLAY_STATUS.NONE]: "No profile",
});

/**
 * @param {{ verificationStatus?: string, rejectionDecision?: string }|null} profile
 */
export function reviewDisplayStatus(profile) {
  const status = profile?.verificationStatus || null;
  if (!status) return REVIEW_DISPLAY_STATUS.NONE;
  if (status === PENDING) return REVIEW_DISPLAY_STATUS.AWAITING_REVIEW;
  if (status === "VERIFIED") return REVIEW_DISPLAY_STATUS.APPROVED;
  if (status === "SUSPENDED") return REVIEW_DISPLAY_STATUS.SUSPENDED;
  if (status === "DRAFT") return REVIEW_DISPLAY_STATUS.DRAFT;
  if (status === "REJECTED") {
    return profile?.rejectionDecision === REJECTION_DECISION.CHANGES_REQUESTED
      ? REVIEW_DISPLAY_STATUS.CHANGES_REQUESTED
      : REVIEW_DISPLAY_STATUS.REJECTED;
  }
  return REVIEW_DISPLAY_STATUS.NONE;
}

export function reviewDisplayStatusLabel(profileOrKey) {
  const key =
    typeof profileOrKey === "string"
      ? profileOrKey
      : reviewDisplayStatus(profileOrKey);
  return REVIEW_DISPLAY_STATUS_LABEL[key] || REVIEW_DISPLAY_STATUS_LABEL.none;
}

/**
 * Make the URL match the selected company.
 * A non-pending company on Needs review switches to All partners.
 * An unknown company id is dropped.
 *
 * @param {{ filter?: string|null, companyId?: string|null, rows?: Array<{companyId: string, verification?: {status?: string}|null}> }} input
 */
export function resolvePartnerReviewUrl({ filter, companyId, rows }) {
  const list = Array.isArray(rows) ? rows : [];
  const id = String(companyId || "");
  const requested =
    filter === PARTNER_REVIEW_FILTER.ALL ||
    filter === PARTNER_REVIEW_FILTER.PENDING
      ? filter
      : "";
  const selected = id ? list.find((row) => row.companyId === id) || null : null;

  if (!selected) {
    return {
      filter: requested || PARTNER_REVIEW_FILTER.PENDING,
      companyId: "",
    };
  }

  const natural = filterForPartnerRow(selected);
  let nextFilter = requested || natural;
  if (
    nextFilter === PARTNER_REVIEW_FILTER.PENDING &&
    natural !== PARTNER_REVIEW_FILTER.PENDING
  ) {
    nextFilter = PARTNER_REVIEW_FILTER.ALL;
  }

  return { filter: nextFilter, companyId: id };
}

export function visiblePartnerRows(rows, filter) {
  const list = Array.isArray(rows) ? rows : [];
  if (filter === PARTNER_REVIEW_FILTER.ALL) return list;
  return list.filter((row) => isNeedsReviewRow(row));
}

/** Empty pending copy is only for an empty Needs review list with nobody selected. */
export function shouldShowPendingEmpty({
  filter,
  visibleCount,
  selectedVisible,
}) {
  return (
    filter === PARTNER_REVIEW_FILTER.PENDING &&
    visibleCount === 0 &&
    !selectedVisible
  );
}

export function agreementDisplayStatus({
  active = null,
  history = [],
  currentPackageChecksum = "",
  legalState = "",
} = {}) {
  if (legalState === "ACCEPTED_CURRENT") return "current";
  if (legalState === "REACCEPTANCE_REQUIRED") return "outdated";
  if (legalState === "ACCEPTANCE_REQUIRED") return "not_accepted";
  if (legalState === "NOT_PUBLISHED") return "not_available";
  if (active && !active.terminatedAt && !active.supersededAt) {
    const current = String(currentPackageChecksum || "").trim();
    const signed = String(active.packageChecksum || "").trim();
    if (current && signed && signed !== current) return "outdated";
    return "current";
  }
  if ((history || []).some((item) => item?.terminatedAt)) return "terminated";
  return "not_accepted";
}

/**
 * Compact status for the review detail. Operating stays blocked until the
 * existing gate passes and the marketplace listing is on. Verification
 * alone is not enough.
 */
export function buildPartnerReviewCompliance({
  verificationStatus = null,
  documentCount = 0,
  listedOnMarketplace = false,
  activeAgreement = null,
  agreementHistory = [],
  currentPackageChecksum = "",
  legalState = "",
  completeness = null,
} = {}) {
  const agreementStatus = agreementDisplayStatus({
    active: activeAgreement,
    history: agreementHistory,
    currentPackageChecksum,
    legalState,
  });
  const gate = evaluatePartnerOperatingGate({
    profile: verificationStatus ? { verificationStatus } : null,
    completeness,
    activeAgreement:
      agreementStatus === "current" || agreementStatus === "outdated"
        ? activeAgreement
        : null,
    currentPackageChecksum,
    legalState,
  });
  const listingOn = listedOnMarketplace !== false;
  return {
    documentCount,
    verificationStatus: verificationStatus || null,
    agreementStatus,
    listingOn,
    operating: gate.canOperate && listingOn ? "ready" : "blocked",
  };
}
