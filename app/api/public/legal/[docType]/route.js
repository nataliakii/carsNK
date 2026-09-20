import { NextResponse } from "next/server";

import {
  isKnownDocumentType,
  getDocumentAudience,
  LEGAL_DOCUMENT_AUDIENCE,
  normalizeLegalLanguage,
} from "@/domain/legal/documentTypes";
import { resolveDocumentForDisplay } from "@/domain/legal/documentService";
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
    const [{ doc, source, fellBackToEnglish }, { tokens }] = await Promise.all([
      resolveDocumentForDisplay({ documentType: docType, language }),
      loadLegalSettingsWithTokens({ language }),
    ]);

    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Document not available" },
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
      /** "draft" means nothing is published yet — the UI labels it. */
      source,
      fellBackToEnglish,
      content: rendered,
    });
  } catch (err) {
    console.error("[public legal]", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Failed to load document" },
      { status: 500 }
    );
  }
}
