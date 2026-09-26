import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import {
  resolveCurrentPartnerPackage,
  acceptMasterAgreement,
  listAgreements,
  CLICKWRAP_ACCEPTANCE_STATEMENT,
} from "@/domain/legal/agreementService";
import { resolveEsignProvider } from "@/domain/legal/esign";
import { resolveClickwrapIp } from "@/domain/legal/agreementSigning";
import { normalizeLegalLanguage } from "@/domain/legal/documentTypes";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import {
  ownCompanyScope,
  superadminMayAcceptTerms,
} from "@/domain/legal/companyLegalPage";
import { connectToDB } from "@lib/database";
import {
  recordAuditEvent,
  extractAuditContext,
} from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  agreementAcceptRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCompanyId(session, requested) {
  const scope = ownCompanyScope(session, requested);
  if (scope.forbidden) return "";
  return scope.companyId || resolvePartnerCompanyId(session, requested);
}

/**
 * GET — the exact package the partner must read before signing.
 * Read-only; opening it records a view in the audit trail but changes nothing.
 */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = resolveCompanyId(
    session,
    request.nextUrl.searchParams.get("companyId")
  );
  if (!companyId) {
    return NextResponse.json(
      {
        success: false,
        message: "No partner company is associated with this account",
      },
      { status: 403 }
    );
  }

  const language = normalizeLegalLanguage(
    request.nextUrl.searchParams.get("lang")
  );

  await connectToDB();
  const [pkg, history] = await Promise.all([
    resolveCurrentPartnerPackage({ companyId, requestedLocale: language }),
    listAgreements(companyId),
  ]);
  const active = pkg.latestAcceptance;

  const { ipAddress, userAgent } = extractAuditContext(request);
  await recordAuditEvent({
    action: "PARTNER_AGREEMENT_VIEWED",
    userRole: "admin",
    userEmail: session.user?.email || "",
    severity: "low",
    ipAddress,
    userAgent,
    metadata: { companyId, packageChecksum: pkg.packageChecksum },
  });

  const { mode: esignMode } = resolveEsignProvider(pkg.settings.esignProvider);

  return NextResponse.json({
    success: true,
    acceptanceStatement: CLICKWRAP_ACCEPTANCE_STATEMENT,
    packageChecksum: pkg.packageChecksum,
    legalState: pkg.legalState.state,
    legalActionCount: pkg.legalState.legalActionCount,
    manifest: pkg.manifest,
    changedDocumentTypes: pkg.legalState.changedDocumentTypes || [],
    missingDocumentTypes: pkg.legalState.missingDocumentTypes || [],
    /** This partner's negotiated rate. Not part of packageChecksum. */
    commercialTerms: pkg.commercialTerms || null,
    esignMode,
    /** true while the documents are still drafts — signing is blocked. */
    containsDrafts: pkg.anyDraft,
    documents: pkg.documents.map((d) => ({
      documentType: d.documentType,
      documentId: d.documentId,
      bindingDocumentId: d.bindingDocumentId,
      bindingVersion: d.bindingVersion,
      bindingChecksum: d.bindingChecksum,
      language: d.language,
      requestedLanguage: d.requestedLanguage,
      fellBackToSourceLanguage: d.fellBackToSourceLanguage,
      jurisdiction: d.jurisdiction,
      version: d.version,
      effectiveFrom: d.effectiveFrom,
      publishedAt: d.publishedAt,
      publicationChangeClass: d.publicationChangeClass,
      checksum: d.checksum,
      ref: d.ref,
      status: d.source,
      title: d.renderedTitle,
      sections: d.renderedSections,
    })),
    activeAgreement: active
      ? {
          agreementId: active.agreementId,
          acceptedAt: active.acceptedAt,
          signerName: active.signerName,
          signerRole: active.signerRole,
          signerEmail: active.signerEmail,
          packageChecksum: active.packageChecksum,
          /** The rate frozen when this agreement was signed, not today's. */
          commercialTerms: active.commercialTermsSnapshot || null,
          acceptanceMethod: active.acceptanceMethod,
          documents: (active.documents || []).map((d) => ({
            documentType: d.documentType,
            documentId: d.bindingDocumentId || d.documentId || "",
            language: d.language,
            version: d.bindingVersion || d.version,
            checksum: d.bindingChecksum || d.checksum,
          })),
        }
      : null,
    history: history.map((a) => ({
      agreementId: a.agreementId,
      acceptedAt: a.acceptedAt,
      packageChecksum: a.packageChecksum,
      supersededAt: a.supersededAt,
      terminatedAt: a.terminatedAt,
    })),
  });
}

/**
 * POST — record the clickwrap (or manual) acceptance.
 *
 * The document versions are resolved server-side, so the partner cannot
 * choose or influence which text is recorded against their signature.
 */
export async function POST(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const limited = await consumePublicPostOrError(
    request,
    agreementAcceptRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  if (!superadminMayAcceptTerms(session.user?.role)) {
    return NextResponse.json(
      {
        success: false,
        code: "superadmin_cannot_accept",
        message: "A superadmin cannot accept terms for a partner.",
      },
      { status: 403 }
    );
  }

  const companyId = resolveCompanyId(session, body?.companyId);
  if (!companyId) {
    return NextResponse.json(
      {
        success: false,
        message: "No partner company is associated with this account",
      },
      { status: 403 }
    );
  }

  const sessionEmail = String(session.user?.email || "").trim();
  if (!sessionEmail) {
    return NextResponse.json(
      { success: false, message: "This account has no email address" },
      { status: 400 }
    );
  }

  const accepted = Boolean(body?.acceptedCheckbox);
  const { ipAddress, userAgent } = extractAuditContext(request);

  const result = await acceptMasterAgreement({
    companyId,
    language: body?.language,
    signerName: String(body?.signerName || "").trim(),
    signerRole: String(body?.signerRole || "").trim(),
    signerEmail: sessionEmail,
    confirmationOfAuthority:
      body?.confirmationOfAuthority == null
        ? accepted
        : Boolean(body.confirmationOfAuthority),
    acceptedCheckbox: accepted,
    authenticatedUserId: String(session.user?.id || session.user?.email || ""),
    ipAddress: resolveClickwrapIp(ipAddress),
    userAgent,
    evidenceStorageRef: body?.evidenceStorageRef,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status || 400 }
    );
  }

  const resolvedAfterAcceptance = await resolveCurrentPartnerPackage({
    companyId,
    requestedLocale: body?.language,
  });

  return NextResponse.json({
    success: true,
    agreementId: result.agreementId,
    acceptedAt: result.acceptance.acceptedAt,
    packageChecksum: result.acceptance.packageChecksum,
    legalState: resolvedAfterAcceptance.legalState.state,
    legalActionCount: resolvedAfterAcceptance.legalState.legalActionCount,
    manifest: resolvedAfterAcceptance.manifest,
  });
}
