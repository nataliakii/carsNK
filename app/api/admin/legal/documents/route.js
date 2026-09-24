import { NextResponse } from "next/server";

import { requirePlatformAdmin, requireSuperAdmin } from "@lib/adminAuth";
import {
  listDocuments,
  syncSeedDocuments,
  publishDocument,
  archiveDocument,
  getDocumentStatusOverview,
  createDocumentVersion,
  createTranslationDraftVersion,
  saveDocumentDraft,
  getPublishedDocument,
} from "@/domain/legal/documentService";
import { findSuppressedSections } from "@/domain/legal/tokens";
import {
  isKnownDocumentType,
  LEGAL_AUTHORITATIVE_LANGUAGE,
} from "@/domain/legal/documentTypes";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import { reacceptanceRequired, PUBLICATION_CHANGE } from "@/domain/legal/publicationClass";
import { invalidateMarketplaceCheckoutsForOutdatedAgreements } from "@/domain/orders/invalidateMarketplaceCheckout";
import { importLegalFile } from "@/domain/legal/documentImport";
import { buildTranslationDraft, publicationBlockReason } from "@/domain/legal/translationAdapter";
import { auditLegalAction } from "@/domain/legal/contentSanitizer";
import { assertTranslationPublishable } from "@/domain/legal/translationWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin document registry.
 *
 * Only Rovaro-scoped documents are ever returned or modified — the service
 * layer filters every query by platform, so documents belonging to other
 * projects in a shared store cannot be listed, published or archived here.
 */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  const includeContent =
    request.nextUrl.searchParams.get("includeContent") === "1";
  const filterType = String(
    request.nextUrl.searchParams.get("documentType") || ""
  ).trim();
  const filterLang = String(
    request.nextUrl.searchParams.get("language") || ""
  ).trim();

  const rows = await listDocuments();
  const overview = await getDocumentStatusOverview();
  const filtered = rows.filter((doc) => {
    if (filterType && doc.documentType !== filterType) return false;
    if (filterLang && doc.language !== filterLang) return false;
    return true;
  });

  return NextResponse.json({
    success: true,
    overview,
    documents: filtered.map((doc) => ({
      platform: doc.platform,
      documentType: doc.documentType,
      language: doc.language,
      jurisdiction: doc.jurisdiction,
      version: doc.version,
      status: doc.status,
      checksum: doc.checksum,
      effectiveFrom: doc.effectiveFrom,
      publishedAt: doc.publishedAt,
      publishedByEmail: doc.publishedByEmail,
      archivedAt: doc.archivedAt,
      updatedAt: doc.updatedAt,
      sectionCount: doc.content?.sections?.length || 0,
      title: doc.content?.title || "",
      ...(includeContent ? { content: doc.content || { title: "", sections: [] } } : {}),
      /** Sections hidden from public output until config is complete. */
      suppressedSections: findSuppressedSections(doc),
      history: (doc.history || []).map((row) => ({
        version: row.version,
        status: row.status,
        changedAt: row.changedAt,
        note: row.note,
      })),
      format: doc.format || "sections",
      translationStatus: doc.translationStatus || "",
      sourceChecksum: doc.sourceChecksum || "",
      pdf: doc.pdfFile?.filename
        ? { filename: doc.pdfFile.filename, size: doc.pdfFile.size, extractionComplete: doc.pdfFile.extractionComplete }
        : null,
      pk: doc.pk,
      sk: doc.sk,
    })),
  });
}

/**
 * POST { action: "seed" | "publish" | "archive", … }
 *
 * Publishing never edits an existing version: it flips status and archives
 * the version it replaces, so a previously accepted agreement stays intact.
 *
 * Publishing platform legal documents is a platform-admin act. A superadmin
 * who is inside a company has to leave it first.
 */
