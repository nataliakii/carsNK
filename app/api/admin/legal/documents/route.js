import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import {
  listDocuments,
  syncSeedDocuments,
  publishDocument,
  archiveDocument,
  getDocumentStatusOverview,
} from "@/domain/legal/documentService";
import { findSuppressedSections } from "@/domain/legal/tokens";
import { isKnownDocumentType } from "@/domain/legal/documentTypes";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";

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

  const rows = await listDocuments();
  const overview = await getDocumentStatusOverview();

  return NextResponse.json({
    success: true,
    overview,
    documents: rows.map((doc) => ({
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
      /** Sections hidden from public output until config is complete. */
      suppressedSections: findSuppressedSections(doc),
      history: doc.history || [],
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
 */
export async function POST(request) {
  const { session, errorResponse } = await requireSuperAdmin(request);
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
      },
    });
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
      metadata: {
        documentType: params.documentType,
        language: params.language,
        version: params.version,
      },
    });
    return NextResponse.json({ success: true, document: result.doc });
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  );
}
