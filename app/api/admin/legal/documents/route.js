import { NextResponse } from "next/server";

import { requirePlatformAdmin, requireSuperAdmin } from "@lib/adminAuth";
import {
  listDocuments,
  syncSeedDocuments,
  publishDocument,
  publishRequiredDocuments,
  archiveDocument,
  getDocumentStatusOverview,
  createDocumentVersion,
  createTranslationDraftVersion,
  saveDocumentDraft,
  getPublishedDocument,
  listLiveTestContentDocuments,
  restorePreviousPublishedVersion,
} from "@/domain/legal/documentService";
import {
  isKnownDocumentType,
  LEGAL_AUTHORITATIVE_LANGUAGE,
  LEGAL_DOCUMENT_TYPE,
} from "@/domain/legal/documentTypes";
import { findSuppressedSections } from "@/domain/legal/tokens";
import {
  recordAuditEvent,
  extractAuditContext,
} from "@/domain/legal/auditTrail";
import {
  reacceptanceRequired,
  PUBLICATION_CHANGE,
} from "@/domain/legal/publicationClass";
import { invalidateMarketplaceCheckoutsForOutdatedAgreements } from "@/domain/orders/invalidateMarketplaceCheckout";
import { importLegalFile } from "@/domain/legal/documentImport";
import {
  buildTranslationDraft,
  publicationBlockReason,
} from "@/domain/legal/translationAdapter";
import { auditLegalAction } from "@/domain/legal/contentSanitizer";
import { assertTranslationPublishable } from "@/domain/legal/translationWorkflow";
import {
  isProductionLegalRuntime,
  TEST_CONTENT_PRODUCTION_MESSAGE,
} from "@/domain/legal/testContentGuard";
import { isAutomatedTestRuntime } from "@/domain/legal/environmentDbGuard";

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
  const liveTestContent = await listLiveTestContentDocuments();
  const filtered = rows.filter((doc) => {
    if (filterType && doc.documentType !== filterType) return false;
    if (filterLang && doc.language !== filterLang) return false;
    return true;
  });

  return NextResponse.json({
    success: true,
    overview,
    liveTestContent,
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
      testOnly: Boolean(doc.testOnly),
      ...(includeContent
        ? { content: doc.content || { title: "", sections: [] } }
        : {}),
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
        ? {
            filename: doc.pdfFile.filename,
            size: doc.pdfFile.size,
            extractionComplete: doc.pdfFile.extractionComplete,
          }
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
      metadata: {
        created: result.created.length,
        skipped: result.skipped.length,
      },
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === "publishAll") {
    if (isProductionLegalRuntime()) {
      const confirmToken = String(body.publishConfirm || "")
        .trim()
        .toUpperCase();
      if (confirmToken !== "PUBLISH") {
        return NextResponse.json(
          {
            success: false,
            code: "publish_confirm_required",
            message:
              "Type PUBLISH to confirm publishing platform legal documents in production.",
          },
          { status: 400 }
        );
      }
    }
    if (isAutomatedTestRuntime() && process.env.ALLOW_QA_PUBLISH !== "1") {
      return NextResponse.json(
        {
          success: false,
          code: "qa_publish_blocked",
          message:
            "Browser QA / automated tests must stop before real publication unless ALLOW_QA_PUBLISH=1 on an isolated QA database.",
        },
        { status: 400 }
      );
    }
    const changeClass =
      body.changeClass === PUBLICATION_CHANGE.EDITORIAL
        ? PUBLICATION_CHANGE.EDITORIAL
        : PUBLICATION_CHANGE.MATERIAL;
    const result = await publishRequiredDocuments({ byEmail, changeClass });
    await recordAuditEvent({
      action: "LEGAL_DOCUMENTS_PUBLISHED_BATCH",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      metadata: {
        changeClass,
        published: result.published,
        failed: result.failed,
        remaining: result.remaining.length,
      },
    });
    const supplierPublished = result.published.filter(
      (row) =>
        row.documentType === LEGAL_DOCUMENT_TYPE.PARTNER_AGREEMENT ||
        row.documentType === LEGAL_DOCUMENT_TYPE.PARTNER_OPERATING_RULES ||
        row.documentType === LEGAL_DOCUMENT_TYPE.DATA_PROTECTION_SCHEDULE
    );
    if (
      changeClass === PUBLICATION_CHANGE.MATERIAL &&
      supplierPublished.some((row) => !row.unchanged)
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
    if (result.failed.length) {
      return NextResponse.json(
        {
          success: false,
          message: `Published ${result.published.length} document(s); ${result.failed.length} failed.`,
          ...result,
        },
        { status: 409 }
      );
    }
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
    if (isProductionLegalRuntime()) {
      const confirmToken = String(body.publishConfirm || "")
        .trim()
        .toUpperCase();
      if (confirmToken !== "PUBLISH") {
        return NextResponse.json(
          {
            success: false,
            code: "publish_confirm_required",
            message:
              "Type PUBLISH to confirm publishing platform legal documents in production.",
          },
          { status: 400 }
        );
      }
    }
    if (isAutomatedTestRuntime() && process.env.ALLOW_QA_PUBLISH !== "1") {
      return NextResponse.json(
        {
          success: false,
          code: "qa_publish_blocked",
          message:
            "Browser QA / automated tests must stop before real publication unless ALLOW_QA_PUBLISH=1 on an isolated QA database.",
        },
        { status: 400 }
      );
    }
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
          {
            success: false,
            message: `Translation cannot be published: ${block}`,
            code: block,
          },
          { status: 409 }
        );
      }
    }
    const result = await publishDocument({
      ...params,
      effectiveFrom: body.effectiveFrom || null,
      expectedChecksum: body.expectedChecksum || null,
      changeClass: body.changeClass === "editorial" ? "editorial" : "material",
    });
    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "test_content_blocked"
          ? 400
          : 409;
      return NextResponse.json(
        {
          success: false,
          message:
            result.code === "test_content_blocked"
              ? TEST_CONTENT_PRODUCTION_MESSAGE
              : result.message,
          code: result.code,
        },
        { status }
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
        verified: result.verified || null,
        changeClass:
          body.changeClass === "editorial" ? "editorial" : "material",
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
    return NextResponse.json({
      success: true,
      document: result.doc,
      verified: result.verified || null,
      unchanged: Boolean(result.unchanged),
    });
  }

  if (action === "restorePrevious") {
    const result = await restorePreviousPublishedVersion({
      documentType: body.documentType,
      language: body.language,
      jurisdiction: body.jurisdiction,
      byEmail,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: result.code === "no_restore_candidate" ? 404 : 409 }
      );
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_RESTORED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "high",
      ipAddress,
      userAgent,
      metadata: {
        documentType: body.documentType,
        language: body.language,
        version: result.doc?.version,
        checksum: result.doc?.checksum,
      },
    });
    return NextResponse.json({
      success: true,
      document: result.doc,
      verified: result.verified || null,
    });
  }

  if (action === "archive") {
    const result = await archiveDocument({
      ...params,
      reason: body.reason || "",
    });
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
    // Import never publishes. Prefer updating an existing draft; create the
    // next version only when the latest row is already published/archived.
    const forceNewVersion = Boolean(body.forceNewVersion);
    const result = await saveDocumentDraft({
      documentType: body.documentType,
      language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
      jurisdiction: body.jurisdiction,
      content: body.content,
      byEmail,
      note:
        body.note ||
        (action === "importSave" ? "Imported draft" : "Draft saved"),
      format: body.format || "sections",
      translationStatus: body.translationStatus || "",
      sourceChecksum: body.sourceChecksum || "",
      sourceVersion: body.sourceVersion || 0,
      pdfFile: body.pdf || null,
      forceNewVersion,
      sourceFilename: body.filename || body.sourceFilename || "",
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message || "Could not save draft" },
        { status: 400 }
      );
    }
    await recordAuditEvent({
      action:
        action === "importSave"
          ? "LEGAL_DOCUMENT_IMPORT_SAVED"
          : "LEGAL_DOCUMENT_DRAFT_SAVED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "medium",
      ipAddress,
      userAgent,
      metadata: auditLegalAction(action, {
        documentType: body.documentType,
        language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
        version: result.doc?.version,
        checksum: result.doc?.checksum,
        filename: body.filename || "",
        fileType: body.fileType || body.format || "",
        fileSize: Number(body.fileSize) || 0,
        result: "draft_saved",
        userId: session?.user?.id || session?.user?._id || "",
      }),
    });
    const document = { ...result.doc };
    if (document.pdfFile)
      document.pdfFile = { ...document.pdfFile, data: undefined };
    let publishedVersion = null;
    try {
      const live = await getPublishedDocument({
        documentType: body.documentType,
        language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
      });
      publishedVersion = live?.doc?.version || null;
    } catch {
      publishedVersion = null;
    }
    return NextResponse.json({
      success: true,
      document,
      published: false,
      publishedVersion,
      created: Boolean(result.created),
    });
  }

  if (action === "importPreview") {
    const bytes = Buffer.from(String(body.base64 || ""), "base64");
    const imported = importLegalFile({
      filename: body.filename,
      bytes,
      title: body.title,
    });
    if (!imported.ok) {
      await recordAuditEvent({
        action: "LEGAL_DOCUMENT_IMPORT_FAILED",
        userRole: "superadmin",
        userEmail: byEmail,
        severity: "medium",
        ipAddress,
        userAgent,
        metadata: auditLegalAction("importPreview", {
          documentType: body.documentType || "",
          language: body.language || LEGAL_AUTHORITATIVE_LANGUAGE,
          filename: body.filename || "",
          fileType: body.fileType || "",
          fileSize: Number(body.fileSize) || bytes.length || 0,
          result: imported.code || "failed",
          userId: session?.user?.id || session?.user?._id || "",
        }),
      });
      return NextResponse.json(
        { success: false, message: imported.message, code: imported.code },
        { status: 400 }
      );
    }
    const preview = { ...imported };
    if (preview.pdf) {
      preview.pdf = {
        filename: preview.pdf.filename,
        size: preview.pdf.size,
        sha256: preview.pdf.sha256,
        preserved: true,
      };
    }
    await recordAuditEvent({
      action: "LEGAL_DOCUMENT_IMPORT_PREVIEWED",
      userRole: "superadmin",
      userEmail: byEmail,
      severity: "low",
      ipAddress,
      userAgent,
      metadata: auditLegalAction("importPreview", {
        documentType: body.documentType || "",
        language: preview.detectedLanguage || "en",
        filename: preview.filename || body.filename || "",
        fileType: preview.fileType || body.fileType || "",
        fileSize: preview.fileSize || bytes.length || 0,
        result: "preview_ready",
        sectionCount: preview.sectionCount || 0,
        userId: session?.user?.id || session?.user?._id || "",
      }),
    });
    return NextResponse.json({
      success: true,
      published: false,
      import: preview,
    });
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  );
}
