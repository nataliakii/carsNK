/**
 * Server-only marketplace operating policy.
 *
 * Legal rules live in `evaluatePartnerOperatingGate`. This module loads the
 * data that function needs, adds the marketplace listing flag, maps denials
 * to stable public codes, and is the single call site for commercial routes.
 */

import mongoose from "mongoose";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import { connectToDB } from "@lib/database";
import {
  BOOKING_MODES,
  isMarketplaceRequestMode,
  resolveBookingMode,
} from "@/domain/booking/bookingMode";
import { isPublicCar } from "@/domain/owners/ownerScope";
import {
  buildAgreementPackage,
  getActiveAgreement,
  getCurrentPackageChecksum,
} from "./agreementService";
import { withCustomAgreement } from "./companyLegalPage";
import {
  evaluatePartnerOperatingGate,
  PARTNER_GATE_BLOCKER,
} from "./partnerGate";
import { evaluateProfileCompleteness } from "./partnerVerification";
import { companySetupReadiness } from "./companySetupReadiness";
import { recordAuditEvent } from "./auditTrail";

export const PARTNER_OPERATION_ERROR = Object.freeze({
  COMPLIANCE_REQUIRED: "PARTNER_COMPLIANCE_REQUIRED",
  SUSPENDED: "PARTNER_SUSPENDED",
});

export const PARTNER_OPERATION_REASON = Object.freeze({
  PROFILE_NOT_VERIFIED: "PROFILE_NOT_VERIFIED",
  AGREEMENT_MISSING: "AGREEMENT_MISSING",
  AGREEMENT_OUTDATED: "AGREEMENT_OUTDATED",
  PARTNER_REJECTED: "PARTNER_REJECTED",
  MARKETPLACE_DISABLED: "MARKETPLACE_DISABLED",
});

export const PARTNER_OPERATION_PURPOSE = Object.freeze({
  LISTING: "listing",
  CAR_PUBLISH: "car_publish",
  BOOKING: "booking",
  CONFIRM: "confirm",
  ALTERNATIVE: "alternative",
  CHECKOUT: "checkout",
  REISSUE: "reissue",
  EMAIL_ACCEPT: "email_accept",
});

const OVERRIDE_PURPOSES = new Set([
  PARTNER_OPERATION_PURPOSE.CONFIRM,
  PARTNER_OPERATION_PURPOSE.ALTERNATIVE,
  PARTNER_OPERATION_PURPOSE.CHECKOUT,
  PARTNER_OPERATION_PURPOSE.REISSUE,
]);

const PARTNER_MESSAGE = {
  [PARTNER_OPERATION_ERROR.SUSPENDED]:
    "Trading is suspended. Rovaro has to restore the account before you can continue.",
  [PARTNER_OPERATION_REASON.AGREEMENT_MISSING]:
    "You cannot take bookings until the current Partner Agreement is signed.",
  [PARTNER_OPERATION_REASON.AGREEMENT_OUTDATED]:
    "A new Partner Agreement is in force and has to be accepted before you can continue.",
  [PARTNER_OPERATION_REASON.PARTNER_REJECTED]:
    "This company cannot take bookings until the legal profile is corrected and verified.",
  [PARTNER_OPERATION_REASON.MARKETPLACE_DISABLED]:
    "Marketplace listing is not enabled for this company yet.",
  default:
    "You cannot publish cars or take bookings until the company is verified and the current Partner Agreement is signed.",
};

const CUSTOMER_UNAVAILABLE_MESSAGE = "This vehicle is not available.";

