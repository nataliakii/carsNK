/**
 * Per-company commercial terms referenced by the legal documents.
 *
 * The Rovaro Booking Fee percentage is negotiated with each partner, so it is
 * NOT a fact about the shared documents that every partner signs. The shared
 * text says "the applicable Rovaro Booking Fee"; the number lives here.
 *
 * Two rules make that auditable.
 *
 *   1. The rate comes from {@link resolveBookingFeeBps} only. This module owns
 *      no arithmetic of its own — it formats what the canonical resolver says.
 *
 *   2. At the moment a company accepts, {@link freezeCompanyCommercialTerms}
 *      resolves the rate and returns a frozen record with its own checksum.
 *      That record is stored on the immutable acceptance next to the document
 *      checksums, so what the partner agreed to stays exactly reconstructable
 *      even after the negotiated rate is later changed.
 *
 * The shared package checksum must NOT depend on the rate. That checksum
 * decides whether a partner's agreement is still current, and an out-of-date
 * agreement hides the partner's fleet and cancels open checkout sessions.
 * Tying it to a commercial number would mean an admin editing a percentage
 * silently takes a partner offline. `{{company.*}}` tokens therefore resolve
 * only where a company context is deliberately supplied — the per-company
 * annex — and are dropped from the shared documents.
 */

import {
  MARKETPLACE_BOOKING_FEE_SOURCE,
  assertMarketplaceBookingFee,
  resolveBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";

import { computeSnapshotChecksum } from "./checksum";

/** Bump only when the frozen shape changes. Stored on every snapshot. */
export const COMMERCIAL_TERMS_VERSION = 1;

/** Configurable values a legal section may declare in `requires`. */
export const COMPANY_COMMERCIAL_TOKEN_KEYS = Object.freeze([
  "bookingFeePercent",
  "supplierBalancePercent",
]);

/**
 * The commercial terms that apply to one company right now.
 *
 * Display-safe: an unusable stored rate resolves with `rateSource: "invalid"`,
 * blank labels and a populated `error` rather than a plausible wrong number.
 *
 * @param {{ company?: object, platformSettings?: object, order?: object }} [input]
 */
export function resolveCompanyCommercialTerms({
  company = null,
  platformSettings = null,
  order = null,
} = {}) {
  const fee = resolveBookingFeeBps({ order, company, platformSettings });
  return {
    version: COMMERCIAL_TERMS_VERSION,
    bookingFeeBps: fee.bps,
    bookingFeePercent: fee.percent,
    bookingFeePercentLabel: fee.percentLabel,
    supplierBalanceBps: fee.supplierBps,
    supplierBalancePercent: fee.supplierPercent,
    supplierBalancePercentLabel: fee.supplierPercentLabel,
    rateSource: fee.source,
    isNegotiated: Boolean(fee.isNegotiated),
    isPlatformDefault:
      fee.source === MARKETPLACE_BOOKING_FEE_SOURCE.PLATFORM ||
      fee.source === MARKETPLACE_BOOKING_FEE_SOURCE.DEFAULT,
    error: fee.error || "",
  };
}

/**
 * `{{company.*}}` token values. Returns an empty map for terms that could not
 * be resolved, so `requires` drops the dependent section instead of rendering
 * a blank percentage into a contract.
 *
 * @param {ReturnType<typeof resolveCompanyCommercialTerms>|null|undefined} terms
 */
export function buildCompanyCommercialTokens(terms) {
  if (!terms || !terms.bookingFeePercentLabel) return {};
  return {
    "company.bookingFeePercent": `${terms.bookingFeePercentLabel}%`,
    "company.supplierBalancePercent": `${terms.supplierBalancePercentLabel}%`,
  };
}

/**
 * Values `sectionRequirementsMet` checks before rendering a section that
 * depends on the company's negotiated terms.
 *
 * @param {ReturnType<typeof resolveCompanyCommercialTerms>|null|undefined} terms
 */
export function companyCommercialRequirables(terms) {
  return {
    bookingFeePercent: terms?.bookingFeePercentLabel || "",
    supplierBalancePercent: terms?.supplierBalancePercentLabel || "",
  };
}

/**
 * Resolve and freeze the commercial terms for an acceptance record.
 *
 * Throws {@link MarketplaceBookingFeeError} when the stored rate is unusable:
 * a partner must never be recorded as having agreed to a percentage the
 * platform cannot state.
 *
 * @param {{ company?: object, platformSettings?: object, resolvedAt?: Date }} [input]
 */
export function freezeCompanyCommercialTerms({
  company = null,
  platformSettings = null,
  resolvedAt = null,
} = {}) {
  const fee = assertMarketplaceBookingFee(
    resolveBookingFeeBps({ company, platformSettings })
  );
  const frozen = {
    version: COMMERCIAL_TERMS_VERSION,
    bookingFeeBps: fee.bps,
    bookingFeePercent: fee.percent,
    bookingFeePercentLabel: fee.percentLabel,
    supplierBalanceBps: fee.supplierBps,
    supplierBalancePercent: fee.supplierPercent,
    supplierBalancePercentLabel: fee.supplierPercentLabel,
    rateSource: fee.source,
    resolvedAt: (resolvedAt || new Date()).toISOString(),
  };
  return { ...frozen, checksum: computeSnapshotChecksum(frozen) };
}

/**
 * Re-derive the checksum of a stored snapshot so a dispute can prove the
 * record was not edited after signing.
 *
 * @param {object|null|undefined} snapshot
 */
export function verifyCompanyCommercialTerms(snapshot) {
  if (!snapshot) return { ok: false, actual: "", expected: "" };
  const { checksum, ...frozen } = snapshot;
  const actual = computeSnapshotChecksum(frozen);
  const expected = String(checksum || "").toLowerCase();
  return { ok: actual === expected, actual, expected };
}
