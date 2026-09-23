import mongoose from "mongoose";

import {
  ALL_PARTNER_VERIFICATION_STATUSES,
  PARTNER_VERIFICATION_STATUS,
} from "@/domain/legal/partnerVerification";

/**
 * Legal / KYB profile of a partner supplier.
 *
 * Kept in its own collection rather than on `Company` so that onboarding data
 * and verification state evolve independently of the operational fleet
 * document, and so that no legal identifier is accidentally serialised into a
 * public storefront payload.
 *
 * Nothing here is ever auto-filled. Empty means "the partner has not supplied
 * it yet" and blocks verification.
 */
const uploadedDocumentSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true },
    label: { type: String, default: "" },
    /** Storage reference (Cloudinary public id). Never a public URL. */
    storageRef: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedByUserId: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewedByEmail: { type: String, default: "" },
    accepted: { type: Boolean, default: false },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, default: "" },
    to: { type: String, required: true },
    at: { type: Date, default: Date.now },
    byEmail: { type: String, default: "" },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

const partnerLegalProfileSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },

    // ── Identity the supplier must provide and keep current ──────────────
    legalName: { type: String, default: "", trim: true },
    tradingName: { type: String, default: "", trim: true },
    /** sl | sa | autonomo | other — free text, supplier-declared. */
    entityType: { type: String, default: "", trim: true },
    countryOfRegistration: { type: String, default: "", uppercase: true, trim: true },
    registrationNumber: { type: String, default: "", trim: true },
    /** Spanish tax identifier. */
    nifCif: { type: String, default: "", trim: true },
    vatNumber: { type: String, default: "", trim: true },
    registeredAddress: { type: String, default: "", trim: true },
    businessAddress: { type: String, default: "", trim: true },

    // ── Signatory ────────────────────────────────────────────────────────
    signatoryName: { type: String, default: "", trim: true },
    signatoryRole: { type: String, default: "", trim: true },
    /** Supplier's own confirmation that the signatory may bind the company. */
    signatoryAuthorityConfirmed: { type: Boolean, default: false },
    signatoryAuthorityBasis: { type: String, default: "", trim: true },

    // ── Contact & payout ─────────────────────────────────────────────────
    businessEmail: { type: String, default: "", trim: true, lowercase: true },
    businessPhone: { type: String, default: "", trim: true },
    emergencyPhone: { type: String, default: "", trim: true },
    /** Stored masked; full details are handled outside the app. */
    payoutAccountReference: { type: String, default: "", trim: true },

    // ── Licences & insurance ─────────────────────────────────────────────
    licences: { type: [String], default: [] },
    insuranceProvider: { type: String, default: "", trim: true },
    insurancePolicyReference: { type: String, default: "", trim: true },
    insuranceValidUntil: { type: Date, default: null },
    /** Supplier declares it owns or is authorised to rent the listed vehicles. */
    vehicleAuthorityConfirmed: { type: Boolean, default: false },

    documents: { type: [uploadedDocumentSchema], default: [] },

    // ── Verification ─────────────────────────────────────────────────────
    verificationStatus: {
      type: String,
      enum: ALL_PARTNER_VERIFICATION_STATUSES,
      default: PARTNER_VERIFICATION_STATUS.DRAFT,
      index: true,
    },
    verificationStatusAt: { type: Date, default: Date.now },
    /** Set once when the partner explicitly submits for review. */
    submittedAt: { type: Date, default: null },
    verifiedByEmail: { type: String, default: "" },
    verificationNote: { type: String, default: "" },
    suspensionReason: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true, collection: "partner_legal_profiles" }
);

const PartnerLegalProfile =
  mongoose.models?.PartnerLegalProfile ||
  mongoose.model("PartnerLegalProfile", partnerLegalProfileSchema);

export default PartnerLegalProfile;
