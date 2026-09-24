import { PARTNER_VERIFICATION_STATUS as S } from "./partnerVerification";

export const COMPANY_SETUP_PATH = "/admin/company/setup";

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

const SETUP_STEPS = new Set(["details", "documents", "terms", "review"]);

export function companySetupHref(step = "details") {
  const safe = SETUP_STEPS.has(step) ? step : "details";
  return `${COMPANY_SETUP_PATH}?step=${safe}`;
}

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

/**
 * One partner-facing readiness result. UI and gates both read this.
 */
export function companySetupReadiness({
  profile = null,
  completeness = null,
  termsPublication = "NOT_PUBLISHED",
  listedOnMarketplace = true,
  agreementAccepted = false,
} = {}) {
  const status = profile?.verificationStatus || S.DRAFT;
  const published =
    termsPublication &&
    termsPublication !== "NOT_PUBLISHED";
  const accepted =
    agreementAccepted ||
    termsPublication === "ACCEPTED";

  let state = COMPANY_SETUP_STATE.DETAILS_INCOMPLETE;

  if (status === S.SUSPENDED) {
    state = COMPANY_SETUP_STATE.SUSPENDED;
  } else if (status === S.PENDING_VERIFICATION) {
    state = COMPANY_SETUP_STATE.DOCUMENTS_UNDER_REVIEW;
  } else if (detailsIncomplete(profile, completeness) && status !== S.VERIFIED) {
    state = COMPANY_SETUP_STATE.DETAILS_INCOMPLETE;
  } else if (documentsMissing(completeness) && status !== S.VERIFIED) {
    state = COMPANY_SETUP_STATE.DOCUMENTS_MISSING;
  } else if (status !== S.VERIFIED) {
    state = COMPANY_SETUP_STATE.DOCUMENTS_UNDER_REVIEW;
  } else if (!published) {
    state = COMPANY_SETUP_STATE.TERMS_NOT_PUBLISHED;
  } else if (termsPublication === "UPDATE_REQUIRED") {
    state = COMPANY_SETUP_STATE.TERMS_UPDATE;
  } else if (!accepted) {
    state = COMPANY_SETUP_STATE.TERMS_READY;
  } else if (listedOnMarketplace === false) {
    state = COMPANY_SETUP_STATE.LISTING_DISABLED;
  } else {
    state = COMPANY_SETUP_STATE.READY;
  }

  const draftOk = new Set([
    COMPANY_SETUP_STATE.DOCUMENTS_UNDER_REVIEW,
    COMPANY_SETUP_STATE.TERMS_NOT_PUBLISHED,
    COMPANY_SETUP_STATE.TERMS_READY,
    COMPANY_SETUP_STATE.TERMS_UPDATE,
    COMPANY_SETUP_STATE.LISTING_DISABLED,
    COMPANY_SETUP_STATE.READY,
  ]).has(state);

  const actions = {
    [COMPANY_SETUP_STATE.DETAILS_INCOMPLETE]: {
      labelKey: "continueSetup",
      href: companySetupHref("details"),
    },
    [COMPANY_SETUP_STATE.DOCUMENTS_MISSING]: {
      labelKey: "uploadDocuments",
      href: companySetupHref("documents"),
    },
    [COMPANY_SETUP_STATE.TERMS_READY]: {
      labelKey: "reviewTerms",
      href: companySetupHref("terms"),
    },
    [COMPANY_SETUP_STATE.TERMS_UPDATE]: {
      labelKey: "reviewUpdatedTerms",
      href: companySetupHref("terms"),
    },
  };

  return {
    state,
    canCreateDraftCars: draftOk,
    canPublishCars: state === COMPANY_SETUP_STATE.READY,
    canReceiveBookings: state === COMPANY_SETUP_STATE.READY,
    nextAction: actions[state] || null,
  };
}
