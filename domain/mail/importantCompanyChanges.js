/**
 * Classifies company field diffs into operationally important vs routine.
 * One summary email per request when any important field changes.
 */

/** Dot-paths (or top-level keys) that warrant a superadmin email. */
export const IMPORTANT_COMPANY_FIELDS = Object.freeze([
  "email",
  "tel",
  "name",
  "address",
  "country",
  "listedOnMarketplace",
  "storefrontEnabled",
  "prepaymentPercent",
  "rentalPayments",
  "rentalPayments.stripeEnabled",
  "rentalPayments.timing",
  "customerRentalTerms",
  "customerRentalTerms.sourceEn",
  "customerRentalTerms.sourceHash",
  "transferServices.payments",
  "transferServices.payments.stripeForPlatformFee",
  "transferServices.payments.stripeForCompanyAmount",
  "partnerLegalProfile.legalName",
  "partnerLegalProfile.tradingName",
  "partnerLegalProfile.taxId",
  "partnerLegalProfile.vatNumber",
  "partnerLegalProfile.companyNumber",
  "partnerLegalProfile.registeredAddress",
  "legalProfile.legalName",
  "legalProfile.tradingName",
  "legalProfile.taxId",
  "legalProfile.vatNumber",
  "legalProfile.companyNumber",
  "taxId",
  "vatNumber",
  "companyNumber",
  "legalName",
]);

/** Explicitly never email — display / cosmetic / preference noise. */
export const ROUTINE_COMPANY_FIELDS = Object.freeze([
  "langAdmin",
  "langSuperadmin",
  "slogan",
  "useEmail",
  "notificationPreferences",
  "emailPreferences",
  "notSendIP1",
  "notSendIP2",
  "notSendIP3",
  "notSendIP4",
  "coords",
  "defaultStart",
  "defaultEnd",
  "workingHours",
  "hoursDiffForStart",
  "hoursDiffForEnd",
  "bufferTime",
  "minRentalDuration",
  "useSeasons",
  "seasons",
  "meetingContactPhone",
  "meetingContactName",
  "meetingContactChannel",
  "meetingContacts",
  "slug",
  "cityIds",
  "orderRadiusKm",
  "deliveryPricePerKm",
  "deliveryPricing",
  "locations",
  "offices",
]);

const HUMAN_LABELS = Object.freeze({
  email: "Primary email",
  tel: "Primary phone",
  name: "Company name",
  address: "Address",
  country: "Country",
  listedOnMarketplace: "Marketplace listing",
  storefrontEnabled: "Storefront",
  prepaymentPercent: "Booking fee / prepayment %",
  "rentalPayments.stripeEnabled": "Stripe rental payments",
  "rentalPayments.timing": "Rental payment timing",
  "customerRentalTerms.sourceEn": "Company rental terms",
  "transferServices.payments.stripeForPlatformFee": "Transfer Stripe (platform fee)",
  "transferServices.payments.stripeForCompanyAmount": "Transfer Stripe (company amount)",
  "partnerLegalProfile.legalName": "Legal company name",
  "partnerLegalProfile.taxId": "Tax ID",
  "partnerLegalProfile.vatNumber": "VAT number",
  "legalProfile.legalName": "Legal company name",
  "legalProfile.taxId": "Tax ID",
  "legalProfile.vatNumber": "VAT number",
  taxId: "Tax ID",
  vatNumber: "VAT number",
  legalName: "Legal company name",
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeComparable(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value._bsontype === "ObjectId") return String(value);
  if (Array.isArray(value)) return value.map(normalizeComparable);
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = normalizeComparable(value[key]);
    }
    return out;
  }
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value);
}

function valuesEqual(a, b) {
  return JSON.stringify(normalizeComparable(a)) === JSON.stringify(normalizeComparable(b));
}

function getPath(obj, path) {
  if (!path) return obj;
  const parts = String(path).split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function formatDisplayValue(value) {
  if (value === undefined) return "(not set)";
  if (value === null || value === "") return "(empty)";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    try {
      return JSON.stringify(normalizeComparable(value));
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function isRoutinePath(path) {
  const p = String(path || "");
  return ROUTINE_COMPANY_FIELDS.some(
    (field) => p === field || p.startsWith(`${field}.`)
  );
}

function isImportantPath(path) {
  const p = String(path || "");
  if (isRoutinePath(p)) return false;
  return IMPORTANT_COMPANY_FIELDS.some(
    (field) => p === field || p.startsWith(`${field}.`) || field.startsWith(`${p}.`)
  );
}

/**
 * @param {object} previous
 * @param {object} nextOrUpdates - full next doc or patch of changed fields
 * @returns {{ important: boolean, changes: Array<{ field: string, label: string, previous: string, next: string }> }}
 */
export function classifyCompanySettingChanges(previous, nextOrUpdates) {
  const before = previous && typeof previous === "object" ? previous : {};
  const after = nextOrUpdates && typeof nextOrUpdates === "object" ? nextOrUpdates : {};
  const paths = new Set([
    ...IMPORTANT_COMPANY_FIELDS,
    ...Object.keys(after),
  ]);

  const changes = [];
  for (const path of paths) {
    if (isRoutinePath(path)) continue;
    if (!isImportantPath(path) && !IMPORTANT_COMPANY_FIELDS.includes(path)) continue;

    const prevVal = getPath(before, path);
    const nextVal =
      path.includes(".") || Object.prototype.hasOwnProperty.call(after, path.split(".")[0])
        ? getPath(
            // When `after` is a partial patch, merge shallowly for nested reads.
            path.includes(".")
              ? { ...before, ...after, ...(isPlainObject(after[path.split(".")[0]])
                  ? {
                      [path.split(".")[0]]: {
                        ...(getPath(before, path.split(".")[0]) || {}),
                        ...after[path.split(".")[0]],
                      },
                    }
                  : {}) }
              : { ...before, ...after },
            path
          )
        : getPath({ ...before, ...after }, path);

    // Only report when the patch actually touches this path or a parent key.
    const top = path.split(".")[0];
    if (!Object.prototype.hasOwnProperty.call(after, top) && !IMPORTANT_COMPANY_FIELDS.includes(path)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(after, top)) continue;
    if (valuesEqual(prevVal, nextVal)) continue;

    changes.push({
      field: path,
      label: HUMAN_LABELS[path] || path,
      previous: formatDisplayValue(prevVal),
      next: formatDisplayValue(nextVal),
    });
  }

  // Dedupe by field
  const seen = new Set();
  const unique = [];
  for (const row of changes) {
    if (seen.has(row.field)) continue;
    seen.add(row.field);
    unique.push(row);
  }

  return { important: unique.length > 0, changes: unique };
}

/** Material vehicle fields that affect bookings (superadmin notify). */
export const MATERIAL_CAR_FIELDS = Object.freeze([
  "isActive",
  "model",
  "class",
  "transmission",
  "seats",
  "deposit",
  "franchise",
  "PriceKacko",
  "pricingTiers",
  "regNumber",
  "offices",
  "officeIds",
  "officeScope",
]);

export function classifyCarMaterialChanges(previous, updates) {
  const before = previous || {};
  const after = updates || {};
  const changes = [];
  for (const field of MATERIAL_CAR_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(after, field)) continue;
    if (valuesEqual(before[field], after[field])) continue;
    changes.push({
      field,
      label: field,
      previous: formatDisplayValue(before[field]),
      next: formatDisplayValue(after[field]),
    });
  }
  return { important: changes.length > 0, changes };
}
