/**
 * The one read model behind the Booking Details modal.
 *
 * Calendar, Orders list and the email deep link all render this object, so a
 * booking cannot look different depending on where it was opened from.
 *
 * Money is never recomputed here. The line items come from the existing
 * reconciliation in `priceBreakdownReconciliation.js` and the Rovaro/supplier
 * split comes from the immutable snapshot in `bookingFinancialSnapshot.js`.
 * This module only checks that they agree and refuses to render a total that
 * its own line items do not add up to.
 */

import {
  BOOKING_SOURCE,
  isInternalBooking,
  resolveBookingSource,
  resolvePlatformWorkflowStage,
  PLATFORM_WORKFLOW_STAGE,
} from "@/domain/admin/rovaroContractorAdmin";
import { resolveBookingFinancialSnapshot } from "@/domain/orders/bookingFinancialSnapshot";
import {
  assertAuthoritativePriceReconciled,
  formatReconciledBreakdownRows,
} from "@/domain/orders/priceBreakdownReconciliation";
import {
  formatMarketplaceFeePercent,
  resolveMarketplaceBookingFeeBps,
  snapshotMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";
import { isValidPublicBookingReference } from "@/domain/booking/publicBookingReference";
import {
  BOOKING_CAPABILITY,
  hasBookingCapability,
} from "@/domain/orders/bookingCapabilities";

/** Why a money-changing action is unavailable. */
export const FINANCIAL_INVARIANT = Object.freeze({
  OK: "OK",
  LINE_ITEMS_DO_NOT_SUM: "LINE_ITEMS_DO_NOT_SUM",
  HEADER_CONTRADICTS_BREAKDOWN: "HEADER_CONTRADICTS_BREAKDOWN",
  SPLIT_DOES_NOT_SUM: "SPLIT_DOES_NOT_SUM",
});

function minorToMajor(minor) {
  return Math.round(Number(minor) || 0) / 100;
}

function text(value) {
  return String(value ?? "").trim();
}

/**
 * Primary title. The customer-safe reference is preferred over the long
 * timestamp order number, which is an internal identifier.
 */
export function bookingDisplayReference(order) {
  if (isValidPublicBookingReference(order?.publicReference)) {
    return order.publicReference;
  }
  return text(order?.orderNumber) || text(order?._id);
}

/**
 * Which Rovaro Booking Fee rate this booking is shown at.
 *
 * Precedence is the one documented in `marketplaceBookingFee.js`: the rate
 * snapshotted on the order wins forever, then the rate implied by the order's
 * own stored amounts, then the company's negotiated contract, then the
 * platform default. Nothing here assumes a percentage.
 */
function resolveDisplayFeeBps(order, snapshot, opts = {}) {
  const fromSnapshot = Number(snapshot?.feeBps);
  if (Number.isFinite(fromSnapshot) && fromSnapshot > 0) return fromSnapshot;
  const stored = snapshotMarketplaceBookingFeeBps(order);
  if (stored.source !== "default") return stored.bps;
  return resolveMarketplaceBookingFeeBps(opts.company, opts.platformSettings).bps;
}

/**
 * The figure the order carries as "the price", independent of the breakdown.
 * A modal header that disagrees with its own line items is the defect the
 * owner photographed, so it is compared rather than trusted.
 */
function storedHeadlineMinor(order) {
  const raw = order?.OverridePrice != null ? order.OverridePrice : order?.totalPrice;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * The financial section. One immutable calculation, one total.
 *
 * @param {object} order
 * @param {{ priceBreakdown?: object, company?: object, platformSettings?: object }} [opts]
 */
export function buildBookingFinancialView(order, opts = {}) {
  const source = { ...order, priceBreakdown: opts.priceBreakdown || null };
  const assertion = assertAuthoritativePriceReconciled(source, { locale: "en" });
  const reconciliation = assertion.breakdown;
  const storedTotalMinor = Math.round(Number(reconciliation.totalMinor) || 0);

  // A row the reconciliation had to invent to make the stored header figure
  // balance is the defect itself, not a charge. It is dropped, which is what
  // makes the line items disagree with a contradicted total instead of
  // silently absorbing the difference.
  const rows = assertion.legacySplitOnly
    ? [{ code: "RENTAL", fallbackLabel: "Rental", minor: storedTotalMinor, free: false }]
    : formatReconciledBreakdownRows(reconciliation)
        .filter((row) => row.legacy !== true)
        .map((row) => ({
          code: text(row.code) || "OTHER",
          fallbackLabel: text(row.label),
          minor: Math.round(Number(row.minor) || 0),
          free: row.free === true,
        }));

  const lineItemsMinor = rows.reduce((sum, row) => sum + row.minor, 0);
  const snapshot = resolveBookingFinancialSnapshot(order);

  // The rate is per company and never assumed. A priced order keeps the rate
  // captured when it was priced; an unpriced request shows the rate that would
  // apply to it, resolved from the company's contract.
  const feeBps = resolveDisplayFeeBps(order, snapshot, opts);
  const feePercentLabel = formatMarketplaceFeePercent(feeBps);

  const paidToRovaroMinor = Math.round(Number(snapshot.bookingFeeMinor) || 0);
  const payableToSupplierMinor = Math.round(
    Number(snapshot.supplierBalanceMinor) || 0
  );
  const grossMinor = Math.round(Number(snapshot.grossMinor) || 0);

  // The three invariants that make the owner's 265-vs-165 screenshot
  // impossible: the line items must add up, the headline figure stored on the
  // order must be the same number, and the split must exhaust the gross.
  const headlineMinor = storedHeadlineMinor(order);
  const lineItemsSum = lineItemsMinor === storedTotalMinor;
  const headlineAgrees = headlineMinor == null || headlineMinor === storedTotalMinor;
  const splitSums =
    grossMinor === 0 || paidToRovaroMinor + payableToSupplierMinor === grossMinor;

  let invariant = FINANCIAL_INVARIANT.OK;
  if (!lineItemsSum) invariant = FINANCIAL_INVARIANT.LINE_ITEMS_DO_NOT_SUM;
  else if (!headlineAgrees) invariant = FINANCIAL_INVARIANT.HEADER_CONTRADICTS_BREAKDOWN;
  else if (!splitSums) invariant = FINANCIAL_INVARIANT.SPLIT_DOES_NOT_SUM;

  const consistent = invariant === FINANCIAL_INVARIANT.OK;
  // When the persisted numbers disagree, the line items are what the modal
  // shows. The contradicting header number is kept only for the superadmin
  // warning and is never rendered as a price.
  const totalRentalPriceMinor = lineItemsSum ? storedTotalMinor : lineItemsMinor;
  const contradictingStoredTotalMinor = lineItemsSum
    ? headlineAgrees
      ? null
      : headlineMinor
    : storedTotalMinor;

  return {
    currency: text(reconciliation.currency) || "EUR",
    lineItems: rows,
    lineItemsMinor,
    totalRentalPriceMinor,
    totalRentalPrice: minorToMajor(totalRentalPriceMinor),
    paidToRovaroMinor,
    payableToSupplierMinor,
    payableToSupplier: minorToMajor(payableToSupplierMinor),
    feeBps,
    feePercentLabel,
    snapshotSource: snapshot.source,
    invariant,
    invariantOk: consistent,
    /**
     * The split is derived from the same gross the line items contradict, so
     * rendering it while the invariant is broken would put a second wrong
     * total in front of the supplier.
     */
    splitRenderable: consistent && grossMinor > 0,
    /**
     * Only ever read by the superadmin data warning. Rendering this next to
     * `totalRentalPriceMinor` would reintroduce the contradiction.
     */
    contradictingStoredTotalMinor,
    differenceMinor:
      (contradictingStoredTotalMinor ?? totalRentalPriceMinor) -
      totalRentalPriceMinor,
  };
}

function vehicleView(order) {
  const car = order?.car && typeof order.car === "object" ? order.car : null;
  return {
    requested:
      text(order?.carModel) || text(car?.model) || text(order?.regNumber),
    registration: text(order?.regNumber) || text(car?.regNumber),
    class: text(order?.carCategory || car?.category || car?.carClass),
    transmission: text(order?.transmission || car?.transmission),
    seats: Number(order?.seats ?? car?.seats) || null,
    luggage: Number(order?.luggage ?? car?.luggage) || null,
    fuel: text(order?.fuel || car?.fuel || car?.fuelType || car?.energyType),
  };
}

function datesView(order, financial) {
  const deliveryMinor = (financial?.lineItems || [])
    .filter((row) => row.code.startsWith("PICKUP") || row.code.startsWith("RETURN"))
    .reduce((sum, row) => sum + row.minor, 0);
  return {
    pickupAt: order?.pickupAtUtc || order?.timeIn || order?.rentalStartDate || null,
    returnAt: order?.returnAtUtc || order?.timeOut || order?.rentalEndDate || null,
    days: Number(order?.numberOfDays) || 0,
    pickupLocation: text(order?.placeIn),
    pickupDetail: text(order?.placeInDetail),
    returnLocation: text(order?.placeOut),
    returnDetail: text(order?.placeOutDetail),
    flightNumber: text(order?.flightNumber),
    deliveryMinor,
  };
}

function optionsView(order) {
  return {
    insurance: text(order?.insurance) || "TPL",
    franchise: Number(order?.franchiseOrder) || 0,
    childSeats: Number(order?.ChildSeats) || 0,
    secondDriver: order?.secondDriver === true,
  };
}

function customerView(order, capabilities) {
  const visible = hasBookingCapability(
    capabilities,
    BOOKING_CAPABILITY.VIEW_CUSTOMER_CONTACTS
  );
  if (!visible) return { visible: false };
  return {
    visible: true,
    name: text(order?.customerName),
    phone: text(order?.phone),
    email: text(order?.email),
    messengers: {
      viber: order?.Viber === true,
      whatsapp: order?.Whatsapp === true,
      telegram: order?.Telegram === true,
    },
    notes: text(order?.customerNotes || order?.comment),
  };
}

function documentsView(order, capabilities) {
  const visible = hasBookingCapability(
    capabilities,
    BOOKING_CAPABILITY.VIEW_DRIVING_DOCUMENTS
  );
  const uploaded =
    order?.hasDrivingLicence === true ||
    (Array.isArray(order?.drivingLicenceUrls) && order.drivingLicenceUrls.length > 0);
  return { visible, uploaded };
}

function replacementView(order) {
  const proposal = order?.pendingReplacementProposal || null;
  if (!proposal?.checksum) return null;
  return {
    checksum: text(proposal.checksum),
    version: Number(proposal.version) || 1,
    original: proposal.originalVehicle || null,
    replacement: proposal.replacement || null,
    supplierMessage: text(proposal.supplierMessage),
    createdAt: proposal.createdAt || null,
  };
}

/**
 * Sections A–I of the canonical modal, already filtered by capability.
 *
 * @param {{ order: object, capabilities: object, priceBreakdown?: object }} input
 */
export function buildBookingDetailsView({
  order,
  capabilities,
  priceBreakdown,
  company,
  platformSettings,
} = {}) {
  if (!order || !hasBookingCapability(capabilities, BOOKING_CAPABILITY.VIEW_BOOKING)) {
    return null;
  }
  const source = resolveBookingSource(order) || BOOKING_SOURCE.PLATFORM;
  const stage = isInternalBooking(order)
    ? null
    : resolvePlatformWorkflowStage(order) ||
      PLATFORM_WORKFLOW_STAGE.AWAITING_SUPPLIER_CONFIRMATION;
  const financial = buildBookingFinancialView(order, {
    priceBreakdown,
    company,
    platformSettings,
  });

  return {
    id: text(order?._id),
    reference: bookingDisplayReference(order),
    source,
    stage,
    vehicle: vehicleView(order),
    dates: datesView(order, financial),
    options: optionsView(order),
    financial,
    customer: customerView(order, capabilities),
    documents: documentsView(order, capabilities),
    replacement: replacementView(order),
    hasProblem: order?.hasProblem === true || Boolean(order?.problemReportedAt),
    /**
     * A booking whose own numbers contradict each other must not be amended
     * until the data is repaired, whatever the actor's role.
     */
    moneyActionsDisabled: !financial.invariantOk,
  };
}

/**
 * The actions the sticky footer may render, in display order. Derived from the
 * capabilities alone, so the footer can never offer something the API refuses.
 */
export function bookingDetailsActions(capabilities, view) {
  const can = (capability) => hasBookingCapability(capabilities, capability);
  const primary = [];
  const secondary = [];

  if (can(BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE)) {
    primary.push(BOOKING_CAPABILITY.CONFIRM_REQUESTED_VEHICLE);
  }
  if (can(BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT)) {
    primary.push(BOOKING_CAPABILITY.OFFER_EQUIVALENT_REPLACEMENT);
  }
  if (can(BOOKING_CAPABILITY.DECLINE_REQUEST)) {
    primary.push(BOOKING_CAPABILITY.DECLINE_REQUEST);
  }
  if (can(BOOKING_CAPABILITY.CONTACT_CUSTOMER)) {
    primary.push(BOOKING_CAPABILITY.CONTACT_CUSTOMER);
  }
  if (can(BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING) && !view?.moneyActionsDisabled) {
    primary.push(BOOKING_CAPABILITY.AMEND_PLATFORM_BOOKING);
  }
  if (can(BOOKING_CAPABILITY.CONTACT_ROVARO)) {
    secondary.push(BOOKING_CAPABILITY.CONTACT_ROVARO);
  }
  if (can(BOOKING_CAPABILITY.REPORT_PROBLEM)) {
    secondary.push(BOOKING_CAPABILITY.REPORT_PROBLEM);
  }

  return { primary, secondary };
}
