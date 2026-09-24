/**
 * Company setup readiness — the single server-side answer to "how far is this
 * company through onboarding, and what may it do right now?".
 *
 * One result object is shared by every surface so they cannot disagree:
 *   - the Trading status card (`PartnerComplianceCard`)
 *   - the `/admin/company/setup` step UI and its Terms tab
 *   - the setup inbox tasks (`domain/legal/companySetupTasks.js`)
 *   - the car publishing, public listing and booking gates
 *     (`domain/legal/partnerOperatingPolicy.js`)
 *
 * Rules of this module:
 *   - Company-facing output only. `state`, the three capability booleans and
 *     `nextAction` are safe to render. Internal compliance blocker codes,
 *     document names and review notes never enter this result.
 *   - At most ONE `nextAction`. States where only Rovaro has work to do
 *     return `nextAction: null` so the card cannot grow a second button.
 *   - Every company-facing destination is a step of `/admin/company/setup`.
 *     Nothing links to the old legal-profile or agreement routes.
 */

import { PARTNER_VERIFICATION_STATUS as S } from "./partnerVerification";

export const COMPANY_SETUP_PATH = "/admin/company/setup";

/** The only steps `/admin/company/setup` accepts, in flow order. */
export const COMPANY_SETUP_STEPS = Object.freeze([
  "details",
  "documents",
  "terms",
  "review",
]);

export const COMPANY_SETUP_STATE = Object.freeze({
  DETAILS_INCOMPLETE: "COMPANY_DETAILS_INCOMPLETE",
  DOCUMENTS_MISSING: "DOCUMENTS_MISSING",
  DOCUMENTS_UNDER_REVIEW: "DOCUMENTS_UNDER_REVIEW",
  TERMS_NOT_PUBLISHED: "TERMS_NOT_PUBLISHED",
  TERMS_READY: "TERMS_READY_TO_ACCEPT",
  TERMS_UPDATE: "TERMS_UPDATE_REQUIRED",
  LISTING_DISABLED: "READY_BUT_LISTING_DISABLED",
  READY: "READY_TO_TRADE",
  SUSPENDED: "SUSPENDED",
});

/**
 * Canonical terms publication state. `COMPANY_TERMS_PUBLICATION` in
 * `domain/legal/companyLegalPage.js` carries the same four values; a test pins
 * the two together so a Terms tab and a gate can never read different words
 * for the same situation.
 */
export const TERMS_PUBLICATION = Object.freeze({
  NOT_PUBLISHED: "NOT_PUBLISHED",
  READY_TO_ACCEPT: "READY_TO_ACCEPT",
  ACCEPTED: "ACCEPTED",
  UPDATE_REQUIRED: "UPDATE_REQUIRED",
});

/** What a caller wants to do. Each maps onto one readiness capability. */
export const COMPANY_SETUP_CAPABILITY = Object.freeze({
  DRAFT_CARS: "canCreateDraftCars",
  PUBLISH_CARS: "canPublishCars",
  BOOKINGS: "canReceiveBookings",
});

/**
 * The one action offered per state: an i18n label key under
 * `partnerLegal.card.actions` plus the setup step it opens. States that are
 * absent here deliberately have no company-facing action.
 */
export const COMPANY_SETUP_ACTION = Object.freeze({
  [COMPANY_SETUP_STATE.DETAILS_INCOMPLETE]: Object.freeze({
    labelKey: "continueSetup",
    step: "details",
  }),
  [COMPANY_SETUP_STATE.DOCUMENTS_MISSING]: Object.freeze({
    labelKey: "uploadDocuments",
    step: "documents",
  }),
  [COMPANY_SETUP_STATE.TERMS_READY]: Object.freeze({
    labelKey: "reviewTerms",
    step: "terms",
  }),
  [COMPANY_SETUP_STATE.TERMS_UPDATE]: Object.freeze({
    labelKey: "reviewUpdatedTerms",
    step: "terms",
  }),
});

/**
 * The only way to build a company setup link. An unknown step falls back to
 * `details` rather than producing a URL the page cannot render.
 */
export function companySetupHref(step = "details") {
  const safe = COMPANY_SETUP_STEPS.includes(step) ? step : "details";
  return `${COMPANY_SETUP_PATH}?step=${safe}`;
}

/** Older company-facing legal URLs and the setup step that replaced each. */
export function legacySetupRedirect(pathname = "", search = {}) {
  const path = String(pathname || "").split("?")[0];
  const tab = String(search.tab || search.step || "");
  if (path === "/admin/legal-profile/agreement" || path.endsWith("/agreement")) {
    return companySetupHref("terms");
  }
  if (path === "/admin/legal-profile" || path.startsWith("/admin/legal-profile/")) {
    return companySetupHref("details");
  }
  if (path === "/admin/company/legal" || path.startsWith("/admin/company/legal/")) {
    if (tab === "documents") return companySetupHref("documents");
    if (tab === "terms") return companySetupHref("terms");
    if (tab === "review") return companySetupHref("review");
    return companySetupHref("details");
  }
  return null;
}