function asCompanyId(value) {
  if (!value) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function isListedOnMarketplace(company) {
  return company?.listedOnMarketplace !== false;
}

/**
 * Spain marketplace fleets (and any company explicitly in MARKETPLACE_REQUEST).
 * Greece OPS_CALENDAR companies are out of scope.
 */
export function isMarketplaceOperatingCompany(company) {
  if (!company) return false;
  const mode = resolveBookingMode({ company, forNewOrder: true });
  return isMarketplaceRequestMode(mode);
}

/** New Spain companies stay off the public hub until listing is enabled. */
export function defaultListedOnMarketplaceForCountry(countryCode) {
  return String(countryCode || "").trim().toUpperCase() !== "ES";
}

/**
 * Map gate blockers to the stable public reason codes. Never forwards
 * document names, review notes or profile fields.
 */
export function mapGateToOperationDenial(gate) {
  const codes = (gate?.blockers || []).map((b) => b.code);
  if (codes.includes(PARTNER_GATE_BLOCKER.SUSPENDED)) {
    return {
      error: PARTNER_OPERATION_ERROR.SUSPENDED,
      code: PARTNER_OPERATION_ERROR.SUSPENDED,
      reason: PARTNER_OPERATION_ERROR.SUSPENDED,
    };
  }
  if (codes.includes(PARTNER_GATE_BLOCKER.REJECTED)) {
    return {
      error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
      code: PARTNER_OPERATION_REASON.PARTNER_REJECTED,
      reason: PARTNER_OPERATION_REASON.PARTNER_REJECTED,
    };
  }
  if (
    codes.includes(PARTNER_GATE_BLOCKER.NO_PROFILE) ||
    codes.includes(PARTNER_GATE_BLOCKER.PROFILE_INCOMPLETE) ||
    codes.includes(PARTNER_GATE_BLOCKER.AWAITING_VERIFICATION)
  ) {
    return {
      error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
      code: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
      reason: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
    };
  }
  if (codes.includes(PARTNER_GATE_BLOCKER.AGREEMENT_OUTDATED)) {
    return {
      error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
      code: PARTNER_OPERATION_REASON.AGREEMENT_OUTDATED,
      reason: PARTNER_OPERATION_REASON.AGREEMENT_OUTDATED,
    };
  }
  if (codes.includes(PARTNER_GATE_BLOCKER.AGREEMENT_NOT_SIGNED)) {
    return {
      error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
      code: PARTNER_OPERATION_REASON.AGREEMENT_MISSING,
      reason: PARTNER_OPERATION_REASON.AGREEMENT_MISSING,
    };
  }
  return {
    error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
    code: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
    reason: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
  };
}

function partnerMessageFor(denial) {
  if (!denial) return "";
  if (denial.error === PARTNER_OPERATION_ERROR.SUSPENDED) {
    return PARTNER_MESSAGE[PARTNER_OPERATION_ERROR.SUSPENDED];
  }
  return PARTNER_MESSAGE[denial.code] || PARTNER_MESSAGE.default;
}

function allowedResult({
  companyId,
  company,
  gate,
  listed,
  readiness = null,
}) {
  const signedChecksum = gate?.activeAgreementChecksum || "";
  return {
    allowed: true,
    skipped: false,
    error: null,
    code: null,
    reason: null,
    companyId,
    verificationStatus: gate?.verificationStatus || null,
    agreementSigned: Boolean(gate?.agreementSigned),
    agreementOutdated: Boolean(gate?.agreementOutdated),
    packageChecksumMatch: Boolean(
      gate?.agreementSigned && !gate?.agreementOutdated
    ),
    listedOnMarketplace: listed,
    marketplace: true,
    partnerMessage: "",
    customerMessage: CUSTOMER_UNAVAILABLE_MESSAGE,
    signedChecksum,
    readiness,
  };
}

function deniedResult({
  companyId,
  gate,
  listed,
  denial,
  readiness = null,
  partnerMessage,
}) {
  return {
    allowed: false,
    skipped: false,
    error: denial.error,
    code: denial.code,
    reason: denial.reason,
    companyId,
    verificationStatus: gate?.verificationStatus || null,
    agreementSigned: Boolean(gate?.agreementSigned),
    agreementOutdated: Boolean(gate?.agreementOutdated),
    packageChecksumMatch: false,
    listedOnMarketplace: listed,
    marketplace: true,
    partnerMessage: partnerMessage || partnerMessageFor(denial),
    readiness,
    customerMessage: CUSTOMER_UNAVAILABLE_MESSAGE,
    blockers: gate?.blockers || [],
  };
}

function skippedNotMarketplace(companyId) {
  return {
    allowed: true,
    skipped: true,
    error: null,
    code: null,
    reason: "not_marketplace",
    companyId: companyId || "",
    verificationStatus: null,
    agreementSigned: false,
    agreementOutdated: false,
    packageChecksumMatch: false,
    listedOnMarketplace: true,
    marketplace: false,
    partnerMessage: "",
    customerMessage: CUSTOMER_UNAVAILABLE_MESSAGE,
  };
}

/**
 * Pure composition: legal gate + optional listing flag.
 * Used by tests and by the async loader.
 */
export function evaluateMarketplaceOperatingState({
  company = null,
  profile = null,
  completeness = null,
  activeAgreement = null,
  currentPackageChecksum = "",
  requireListed = false,
} = {}) {
  if (!isMarketplaceOperatingCompany(company)) {
    return skippedNotMarketplace(asCompanyId(company?._id));
  }

  const listed = isListedOnMarketplace(company);
  const gate = evaluatePartnerOperatingGate({
    profile,
    completeness:
      completeness || (profile ? evaluateProfileCompleteness(profile) : null),
    activeAgreement,
    currentPackageChecksum,
  });
  gate.activeAgreementChecksum = activeAgreement?.packageChecksum || "";

  const termsPublication = !currentPackageChecksum
    ? "NOT_PUBLISHED"
    : !activeAgreement?.packageChecksum
      ? "READY_TO_ACCEPT"
      : activeAgreement.packageChecksum !== currentPackageChecksum
        ? "UPDATE_REQUIRED"
        : "ACCEPTED";
  const readiness = companySetupReadiness({
    profile,
    completeness:
      completeness || (profile ? evaluateProfileCompleteness(profile) : null),
    termsPublication,
    listedOnMarketplace: listed,
    agreementAccepted: termsPublication === "ACCEPTED",
  });

  const companyId = asCompanyId(company?._id);
  const neutral =
    readiness.state === "TERMS_NOT_PUBLISHED" ||
    readiness.state === "DOCUMENTS_UNDER_REVIEW" ||
    readiness.state === "READY_BUT_LISTING_DISABLED"
      ? "Rovaro is preparing the terms. No action is required from you."
      : "";

  if (!readiness.canReceiveBookings) {
    if (readiness.state === "READY_BUT_LISTING_DISABLED") {
      return deniedResult({
        companyId,
        gate,
        listed,
        readiness,
        partnerMessage: "Rovaro will activate your marketplace listing.",
        denial: {
          error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
          code: PARTNER_OPERATION_REASON.MARKETPLACE_DISABLED,
          reason: PARTNER_OPERATION_REASON.MARKETPLACE_DISABLED,
        },
      });
    }
    return deniedResult({
      companyId,
      gate,
      listed,
      readiness,
      partnerMessage: neutral || undefined,
      denial: mapGateToOperationDenial(gate),
    });
  }

  return allowedResult({ companyId, company, gate, listed, readiness });
}

function validObjectId(id) {
  const raw = asCompanyId(id);
  return raw && mongoose.Types.ObjectId.isValid(raw) ? raw : "";
}

function companyHintHasOperatingFields(hint) {
  if (!hint || !hint._id) return false;
  return (
    hint.country != null ||
    hint.bookingMode != null ||
    hint.listedOnMarketplace != null
  );
}

export async function loadPartnerOperatingInputs(companyId, { companyHint = null } = {}) {
  await connectToDB();
  const id = validObjectId(companyId) || validObjectId(companyHint?._id);
  const company =
    companyHintHasOperatingFields(companyHint) &&
    asCompanyId(companyHint._id) === id
      ? companyHint
      : id
        ? await Company.findById(id)
            .select(
              "_id country bookingMode listedOnMarketplace name"
            )
            .lean()
        : null;

  if (!company || !isMarketplaceOperatingCompany(company)) {
    return {
      company,
      profile: null,
      completeness: null,
      activeAgreement: null,
      currentPackageChecksum: "",
    };
  }

  const [profile, activeAgreement, standardChecksum] = await Promise.all([
    PartnerLegalProfile.findOne({ companyId: company._id })
      .select("companyId verificationStatus legalName customAgreement")
      .lean(),
    getActiveAgreement(company._id),
    getCurrentPackageChecksum(),
  ]);
  let currentPackageChecksum = standardChecksum;
  if (profile?.customAgreement?.documentId) {
    const pkg = await buildAgreementPackage();
    currentPackageChecksum = withCustomAgreement(
      pkg,
      profile.customAgreement
    ).packageChecksum;
  }

  return {
    company,
    profile,
    completeness: profile ? evaluateProfileCompleteness(profile) : null,
    activeAgreement,
    currentPackageChecksum,
  };
}

function overrideAllowed({ purpose, overrideReason, overrideByRole }) {
  if (!OVERRIDE_PURPOSES.has(purpose)) return false;
  if (String(overrideByRole || "").toLowerCase() !== "superadmin") return false;
  return Boolean(String(overrideReason || "").trim());
}

/**
 * Authoritative "may this marketplace partner perform a new commercial action?"
 *
 * Greece / non-marketplace companies return `{ allowed: true, skipped: true }`.
 */
export async function assertMarketplaceCarPublish(companyId, options = {}) {
  const car = options.car;
  if (car && !isPublicCar(car)) {
    return skippedNotMarketplace(asCompanyId(companyId));
  }
  return assertPartnerCanOperate(companyId, {
    company: options.company,
    requireListed: false,
    purpose: PARTNER_OPERATION_PURPOSE.CAR_PUBLISH,
    overrideReason: options.overrideReason,
    overrideByRole: options.overrideByRole,
    overrideByEmail: options.overrideByEmail,
    audit: options.audit,
  });
}

export async function assertPartnerCanOperate(companyId, {
  company: companyHint = null,
  requireListed = false,
  purpose = PARTNER_OPERATION_PURPOSE.BOOKING,
  overrideReason = "",
  overrideByRole = "",
  overrideByEmail = "",
  audit = null,
} = {}) {
  const inputs = await loadPartnerOperatingInputs(companyId, { companyHint });
  if (!inputs.company) {
    if (!companyId && !companyHint) {
      return skippedNotMarketplace("");
    }
    return deniedResult({
      companyId: asCompanyId(companyId),
      gate: evaluatePartnerOperatingGate({
        profile: null,
        completeness: null,
        activeAgreement: null,
        currentPackageChecksum: "",
      }),
      listed: false,
      denial: {
        error: PARTNER_OPERATION_ERROR.COMPLIANCE_REQUIRED,
        code: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
        reason: PARTNER_OPERATION_REASON.PROFILE_NOT_VERIFIED,
      },
    });
  }

  const result = evaluateMarketplaceOperatingState({
    ...inputs,
    requireListed,
  });

  if (result.allowed) return result;

  if (
    overrideAllowed({
      purpose,
      overrideReason,
      overrideByRole,
    })
  ) {
    await recordAuditEvent({
      action: "PARTNER_COMPLIANCE_OVERRIDE",
      userRole: "superadmin",
      userEmail: overrideByEmail || "",
      severity: "critical",
      reason: String(overrideReason).slice(0, 1000),
      ipAddress: audit?.ipAddress || "",
      userAgent: audit?.userAgent || "",
      orderData: audit?.orderId ? { orderId: audit.orderId } : undefined,
      metadata: {
        purpose,
        companyId: result.companyId,
        code: result.code,
        carId: audit?.carId ? String(audit.carId) : undefined,
      },
    });
    return {
      ...result,
      allowed: true,
      overridden: true,
      overrideReason: String(overrideReason).slice(0, 300),
      partnerMessage: "",
    };
  }

  return result;
}

export async function auditPartnerComplianceBlock({
  purpose,
  result,
  actorEmail = "",
  actorRole = "admin",
  ipAddress = "",
  userAgent = "",
  orderId,
  carId,
}) {
  if (!result || result.allowed || result.skipped) return false;
  return recordAuditEvent({
    action: "PARTNER_COMPLIANCE_BLOCKED",
    userRole: actorRole === "superadmin" ? "superadmin" : actorRole || "admin",
    userEmail: actorEmail,
    severity: "high",
    result: "failure",
    reason: result.code || result.error,
    ipAddress,
    userAgent,
    orderData: orderId ? { orderId } : undefined,
    metadata: {
      purpose,
      companyId: result.companyId || "",
      code: result.code,
      error: result.error,
      carId: carId ? String(carId) : undefined,
    },
  });
}

/**
 * Partner/admin JSON body. Never includes profile or document fields.
 */
export function partnerComplianceJson(result) {
  return {
    success: false,
    error: result.error,
    code: result.code,
    reason: result.reason,
    message: result.partnerMessage,
  };
}

/** Public customer JSON — generic, no compliance leak. */
export function customerUnavailableJson() {
  return {
    success: false,
    message: CUSTOMER_UNAVAILABLE_MESSAGE,
  };
}

/**
 * Batch: owner ids that must be hidden from public marketplace search.
 * Fail closed per company; one bad profile never fails the whole query.
 */
export async function ownerIdsHiddenFromPublicMarketplace(companies = []) {
  const hide = [];
  const needLegal = [];

  for (const company of companies || []) {
    if (!company?._id) continue;
    if (!isListedOnMarketplace(company)) {
      hide.push(company._id);
      continue;
    }
    if (isMarketplaceOperatingCompany(company)) {
      needLegal.push(company);
    }
  }

  if (!needLegal.length) return hide;

  let standardChecksum = "";
  try {
    standardChecksum = await getCurrentPackageChecksum();
  } catch (err) {
    console.error(
      "[partnerOperatingPolicy] checksum load failed; hiding marketplace fleets",
      err?.message || err
    );
    return hide.concat(needLegal.map((c) => c._id));
  }

  const ids = needLegal.map((c) => c._id);
  let profiles = [];
  let agreements = [];
  try {
    [profiles, agreements] = await Promise.all([
      PartnerLegalProfile.find({ companyId: { $in: ids } })
        .select("companyId verificationStatus customAgreement")
        .lean(),
      PartnerAgreementAcceptance.find({
        companyId: { $in: ids },
        supersededAt: null,
        terminatedAt: null,
      })
        .sort({ acceptedAt: -1 })
        .select("companyId packageChecksum acceptedAt")
        .lean(),
    ]);
  } catch (err) {
    console.error(
      "[partnerOperatingPolicy] compliance index failed; hiding marketplace fleets",
      err?.message || err
    );
    return hide.concat(needLegal.map((c) => c._id));
  }

  const profileByCompany = new Map(
    (profiles || []).map((p) => [String(p.companyId), p])
  );
  const agreementByCompany = new Map();
  for (const row of agreements || []) {
    const key = String(row.companyId);
    if (!agreementByCompany.has(key)) agreementByCompany.set(key, row);
  }

  for (const company of needLegal) {
    const key = String(company._id);
    const profile = profileByCompany.get(key) || null;
    let currentPackageChecksum = standardChecksum;
    if (profile?.customAgreement?.documentId) {
      const pkg = await buildAgreementPackage();
      currentPackageChecksum = withCustomAgreement(
        pkg,
        profile.customAgreement
      ).packageChecksum;
    }
    const state = evaluateMarketplaceOperatingState({
      company,
      profile,
      activeAgreement: agreementByCompany.get(key) || null,
      currentPackageChecksum,
      requireListed: true,
    });
    if (!state.allowed) hide.push(company._id);
  }

  return hide;
}

/**
 * Keep companies that may appear on the public marketplace.
 * Fail closed per company; never abort the whole list.
 */
export async function filterMarketplaceOperationalCompanies(companies = []) {
  const hide = new Set(
    (await ownerIdsHiddenFromPublicMarketplace(companies)).map((id) =>
      String(id)
    )
  );
  return (companies || []).filter((company) => !hide.has(String(company?._id)));
}

export async function isPublicMarketplaceCarAllowed({ car, company }) {
  if (!isPublicCar(car)) return false;
  if (!company) return false;
  if (!isListedOnMarketplace(company)) return false;
  if (!isMarketplaceOperatingCompany(company)) return true;
  const state = await assertPartnerCanOperate(company._id, {
    company,
    requireListed: true,
    purpose: PARTNER_OPERATION_PURPOSE.LISTING,
  });
  return Boolean(state.allowed);
}

export function isGreeceLegacyCompany(company) {
  const mode = resolveBookingMode({ company, forNewOrder: true });
  return mode === BOOKING_MODES.OPS_CALENDAR;
}
