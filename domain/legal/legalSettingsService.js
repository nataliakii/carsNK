/**
 * Server-side access to the legal / commercial settings stored on
 * PlatformSettings.legal.
 *
 * Never call from a client component: the resolved object feeds legal
 * documents and the booking workflow, and must stay server-authoritative.
 */

import { connectToDB } from "@lib/database";
import { getOrCreatePlatformSettings } from "@/domain/platform/platformSettingsService";

import {
  resolveLegalSettings,
  buildLegalSettingsTokens,
  getMissingCommercialSettings,
  DEFAULT_LEGAL_SETTINGS,
  OPERATIONAL_DEADLINE_KEYS,
  RETENTION_JOB_SETTING_KEYS,
  COMMERCIAL_AMOUNT_KEYS,
  COMMISSION_BASE_KEYS,
  PAYMENT_FEE_BEARER,
  VAT_TREATMENT,
} from "./legalSettings";
import { ALL_ESIGN_MODES } from "./esign";

/** @returns {Promise<ReturnType<typeof resolveLegalSettings>>} */
export async function loadLegalSettings() {
  await connectToDB();
  const doc = await getOrCreatePlatformSettings();
  return resolveLegalSettings(doc?.legal);
}

/**
 * Resolved settings plus the `{{settings.*}}` token map for document render.
 * @param {{ language?: string }} [opts]
 */
export async function loadLegalSettingsWithTokens({ language = "en" } = {}) {
  const settings = await loadLegalSettings();
  return {
    settings,
    tokens: buildLegalSettingsTokens(settings, { language }),
  };
}

function sanitizeNullableNumber(value) {
  if (value === null || value === "" || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Apply a superadmin patch. Unknown keys are ignored; commercial amounts may
 * be explicitly cleared back to null.
 *
 * @param {object} patch
 * @returns {Promise<ReturnType<typeof resolveLegalSettings>>}
 */
export async function updateLegalSettings(patch = {}) {
  await connectToDB();
  const doc = await getOrCreatePlatformSettings();
  const current = { ...(doc.legal && typeof doc.legal === "object" ? doc.legal : {}) };

  for (const key of [
    ...OPERATIONAL_DEADLINE_KEYS,
    ...RETENTION_JOB_SETTING_KEYS,
  ]) {
    if (!(key in patch)) continue;
    const n = sanitizeNullableNumber(patch[key]);
    if (n === null) delete current[key];
    else current[key] = n;
  }

  for (const key of COMMERCIAL_AMOUNT_KEYS) {
    if (!(key in patch)) continue;
    current[key] = sanitizeNullableNumber(patch[key]);
  }

  if (patch.commissionCurrency) {
    current.commissionCurrency = String(patch.commissionCurrency)
      .toUpperCase()
      .slice(0, 3);
  }

  if (patch.commissionBase && typeof patch.commissionBase === "object") {
    current.commissionBase = { ...(current.commissionBase || {}) };
    for (const key of COMMISSION_BASE_KEYS) {
      if (key in patch.commissionBase) {
        current.commissionBase[key] = Boolean(patch.commissionBase[key]);
      }
    }
  }

  if (Object.values(PAYMENT_FEE_BEARER).includes(patch.paymentFeeBearer)) {
    current.paymentFeeBearer = patch.paymentFeeBearer;
  }
  if (Object.values(VAT_TREATMENT).includes(patch.vatTreatment)) {
    current.vatTreatment = patch.vatTreatment;
  }
  if (ALL_ESIGN_MODES.includes(patch.esignProvider)) {
    current.esignProvider = patch.esignProvider;
  }

  doc.legal = current;
  doc.markModified("legal");
  await doc.save();

  return resolveLegalSettings(doc.legal);
}

/**
 * Settings-side half of the superadmin Legal Configuration Status panel.
 * Missing commercial amounts are reported here and nowhere else.
 */
export async function getLegalSettingsStatus() {
  const settings = await loadLegalSettings();
  const missingCommercial = getMissingCommercialSettings(settings);
  return {
    settings,
    defaults: DEFAULT_LEGAL_SETTINGS,
    missingCommercial,
    ok: missingCommercial.length === 0,
  };
}
