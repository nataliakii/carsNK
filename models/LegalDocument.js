import mongoose from "mongoose";

import {
  ALL_LEGAL_DOCUMENT_TYPES,
  ALL_LEGAL_DOCUMENT_STATUSES,
  LEGAL_DOCUMENT_STATUS,
  LEGAL_LANGUAGES,
  LEGAL_PLATFORM,
} from "@/domain/legal/documentTypes";

/**
 * Versioned, platform-scoped legal document.
 *
 * Isolation: every row carries `platform`. Rovaro reads and writes only
 * `platform: "rovaro"`. Documents belonging to other projects that share
 * infrastructure (BBQR and others) live under their own platform scope and are
 * never selected, updated or deleted by this application.
 *
 * Immutability: a published document is never edited in place. Changing the
 * text means inserting a new (documentType, language, jurisdiction, version+1)
 * row; the previous row is archived. That keeps every accepted agreement
 * resolvable by its exact version + checksum.
 */
const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    heading: { type: String, default: "" },
    body: { type: String, default: "" },
    /** Configurable legal values this section depends on. */
    requires: { type: [String], default: [] },
  },
  { _id: false }
);

const versionHistorySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    checksum: { type: String, required: true },
    status: { type: String, required: true },
    effectiveFrom: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    changedAt: { type: Date, default: Date.now },
    changedByEmail: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const legalDocumentSchema = new mongoose.Schema(
  {
    /** Tenant / platform scope. Never query without it. */
    platform: {
      type: String,
      required: true,
      default: LEGAL_PLATFORM,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: ALL_LEGAL_DOCUMENT_TYPES,
      index: true,
    },
    language: {
      type: String,
      required: true,
      enum: LEGAL_LANGUAGES,
    },
    jurisdiction: { type: String, required: true, default: "EU" },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ALL_LEGAL_DOCUMENT_STATUSES,
      default: LEGAL_DOCUMENT_STATUS.DRAFT,
      index: true,
    },
    effectiveFrom: { type: Date, default: null },
    /** sha256 over the canonical content payload. */
    checksum: { type: String, required: true, index: true },
    content: {
      title: { type: String, default: "" },
      sections: { type: [sectionSchema], default: [] },
    },
    /** DynamoDB-compatible composite key, also unique in Mongo. */
    pk: { type: String, required: true, index: true },
    sk: { type: String, required: true },
    publishedAt: { type: Date, default: null },
    publishedByEmail: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
    /** Append-only status/version trail. */
    history: { type: [versionHistorySchema], default: [] },
  },
  { timestamps: true, collection: "legal_documents" }
);

legalDocumentSchema.index({ pk: 1, sk: 1 }, { unique: true });
legalDocumentSchema.index({
  platform: 1,
  documentType: 1,
  language: 1,
  status: 1,
});

const LegalDocument =
  mongoose.models?.LegalDocument ||
  mongoose.model("LegalDocument", legalDocumentSchema);

export default LegalDocument;
