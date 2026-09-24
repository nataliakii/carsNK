import { NextResponse } from "next/server";

import {
  isKnownDocumentType,
  getDocumentAudience,
  LEGAL_DOCUMENT_AUDIENCE,
  normalizeLegalLanguage,
} from "@/domain/legal/documentTypes";
import { getPublishedDocument } from "@/domain/legal/documentService";
import { renderLegalDocument } from "@/domain/legal/tokens";
import { loadLegalSettingsWithTokens } from "@/domain/legal/legalSettingsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/legal/{docType}?lang=en
 *
 * Serves published Rovaro legal documents. Partner-only documents
 * (partner agreement, operating rules, data protection schedule) are not
 * exposed here — they live behind the authenticated partner area.
 *
 * Token substitution happens server-side, so no legal identifier and no
 * unconfigured placeholder ever reaches the browser: sections that depend on
 * a value that has not been confirmed are omitted entirely.
 *
 * Unpublished documents return 404 — public pages show a preparing message.
 * No authentication is required.
 */
export async function GET(request, { params }) {
  const { docType } = await params;

  if (!isKnownDocumentType(docType)) {
    return NextResponse.json(
      { success: false, message: "Unknown document" },
      { status: 404 }
    );
  }
  if (getDocumentAudience(docType) !== LEGAL_DOCUMENT_AUDIENCE.PUBLIC) {
    return NextResponse.json(
      { success: false, message: "This document is not publicly available" },
      { status: 403 }
    );
  }

  const language = normalizeLegalLanguage(
    request.nextUrl.searchParams.get("lang")
  );

  try {
    const [{ doc, fellBackToEnglish }, { tokens }] = await Promise.all([
      getPublishedDocument({ documentType: docType, language }),
      loadLegalSettingsWithTokens({ language }),
    ]);

    if (!doc) {
      return NextResponse.json(
        {
          success: false,
          code: "NOT_PUBLISHED",
          message: "Document not available",
        },
        { status: 404 }
      );
    }

    const rendered = renderLegalDocument(doc, { settings: tokens });

    return NextResponse.json({
      success: true,
      documentType: doc.documentType,
      language: doc.language,
      jurisdiction: doc.jurisdiction,
      version: doc.version,
      status: doc.status,
      checksum: doc.checksum,
      effectiveFrom: doc.effectiveFrom || null,
      source: "published",
      fellBackToEnglish,
      content: rendered,
    });
  } catch (err) {
    console.error("[public legal]", docType, language, err?.message || err);
    return NextResponse.json(
      { success: false, code: "LOAD_FAILED", message: "Failed to load document" },
      { status: 500 }
    );
  }
}
