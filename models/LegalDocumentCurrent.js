/**
 * Explicit "current published" pointer per documentType+language+jurisdiction.
 * Public pages should resolve this pointer, not "newest by createdAt".
 */

import mongoose from "mongoose";
import { LEGAL_PLATFORM } from "@/domain/legal/documentTypes";

const legalDocumentCurrentSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: true,
      default: LEGAL_PLATFORM,
      index: true,
    },
    documentType: { type: String, required: true, index: true },
    language: { type: String, required: true },
    jurisdiction: { type: String, required: true, default: "EU" },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "LegalDocument",
    },
    version: { type: Number, required: true, min: 1 },
    checksum: { type: String, required: true },
    publishedAt: { type: Date, default: null },
    publishedByEmail: { type: String, default: "" },
  },
  { timestamps: true, collection: "legal_document_current" }
);

legalDocumentCurrentSchema.index(
  { platform: 1, documentType: 1, language: 1, jurisdiction: 1 },
  { unique: true }
);

const LegalDocumentCurrent =
  mongoose.models?.LegalDocumentCurrent ||
  mongoose.model("LegalDocumentCurrent", legalDocumentCurrentSchema);

export default LegalDocumentCurrent;
