/**
 * Company-facing legal page rules.
 *
 * Platform legal documents live under Settings → Legal documents
 * (`/admin/settings?tab=legal`). `/admin/legal` redirects there.
 * A company admin is sent to /admin/company/legal and can only see their
 * own company. Acceptance of the published terms package is one action;
 * drafts never link into the superadmin hub.
 */

import { ROLE } from "@models/user";
import {
  getEffectiveOwnerId,
  isAdminViewAsActive,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import { computeSnapshotChecksum } from "./checksum";
import { MASTER_AGREEMENT_PACKAGE } from "./documentTypes";
import { companySetupHref, legacySetupRedirect } from "./companySetupReadiness";

export const COMPANY_LEGAL_PATH = "/admin/company/legal";
export const COMPANY_TERMS_PATH = "/admin/company/setup?step=terms";
/** Where partners review and accept Rovaro Terms (Company details). */
export const COMPANY_AGREEMENT_PATH = "/admin/company/setup?step=details";
export const SUPERADMIN_LEGAL_PATH = "/admin/settings?tab=legal";

export const COMPANY_LEGAL_TABS = Object.freeze([
  "details",
  "documents",
  "terms",
]);

const PUBLIC_TERM_HREFS = Object.freeze({
  "partner-agreement": "/partner-agreement",
  "partner-operating-rules": "/partner-operating-rules",
  "data-protection-schedule": "/data-protection-schedule",
});

function roleOf(userOrRole) {
  if (userOrRole && typeof userOrRole === "object") return userOrRole.role;
  return userOrRole;
}

function contextOf(userOrRole, companyContextActive = false) {
  if (userOrRole && typeof userOrRole === "object") {
    return isAdminViewAsActive(userOrRole);
  }
  return Boolean(companyContextActive);
}

/**
 * Legal destination. Company context wins over SUPERADMIN role.
 * The navbar "Exit company" flag is the same view-as company id.
 */
export function legalNavHref({ role, companyContextActive = false } = {}) {
  const superadmin =
    Number(role) === ROLE.SUPERADMIN || isSuperAdminUser({ role });
  if (superadmin && !companyContextActive) return SUPERADMIN_LEGAL_PATH;
  return COMPANY_AGREEMENT_PATH;
}

/**
 * Opening /admin/legal. SUPERADMIN in a selected company is sent to the
 * company page. The two redirects are inverses, so they cannot loop.
 */
export function legalAreaDecision(userOrRole, companyContextActive = false) {
  const href = legalNavHref({
    role: roleOf(userOrRole),
    companyContextActive: contextOf(userOrRole, companyContextActive),
  });
  if (href === SUPERADMIN_LEGAL_PATH) {
    return { allow: true, redirectTo: null, status: 200 };
  }
  return {
    allow: false,
    redirectTo: COMPANY_AGREEMENT_PATH,
    status: 403,
  };
}

/** Opening /admin/company/legal. Bare SUPERADMIN returns to the hub. */
export function companyLegalPageAccess(user) {
  const href = legalNavHref({
    role: user?.role,
    companyContextActive: isAdminViewAsActive(user),
  });
  if (href === SUPERADMIN_LEGAL_PATH) {
    return { allow: false, redirectTo: SUPERADMIN_LEGAL_PATH };
  }
  return { allow: true, redirectTo: null };
}

/**
 * The company id a partner admin may read. A requested id for another
 * company is refused rather than swapped in.
 */
export function ownCompanyScope(session, requestedCompanyId) {
  const role = Number(session?.user?.role);
  const own = String(getEffectiveOwnerId(session?.user) || "");
  const requested = requestedCompanyId ? String(requestedCompanyId) : "";

  if (role === ROLE.SUPERADMIN) {
    if (own) {
      if (requested && requested !== own) {
        return { companyId: "", forbidden: true };
      }
      return { companyId: own, forbidden: false };
    }
    return { companyId: requested, forbidden: false };
  }

  if (requested && own && requested !== own) {
    return { companyId: "", forbidden: true };
  }

  return { companyId: own, forbidden: !own };
}

/**
 * Company the legal page may load. Query company ids are ignored unless they
 * match the active company; a mismatch is refused.
 */
export function selectedCompanyForLegalPage(user, requestedCompanyId) {
  if (isSuperAdminUser(user) && !isAdminViewAsActive(user)) return "";
  const scope = ownCompanyScope({ user }, requestedCompanyId);
  if (scope.forbidden) return "";
  return scope.companyId;
}

/** A superadmin session must not record a partner acceptance. */
export function superadminMayAcceptTerms(role) {
  return Number(role) !== ROLE.SUPERADMIN;
}

export function companyLegalStatusKey(profile) {
  const status = profile?.verificationStatus || "";
  if (status === "PENDING_VERIFICATION") return "underReview";
  if (status === "VERIFIED") return "verified";
  if (status === "REJECTED") return "rejected";
  if (status === "SUSPENDED") return "suspended";
  if (profile?.submittedAt) return "submitted";
  return "draft";
}

export function normalizeCustomAgreement(value) {
  const documentId = String(value?.documentId || "").trim();
  if (!documentId) return null;
  return {
    documentId,
    version: Number(value.version) || 1,
    title: String(value.title || "Custom agreement").trim() || "Custom agreement",
    checksum: String(value.checksum || "").trim(),
    overrides: Array.isArray(value.overrides) ? value.overrides : [],
  };
}

function snapshotRows(documents) {
  return documents.map((doc) => ({
    documentType: doc.documentType,
    language: doc.language,
    version: doc.version,
    checksum: doc.checksum,
    renderedTitle: doc.renderedTitle,
    renderedSections: doc.renderedSections,
  }));
}

function applyOverrides(documents, overrides) {
  if (!overrides.length) return documents;
  return documents.map((doc) => {
    const hits = overrides.filter(
      (item) => item?.documentType === doc.documentType && item?.heading
    );
    if (!hits.length) return doc;
    return {
      ...doc,
      renderedSections: (doc.renderedSections || []).map((section) => {
        const hit = hits.find((item) => item.heading === section.heading);
        return hit ? { ...section, text: String(hit.text || "") } : section;
      }),
    };
  });
}

/**
 * Standard published terms, plus a custom agreement only when one is assigned.
 * Sections of the standard text change only where the custom agreement
 * names that heading. The standard checksum is left untouched otherwise.
 */
export function withCustomAgreement(pkg, customAgreement) {
  const custom = normalizeCustomAgreement(customAgreement);
  if (!pkg || !custom) return pkg;

  const documents = applyOverrides(pkg.documents || [], custom.overrides);
  const sample = documents[0] || {};
  const customDoc = {
    documentType: "custom-agreement",
    language: sample.language || "en",
    jurisdiction: sample.jurisdiction || "",
    version: custom.version,
    checksum: custom.checksum,
    pk: custom.documentId,
    sk: `v${custom.version}`,
    ref: custom.documentId,
    source: "published",
    kind: "custom",
    renderedTitle: custom.title,
    renderedSections: [],
  };

  const nextDocuments = [...documents, customDoc];
  return {
    ...pkg,
    documents: nextDocuments,
    packageChecksum: computeSnapshotChecksum(snapshotRows(nextDocuments)),
    hasCustomAgreement: true,
  };
}

export const COMPANY_TERMS_PUBLICATION = Object.freeze({
  NOT_PUBLISHED: "NOT_PUBLISHED",
  READY_TO_ACCEPT: "READY_TO_ACCEPT",
  ACCEPTED: "ACCEPTED",
  UPDATE_REQUIRED: "UPDATE_REQUIRED",
});

/** One publication state for the Terms tab and the Documents tab. */
export function companyTermsPublication(input) {
  const view = presentPartnerTerms(input);
  if (view.state === "preparing") {
    return { ...view, publication: COMPANY_TERMS_PUBLICATION.NOT_PUBLISHED };
  }
  if (view.state === "accepted") {
    return { ...view, publication: COMPANY_TERMS_PUBLICATION.ACCEPTED };
  }
  if (view.state === "updated") {
    return { ...view, publication: COMPANY_TERMS_PUBLICATION.UPDATE_REQUIRED };
  }
  return { ...view, publication: COMPANY_TERMS_PUBLICATION.READY_TO_ACCEPT };
}

export function presentPartnerTerms({
  documents = [],
  containsDrafts = false,
  customAgreement = null,
  activeChecksum = "",
  currentChecksum = "",
} = {}) {
  const custom = normalizeCustomAgreement(customAgreement);
  const published =
    Array.isArray(documents) && documents.length > 0 && !containsDrafts;

  if (!published) {
    return {
      state: "preparing",
      canAccept: false,
      links: [],
      standardApplies: !custom,
      label: custom ? "custom" : "standard",
      custom,
      message: "preparing",
    };
  }

  const signed = String(activeChecksum || "");
  const current = String(currentChecksum || "");
  const accepted = Boolean(signed) && signed === current;
  const outdated = Boolean(signed) && Boolean(current) && signed !== current;

  const links = [];
  for (const doc of documents) {
    if (doc?.kind === "custom" || doc?.documentType === "custom-agreement") {
      continue;
    }
    const href = PUBLIC_TERM_HREFS[doc.documentType] || "";
    if (!href || href.startsWith(SUPERADMIN_LEGAL_PATH)) continue;
    links.push({
      documentType: doc.documentType,
      href,
    });
  }

  return {
    state: accepted ? "accepted" : outdated ? "updated" : "ready",
    canAccept: !accepted,
    links,
    standardApplies: !custom,
    label: custom ? "custom" : "standard",
    custom,
    message: accepted ? "accepted" : outdated ? "updated" : "ready",
  };
}

/**
 * One checkbox is the whole acceptance. The mailbox is the session email.
 */
export function buildTermsAcceptance({
  accepted = false,
  signerName = "",
  signerRole = "",
  sessionEmail = "",
  companyId = "",
  userId = "",
  acceptedAt = "",
  ipAddress = "",
  userAgent = "",
  documents = [],
  packageChecksum = "",
} = {}) {
  return {
    companyId: String(companyId || ""),
    authenticatedUserId: String(userId || ""),
    signerName: String(signerName || "").trim(),
    signerRole: String(signerRole || "").trim(),
    signerEmail: String(sessionEmail || "").trim().toLowerCase(),
    acceptedCheckbox: Boolean(accepted),
    confirmationOfAuthority: Boolean(accepted),
    acceptedAt,
    ipAddress: String(ipAddress || ""),
    userAgent: String(userAgent || ""),
    documents: (documents || []).map((doc) => ({
      documentId: doc.ref || doc.pk || doc.documentId || doc.documentType,
      documentType: doc.documentType,
      language: doc.language,
      version: doc.version,
      checksum: doc.checksum,
    })),
    packageChecksum: String(packageChecksum || ""),
  };
}

export function acceptanceOutdated(activeChecksum, nextChecksum) {
  return (
    Boolean(activeChecksum) &&
    Boolean(nextChecksum) &&
    String(activeChecksum) !== String(nextChecksum)
  );
}

/** Publishing a new package does not rewrite existing bookings. */
export function republishLeavesOrder(order) {
  if (!order) return true;
  if (order.paid === true || order.paymentStatus === "paid") return true;
  if (order.bookingStatus === "BOOKING_CONFIRMED") return true;
  return true;
}

export function standardPackageNeedsPublish(entries) {
  const list = Array.isArray(entries) ? entries : [];
  for (const documentType of MASTER_AGREEMENT_PACKAGE) {
    const entry = list.find((item) => item?.documentType === documentType);
    if (!entry) return true;
    for (const lang of ["en", "es"]) {
      if (!entry.languages?.[lang]?.published) return true;
    }
  }
  return false;
}

/**
 * Marketplace listing is required in addition to the legal gate.
 * Omitted listing stays compatible with callers that only know the gate.
 */
export function companyMayOperate({
  gate,
  listedOnMarketplace = true,
} = {}) {
  if (!gate?.canOperate) return false;
  if (listedOnMarketplace === false) return false;
  return true;
}

/** Older profile and agreement URLs all open the company Terms tab. */
export function legacyLegalProfileRedirect(pathname = "", search = {}) {
  return legacySetupRedirect(pathname, search) || companySetupHref("details");
}

const SIGNER_ROLE_FIELDS = ["signerRole", "legalRole", "signatoryRole"];

/**
 * Role used on the Terms form. Only an explicit signer role is accepted.
 * Company description, marketing copy and call-to-action text are ignored.
 */
export function explicitSignerRole(source) {
  const raw =
    source && typeof source === "object"
      ? SIGNER_ROLE_FIELDS.map((key) => source[key]).find((value) =>
          String(value || "").trim()
        )
      : source;
  const value = String(raw || "").trim();
  if (!value || value.length > 60) return "";
  if (/[.!?]/.test(value)) return "";
  if (value.split(/\s+/).length > 5) return "";
  if (/waiter|ask our|call our|notification|marketing|description/i.test(value)) {
    return "";
  }
  return value;
}
