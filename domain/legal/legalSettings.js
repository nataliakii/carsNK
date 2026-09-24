/**
 * Commercial and operational parameters referenced by the Rovaro legal
 * documents and by the booking workflow.
 *
 * Two different kinds of value live here:
 *
 *   Operational deadlines  — process parameters (response times, expirations).
 *                            They ship with documented proposed defaults that
 *                            superadmin can change. They are not legal facts.
 *
 *   Commercial amounts     — supplier cancellation service charge and
 *                            replacement cost cap. These have NO default.
 *                            Until superadmin sets them the documents say the
 *                            amount is the one set out in the fee schedule
 *                            notified to the Supplier, and the superadmin
 *                            Legal Configuration panel reports them as Missing.
 *
 * The documented default Spain marketplace Booking Fee is 10% (1000 bps).
 * Per-company overrides live on `company.marketplaceBookingFeeBps`.
 * Legal documents must not state that the fee is always 10%: the applicable
 * percentage is displayed to the Customer before payment and recorded in the
 * booking confirmation. BOOKING_PREPAYMENT_PERCENT remains the documented
 * default token only.
 */

/** Documented default: customer prepays this share of the total to Rovaro. */
export const BOOKING_PREPAYMENT_PERCENT = 10;

/** Remaining share the customer pays the Supplier at handover. */
export const SUPPLIER_BALANCE_PERCENT = 100 - BOOKING_PREPAYMENT_PERCENT;

/** Booking-record retention window expressed in years (legal copy). */
export const BOOKING_RETENTION_YEARS = 7;

/** Calendar-day equivalent of {@link BOOKING_RETENTION_YEARS}. */
export const BOOKING_RETENTION_DAYS = BOOKING_RETENTION_YEARS * 365;

/**
 * Proposed operational deadlines. Editable by superadmin; stored on
 * PlatformSettings.legal.
 */
export const DEFAULT_OPERATIONAL_DEADLINES = Object.freeze({
  /** Partner must answer a standard booking request within this many hours. */
  standardRequestResponseHours: 12,
  /** Same-day / near-term requests. */
  urgentRequestResponseMinutes: 60,
  /** Stripe Checkout link validity for the booking prepayment. */
  paymentLinkExpirationMinutes: 60,
  /** Partner must notify a replacement at least this long before pickup. */
  replacementNotificationHours: 24,
  /**
   * Supplier must answer a customer complaint forwarded by the Operator.
   * Distinct from partnerAppealResponseHours (Operator reviewing a Supplier appeal).
   */
  customerComplaintForwardResponseHours: 48,
  /**
   * Operator must communicate an outcome on a Supplier appeal / complaint
   * about an Operator decision (listing hide, suspension, service charge…).
   */
  partnerAppealResponseHours: 48,
  /** Rovaro answers a customer complaint sent to the platform. */
  customerComplaintResponseHours: 48,
  /** Accident / inability to hand over / insurance dispute reporting. */
  incidentReportingHours: 24,
  /** Alternative-vehicle offer validity shown to the customer. */
  alternativeOfferExpirationHours: 24,
  /** Partner booking-confirmation link validity. */
  confirmationTokenExpirationHours: 48,
  /** Target working days to process an approved refund. */
  refundProcessingDays: 14,
  /** Automatic deletion of driving licence images after rental end. */
  documentRetentionDays: 90,
  /** Booking records retention (accounting / dispute window). */
  bookingRetentionDays: BOOKING_RETENTION_DAYS,
});

export const OPERATIONAL_DEADLINE_KEYS = Object.freeze(
  Object.keys(DEFAULT_OPERATIONAL_DEADLINES)
);

/**
 * Parameters of the automatic driving-licence deletion job.
 *
 * These are runtime knobs, not promises made to anyone, so they are kept out
 * of OPERATIONAL_DEADLINE_KEYS and never become `{{settings.*}}` tokens. They
 * are still superadmin-editable through the same Legal Configuration panel.
 * `documentRetentionDays` itself stays with the deadlines: it IS quoted in the
 * privacy policy.
 */
export const DEFAULT_RETENTION_JOB_SETTINGS = Object.freeze({
  /** Orders examined per page. */
  documentRetentionBatchSize: 100,
  /** Pages per invocation, so a single serverless run always terminates. */
  documentRetentionMaxBatches: 20,
});

export const RETENTION_JOB_SETTING_KEYS = Object.freeze(
  Object.keys(DEFAULT_RETENTION_JOB_SETTINGS)
);

/**
 * Commercial amounts with no safe default.
 * `null` means "not configured" — never treat it as zero.
 */
export const COMMERCIAL_AMOUNT_KEYS = Object.freeze([
  "supplierCancellationServiceCharge",
  "replacementCostDifferenceCap",
]);

/** Who bears Stripe processing fees. Marketplace: always the platform. */
export const PAYMENT_FEE_BEARER = Object.freeze({
  PLATFORM: "platform",
  SUPPLIER: "supplier",
  SHARED: "shared",
});

/** VAT handling of the Rovaro commission. Configurable. */
export const VAT_TREATMENT = Object.freeze({
  NOT_CONFIGURED: "not_configured",
  OUT_OF_SCOPE: "out_of_scope",
  REVERSE_CHARGE: "reverse_charge",
  IRISH_VAT: "irish_vat",
});