/**
 * One publication state from the raw package data.
 *
 * `documents` is optional: pass the rendered package when you have it, or omit
 * it and let the current checksum stand in. A package with no checksum, no
 * documents, or any unpublished draft counts as NOT_PUBLISHED — the company is
 * never told terms are waiting for them when they cannot be accepted yet.
 */
export function resolveTermsPublication({
  documents = null,
  containsDrafts = false,
  signedChecksum = "",
  currentChecksum = "",
} = {}) {
  const current = String(currentChecksum || "");
  const signed = String(signedChecksum || "");
  const hasDocuments =
    documents === null ? Boolean(current) : (documents || []).length > 0;

  if (!hasDocuments || containsDrafts || !current) {
    return TERMS_PUBLICATION.NOT_PUBLISHED;
  }
  if (!signed) return TERMS_PUBLICATION.READY_TO_ACCEPT;
  return signed === current
    ? TERMS_PUBLICATION.ACCEPTED
    : TERMS_PUBLICATION.UPDATE_REQUIRED;
}

function detailsIncomplete(profile, completeness) {
  if (!profile) return true;
  if (!String(profile.legalName || "").trim()) return true;
  if (completeness && completeness.ready === false && !profile.submittedAt) {
    return (completeness.missingFields || []).length > 0;
  }
  return false;
}

function documentsMissing(completeness) {
  return (completeness?.missingDocuments || []).length > 0;
}

function resolveState({
  profile,
  completeness,
  termsPublication,
  listedOnMarketplace,
  agreementAccepted,
}) {
  const status = profile?.verificationStatus || S.DRAFT;
  const published = termsPublication !== TERMS_PUBLICATION.NOT_PUBLISHED;
  const accepted =
    agreementAccepted || termsPublication === TERMS_PUBLICATION.ACCEPTED;

  if (status === S.SUSPENDED) return COMPANY_SETUP_STATE.SUSPENDED;
  if (status === S.PENDING_VERIFICATION) {
    return COMPANY_SETUP_STATE.DOCUMENTS_UNDER_REVIEW;
  }
  if (status !== S.VERIFIED) {
    if (detailsIncomplete(profile, completeness)) {
      return COMPANY_SETUP_STATE.DETAILS_INCOMPLETE;
    }
    if (documentsMissing(completeness)) {
      return COMPANY_SETUP_STATE.DOCUMENTS_MISSING;
    }
    return COMPANY_SETUP_STATE.DOCUMENTS_UNDER_REVIEW;
  }
  if (!published) return COMPANY_SETUP_STATE.TERMS_NOT_PUBLISHED;
  if (termsPublication === TERMS_PUBLICATION.UPDATE_REQUIRED) {
    return COMPANY_SETUP_STATE.TERMS_UPDATE;
  }
  if (!accepted) return COMPANY_SETUP_STATE.TERMS_READY;
  if (listedOnMarketplace === false) return COMPANY_SETUP_STATE.LISTING_DISABLED;
  return COMPANY_SETUP_STATE.READY;
}

/**
 * One partner-facing readiness result. The UI and the operating gates both
 * read this and nothing else.
 *
 * @param {object} input
 * @param {object|null} input.profile          PartnerLegalProfile (lean).
 * @param {object|null} input.completeness     `evaluateProfileCompleteness` output.
 * @param {string} input.termsPublication      One of `TERMS_PUBLICATION`.
 * @param {boolean} input.listedOnMarketplace  Company.listedOnMarketplace.
 * @param {boolean} input.agreementAccepted    Current package already accepted.
 * @returns {{
 *   state: string,
 *   canCreateDraftCars: boolean,
 *   canPublishCars: boolean,
 *   canReceiveBookings: boolean,
 *   nextAction: { labelKey: string, href: string } | null,
 * }}
 */
export function companySetupReadiness({
  profile = null,
  completeness = null,
  termsPublication = TERMS_PUBLICATION.NOT_PUBLISHED,
  listedOnMarketplace = true,
  agreementAccepted = false,
} = {}) {
  const state = resolveState({
    profile,
    completeness,
    termsPublication: termsPublication || TERMS_PUBLICATION.NOT_PUBLISHED,
    listedOnMarketplace,
    agreementAccepted,
  });

  const action = COMPANY_SETUP_ACTION[state] || null;

  return {
    state,
    // Work in progress is never gated: a company can always keep inactive or
    // hidden cars while Rovaro reviews documents or prepares the terms. This
    // mirrors the server, where `assertMarketplaceCarPublish` lets any
    // non-public car through. Only going live is gated.
    canCreateDraftCars: true,
    canPublishCars: state === COMPANY_SETUP_STATE.READY,
    canReceiveBookings: state === COMPANY_SETUP_STATE.READY,
    nextAction: action
      ? { labelKey: action.labelKey, href: companySetupHref(action.step) }
      : null,
  };
}

/**
 * Does this readiness result permit `capability`?
 *
 * The operating gates go through here instead of testing a flag by hand, so a
 * new state is allowed or denied everywhere at once.
 */
export function readinessAllows(readiness, capability) {
  const key = capability || COMPANY_SETUP_CAPABILITY.BOOKINGS;
  return Boolean(readiness && readiness[key]);
}
