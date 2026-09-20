import mongoose from "mongoose";

import { LEGAL_PLATFORM } from "@/domain/legal/documentTypes";

/**
 * Immutable record of a partner accepting the Master Partner Agreement
 * package (agreement + operating rules + data protection schedule).
 *
 * Nothing in this collection may be edited after creation — not even by a
 * superadmin. Correcting a mistake means recording a new acceptance of a new
 * version. The pre-update hooks below enforce that at the model level.
 */
const documentRefSchema = new mongoose.Schema(
  {
    documentType: { type: String, required: true },
    language: { type: String, required: true },
    jurisdiction: { type: String, required: true },
    version: { type: Number, required: true },
    checksum: { type: String, required: true },
    /** Composite storage key of the exact row that was accepted. */
    pk: { type: String, required: true },
    sk: { type: String, required: true },
    /** Rendered text exactly as displayed to the signer. */
    renderedTitle: { type: String, default: "" },
    renderedSections: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, default: "" },
            heading: { type: String, default: "" },
            text: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const partnerAgreementAcceptanceSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, default: LEGAL_PLATFORM, index: true },

    /** Stable public identifier of this agreement instance. */
    agreementId: { type: String, required: true, unique: true, index: true },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    /** Partner legal name captured at acceptance time (not a live join). */
    partnerLegalName: { type: String, required: true },
    partnerTradingName: { type: String, default: "" },
    partnerRegistrationNumber: { type: String, default: "" },
    partnerNifCif: { type: String, default: "" },

    signerName: { type: String, required: true },
    signerRole: { type: String, required: true },
    signerEmail: { type: String, required: true },
    /** Explicit confirmation that the signer may bind the partner. */
    confirmationOfAuthority: { type: Boolean, required: true },
    authorityStatement: { type: String, default: "" },

    /** Each document in the accepted package, with its own checksum. */
    documents: { type: [documentRefSchema], required: true },
    /** sha256 over the whole immutable snapshot. */
    packageChecksum: { type: String, required: true, index: true },

    acceptanceMethod: {
      type: String,
      enum: ["manual", "clickwrap", "external_esign"],
      required: true,
    },
    esignProvider: { type: String, default: "" },
    esignEnvelopeId: { type: String, default: "" },
    esignStatus: { type: String, default: "" },

    acceptedAt: { type: Date, required: true },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    authenticatedUserId: { type: String, default: "" },

    /** Operator legal identity as published at acceptance time. */
    operatorSnapshot: {
      ownerLegalName: { type: String, default: "" },
      tradingName: { type: String, default: "" },
      countryOfEstablishment: { type: String, default: "" },
      platformBrand: { type: String, default: "" },
      legalEmail: { type: String, default: "" },
      businessAddress: { type: String, default: "" },
      businessNameNumber: { type: String, default: "" },
    },
    /** Commercial parameters in force at acceptance time. */
    settingsSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },

    /** Set when the agreement stops being the active one. Never deletes. */
    supersededAt: { type: Date, default: null },
    supersededByAgreementId: { type: String, default: "" },
    terminatedAt: { type: Date, default: null },
    terminationReason: { type: String, default: "" },
    copySentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "partner_agreement_acceptances" }
);

partnerAgreementAcceptanceSchema.index({ companyId: 1, acceptedAt: -1 });

/**
 * Fields an administrator may still change after the fact. Everything else is
 * frozen. `supersededAt` / `terminatedAt` are lifecycle markers, not edits to
 * what was signed.
 */
export const MUTABLE_AFTER_SIGNING = new Set([
  "supersededAt",
  "supersededByAgreementId",
  "terminatedAt",
  "terminationReason",
  "copySentAt",
  "esignStatus",
  "esignEnvelopeId",
  "updatedAt",
]);

export function assertOnlyLifecycleFields(update) {
  const paths = new Set();
  for (const [operator, payload] of Object.entries(update || {})) {
    if (!operator.startsWith("$")) {
      paths.add(operator);
      continue;
    }
    for (const key of Object.keys(payload || {})) paths.add(key);
  }
  const illegal = [...paths].filter((key) => !MUTABLE_AFTER_SIGNING.has(key));
  if (illegal.length) {
    throw new Error(
      `Signed partner agreement is immutable; refused to modify: ${illegal.join(", ")}`
    );
  }
}

partnerAgreementAcceptanceSchema.pre("findOneAndUpdate", function guard(next) {
  try {
    assertOnlyLifecycleFields(this.getUpdate());
    next();
  } catch (err) {
    next(err);
  }
});

partnerAgreementAcceptanceSchema.pre("updateOne", function guard(next) {
  try {
    assertOnlyLifecycleFields(this.getUpdate());
    next();
  } catch (err) {
    next(err);
  }
});

partnerAgreementAcceptanceSchema.pre("save", function guard(next) {
  if (this.isNew) return next();
  const illegal = this.modifiedPaths().filter(
    (path) => !MUTABLE_AFTER_SIGNING.has(path)
  );
  if (illegal.length) {
    return next(
      new Error(
        `Signed partner agreement is immutable; refused to modify: ${illegal.join(", ")}`
      )
    );
  }
  return next();
});

const PartnerAgreementAcceptance =
  mongoose.models?.PartnerAgreementAcceptance ||
  mongoose.model(
    "PartnerAgreementAcceptance",
    partnerAgreementAcceptanceSchema
  );

export default PartnerAgreementAcceptance;