export const DEFAULT_LEGAL_SETTINGS = Object.freeze({
  ...DEFAULT_OPERATIONAL_DEADLINES,
  ...DEFAULT_RETENTION_JOB_SETTINGS,
  supplierCancellationServiceCharge: null,
  replacementCostDifferenceCap: null,
  commissionCurrency: "EUR",
  paymentFeeBearer: PAYMENT_FEE_BEARER.PLATFORM,
  vatTreatment: VAT_TREATMENT.NOT_CONFIGURED,
  esignProvider: "clickwrap",
});

function positiveNumberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function positiveIntOr(value, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Merge stored settings over the defaults.
 * @param {object|null|undefined} stored PlatformSettings.legal
 */
export function resolveLegalSettings(stored) {
  const raw = stored && typeof stored === "object" ? stored : {};

  const deadlines = {};
  for (const key of OPERATIONAL_DEADLINE_KEYS) {
    deadlines[key] = positiveNumberOr(
      raw[key],
      DEFAULT_OPERATIONAL_DEADLINES[key]
    );
  }

  // Legacy: one partnerComplaintResponseHours powered two different SLAs.
  const legacyPartnerComplaint = positiveNumberOr(
    raw.partnerComplaintResponseHours,
    NaN
  );
  if (Number.isFinite(legacyPartnerComplaint)) {
    if (raw.customerComplaintForwardResponseHours == null) {
      deadlines.customerComplaintForwardResponseHours = legacyPartnerComplaint;
    }
    if (raw.partnerAppealResponseHours == null) {
      deadlines.partnerAppealResponseHours = legacyPartnerComplaint;
    }
  }

  const retentionJob = {};
  for (const key of RETENTION_JOB_SETTING_KEYS) {
    retentionJob[key] = positiveIntOr(
      raw[key],
      DEFAULT_RETENTION_JOB_SETTINGS[key]
    );
  }

  return {
    ...deadlines,
    ...retentionJob,
    supplierCancellationServiceCharge: nullableNumber(
      raw.supplierCancellationServiceCharge
    ),
    replacementCostDifferenceCap: nullableNumber(
      raw.replacementCostDifferenceCap
    ),
    commissionCurrency:
      String(raw.commissionCurrency || "EUR").toUpperCase() || "EUR",
    paymentFeeBearer: PAYMENT_FEE_BEARER.PLATFORM,
    vatTreatment: Object.values(VAT_TREATMENT).includes(raw.vatTreatment)
      ? raw.vatTreatment
      : VAT_TREATMENT.NOT_CONFIGURED,
    esignProvider: String(raw.esignProvider || "clickwrap"),
    bookingPrepaymentPercent: BOOKING_PREPAYMENT_PERCENT,
    supplierBalancePercent: SUPPLIER_BALANCE_PERCENT,
    /** Editable My business details (Platform settings). */
    businessProfile:
      raw.businessProfile && typeof raw.businessProfile === "object"
        ? raw.businessProfile
        : null,
  };
}

/**
 * Wording used when a commercial amount has not been configured yet.
 * Deliberately states where the number lives instead of inventing one.
 */
export const UNCONFIGURED_AMOUNT_TEXT =
  "as set out in the Rovaro fee schedule notified to the Supplier in writing";

const UNCONFIGURED_AMOUNT_TEXT_ES =
  "según el cuadro de tarifas de Rovaro notificado por escrito al Proveedor";

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined) return null;
  return `${currency} ${Number(amount).toFixed(2)}`;
}

/**
 * Token values for `{{settings.*}}` placeholders inside legal documents.
 *
 * @param {ReturnType<typeof resolveLegalSettings>} settings
 * @param {{ language?: string }} [opts]
 */
export function buildLegalSettingsTokens(settings, { language = "en" } = {}) {
  const unconfigured =
    language === "es" ? UNCONFIGURED_AMOUNT_TEXT_ES : UNCONFIGURED_AMOUNT_TEXT;
  const currency = settings.commissionCurrency || "EUR";

  const tokens = {};
  for (const key of OPERATIONAL_DEADLINE_KEYS) {
    tokens[key] = settings[key];
  }

  tokens.supplierCancellationServiceCharge =
    formatMoney(settings.supplierCancellationServiceCharge, currency) ??
    unconfigured;
  tokens.replacementCostDifferenceCap =
    formatMoney(settings.replacementCostDifferenceCap, currency) ??
    unconfigured;
  tokens.bookingPrepaymentPercent = `${BOOKING_PREPAYMENT_PERCENT}%`;
  tokens.supplierBalancePercent = `${SUPPLIER_BALANCE_PERCENT}%`;
  tokens.bookingRetentionYears = Math.max(
    1,
    Math.round(Number(settings.bookingRetentionDays) / 365) ||
      BOOKING_RETENTION_YEARS
  );
  tokens.bookingFeeDisplayNote =
    language === "es"
      ? "El porcentaje aplicable de la Tasa de Reserva Rovaro se muestra al Cliente antes del pago y queda registrado en la confirmación de la reserva."
      : "The applicable Rovaro Booking Fee percentage is displayed to the Customer before payment and recorded in the booking confirmation.";

  if (settings.businessProfile && typeof settings.businessProfile === "object") {
    tokens.businessProfile = settings.businessProfile;
  }

  return tokens;
}

/**
 * Commercial amounts that superadmin still has to fill in.
 * Surfaced only in the superadmin Legal Configuration panel.
 */
export function getMissingCommercialSettings(settings) {
  return COMMERCIAL_AMOUNT_KEYS.filter((key) => settings[key] === null);
}
