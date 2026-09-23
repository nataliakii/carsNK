import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import {
  buildAgreementPackage,
  acceptMasterAgreement,
  getActiveAgreement,
  listAgreements,
  CLICKWRAP_ACCEPTANCE_STATEMENT,
} from "@/domain/legal/agreementService";
import { resolveEsignProvider } from "@/domain/legal/esign";
import { resolveClickwrapIp } from "@/domain/legal/agreementSigning";
import { normalizeLegalLanguage } from "@/domain/legal/documentTypes";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { recordAuditEvent, extractAuditContext } from "@/domain/legal/auditTrail";
import {
  consumePublicPostOrError,
  agreementAcceptRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCompanyId(session, requested) {
  return resolvePartnerCompanyId(session, requested);
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
      { success: false, message: "No partner company is associated with this account" },
      { status: 403 }
    );
  }

  const language = normalizeLegalLanguage(
    request.nextUrl.searchParams.get("lang")
  );

  const [pkg, active, history] = await Promise.all([
    buildAgreementPackage({ language }),
    getActiveAgreement(companyId),
    listAgreements(companyId),
  ]);

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
    esignMode,
    /** true while the documents are still drafts — signing is blocked. */
    containsDrafts: pkg.anyDraft,
    documents: pkg.documents.map((d) => ({
      documentType: d.documentType,
      language: d.language,
      jurisdiction: d.jurisdiction,
      version: d.version,
      effectiveFrom: d.effectiveFrom,
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
          acceptanceMethod: active.acceptanceMethod,
          documents: (active.documents || []).map((d) => ({
            documentType: d.documentType,
            language: d.language,
            version: d.version,
            checksum: d.checksum,
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

  const companyId = resolveCompanyId(session, body?.companyId);
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No partner company is associated with this account" },
      { status: 403 }
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);

  const result = await acceptMasterAgreement({
    companyId,
    language: body?.language,
    signerName: String(body?.signerName || "").trim(),
    signerRole: String(body?.signerRole || "").trim(),
    signerEmail: String(body?.signerEmail || session.user?.email || "").trim(),
    confirmationOfAuthority: Boolean(body?.confirmationOfAuthority),
    acceptedCheckbox: Boolean(body?.acceptedCheckbox),
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

  return NextResponse.json({
    success: true,
    agreementId: result.agreementId,
    acceptedAt: result.acceptance.acceptedAt,
    packageChecksum: result.acceptance.packageChecksum,
  });
}