export async function POST(request) {
  const { session, errorResponse } = await requirePlatformAdmin(request);
  if (errorResponse) return errorResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const byEmail = session.user?.email || "";
  const { ipAddress, userAgent } = extractAuditContext(request);
  const action = String(body?.action || "");

  if (action === "seed") {
    const result = await syncSeedDocuments({ byEmail });
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_SEEDED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: { created: result.created.length, skipped: result.skipped.length },
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (!isKnownDocumentType(body?.documentType)) {
    return NextResponse.json(
      { success: false, message: "Unknown document type" },
      { status: 400 }
    );
  }

  const params = {
    documentType: body.documentType,
    language: body.language,
    jurisdiction: body.jurisdiction,
    version: Number(body.version),
    byEmail,
  };

  if (action === "publish") {
    if (String(body.language || "en") !== "en") {
      const source = await getPublishedDocument({
        documentType: body.documentType,
        language: "en",
      });
      const block = publicationBlockReason(source.doc, {
        sections: body.sections,
        sourceChecksum: body.sourceChecksum,
        status: "draft",
      });
      if (body.sections && block) {
        return NextResponse.json(
          { success: false, message: `Translation cannot be published: ${block}`, code: block },
          { status: 409 }
        );
      }
    }
    const result = await publishDocument({
      ...params,
      effectiveFrom: body.effectiveFrom || null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: result.code === "not_found" ? 404 : 409 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_PUBLISHED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
        metadata: {
        documentType: params.documentType,
        language: params.language,
        version: params.version,
        checksum: result.doc?.checksum,
        changeClass: body.changeClass === "editorial" ? "editorial" : "material",
      },
    });
    const changeClass =
      body.changeClass === PUBLICATION_CHANGE.EDITORIAL
        ? PUBLICATION_CHANGE.EDITORIAL
        : PUBLICATION_CHANGE.MATERIAL;
    if (
      !result.unchanged &&
      reacceptanceRequired({ documentType: params.documentType, changeClass })
    ) {
      await invalidateMarketplaceCheckoutsForOutdatedAgreements({
        actorEmail: byEmail,
        actorRole: "superadmin",
        ipAddress,
        userAgent,
      }).catch((err) => {
        console.error(
          "[legal-documents] checkout invalidate failed",
          err?.message || err
        );
      });
    }
    return NextResponse.json({ success: true, document: result.doc });
  }

  if (action === "archive") {
    const result = await archiveDocument({ ...params, reason: body.reason || "" });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: 404 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_ARCHIVED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      reason: body.reason || "",
      metadata: auditLegalAction("archive", {
        documentType: params.documentType,
        language: params.language,
        version: params.version,
      }),
    });
    return NextResponse.json({ success: true, document: result.doc });
  }

  if (action === "createVersion") {
    const result = await createDocumentVersion({
      documentType: body.documentType,
      language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
      jurisdiction: body.jurisdiction,
      content: body.content,
      byEmail,
      note: body.note || "",
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message || "Failed to create draft" },
        { status: 400 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_DRAFT_CREATED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: auditLegalAction("createVersion", {
        documentType: body.documentType,
        language: body.language,
        version: result.doc?.version,
        checksum: result.doc?.checksum,
      }),
    });
    return NextResponse.json({ success: true, document: result.doc });
  }

  if (action === "createTranslationDraft") {
    const result = await createTranslationDraftVersion({
      documentType: body.documentType,
      sourceLanguage: body.sourceLanguage || LEGAL_AUTHORITATIVE_LANGUAGE,
      language: body.language,
      jurisdiction: body.jurisdiction,
      byEmail,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: result.code === "not_found" ? 404 : 400 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_TRANSLATION_DRAFT_CREATED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: auditLegalAction("createTranslationDraft", {
        documentType: body.documentType,
        language: body.language,
        version: result.doc?.version,
        checksum: result.doc?.checksum,
        autoPublished: false,
      }),
    });
    return NextResponse.json({
      success: true,
      document: result.doc,
      publishable: assertTranslationPublishable(result.source, result.draft),
    });
  }

  if (action === "saveDraft" || action === "importSave") {
    const result = await saveDocumentDraft({
      documentType: body.documentType,
      language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
      jurisdiction: body.jurisdiction,
      content: body.content,
      byEmail,
      note: body.note || (action === "importSave" ? "Imported draft" : "Draft saved"),
      format: body.format || "sections",
      translationStatus: body.translationStatus || "",
      sourceChecksum: body.sourceChecksum || "",
      sourceVersion: body.sourceVersion || 0,
      pdfFile: body.pdf || null,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message || "Could not save draft" },
        { status: 400 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_DRAFT_SAVED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: auditLegalAction("saveDraft", {
        documentType: body.documentType,
        language: body.language,
        version: result.doc?.version,
        checksum: result.doc?.checksum,
      }),
    });
    const document = { ...result.doc };
    if (document.pdfFile) document.pdfFile = { ...document.pdfFile, data: undefined };
    return NextResponse.json({ success: true, document, published: false });
  }

  if (action === "importPreview") {
    const bytes = Buffer.from(String(body.base64 || ""), "base64");
    const imported = importLegalFile({
      filename: body.filename,
      bytes,
      title: body.title,
    });
    if (!imported.ok) {
      return NextResponse.json(
        { success: false, message: imported.message, code: imported.code },
        { status: 400 }
      );
    }
    const preview = { ...imported };
    if (preview.pdf) preview.pdf = { filename: preview.pdf.filename, size: preview.pdf.size, preserved: true };
    return NextResponse.json({ success: true, published: false, import: preview });
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  );
}
