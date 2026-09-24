import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import { assertCompanyDocumentIsolation } from "@/domain/legal/supplierTermsVersion";
import { ROLE } from "@models/user";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";
import {
  buildCustomerRentalTermsRecord,
  CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
  translationsToObject,
} from "@/domain/company/customerRentalTerms";
import { isGoogleTranslateConfigured } from "@/domain/geo/googleTranslate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function companyIdForActor(session, requested) {
  const isSuperadmin = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const own = getEffectiveOwnerId(session?.user);
  const access = assertCompanyDocumentIsolation({
    actorCompanyId: own,
    requestedCompanyId: requested || own,
    isSuperadmin,
  });
  if (!access.ok) return "";
  return access.companyId || resolvePartnerCompanyId(session, requested);
}

function noCompanyResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "no_company",
      message: "No partner company is associated with this account",
    },
    { status: 403 }
  );
}

function serializeTerms(company) {
  const stored = company?.customerRentalTerms || {};
  const translations = translationsToObject(stored.translations);
  return {
    documentId: stored.documentId || "",
    sourceEn: stored.sourceEn || "",
    sourceHash: stored.sourceHash || "",
    publishedVersion: Number(stored.publishedVersion || 0) || 0,
    status: stored.status || (stored.sourceEn ? "published" : "removed"),
    translations,
    translatedLanguages: Object.keys(translations).sort(),
    targetLanguages: CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
    translatedAt: stored.translatedAt || null,
    updatedAt: stored.updatedAt || null,
    updatedByEmail: stored.updatedByEmail || "",
    translateConfigured: isGoogleTranslateConfigured(),
  };
}

/**
 * GET /api/partner/legal/customer-rules
 * Partner (or superadmin view-as) reads the English source and translations.
 */
export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const companyId = companyIdForActor(
    session,
    request.nextUrl.searchParams.get("companyId")
  );
  if (!companyId) return noCompanyResponse();

  await connectToDB();
  const company = await Company.findById(companyId).lean();
  if (!company) {
    return NextResponse.json(
      { success: false, message: "Company not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    companyId: String(company._id),
    companyName: company.name || "",
    terms: serializeTerms(company),
  });
}

/**
 * PUT /api/partner/legal/customer-rules
 * Save English rental rules and translate them into every UI locale.
 */
export async function PUT(request) {
  const { session, errorResponse } = await requireAdmin(request);
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

  const companyId = companyIdForActor(session, body?.companyId);
  if (!companyId) return noCompanyResponse();

  await connectToDB();
  const company = await Company.findById(companyId);
  if (!company) {
    return NextResponse.json(
      { success: false, message: "Company not found" },
      { status: 404 }
    );
  }

  const built = await buildCustomerRentalTermsRecord({
    sourceEn: body?.sourceEn,
    previous: company.customerRentalTerms || {},
    byEmail: session.user?.email || session.user?.name || "",
    companyId: String(company._id),
  });
  if (!built.ok) {
    return NextResponse.json(
      { success: false, message: built.message },
      { status: 400 }
    );
  }

  const actionName = String(body?.action || "publish");
  const previousTerms = company.customerRentalTerms || {};
  const versions = Array.isArray(previousTerms.versions) ? previousTerms.versions : [];
  const nextVersion = (versions[versions.length - 1]?.version || 0) + 1;
  const record = { ...built.record };
  const entry = {
    version: nextVersion,
    title: body?.title || previousTerms.title || "Rental Terms",
    originalLanguage: body?.originalLanguage || previousTerms.originalLanguage || "en",
    body: built.record.sourceEn || "",
    status: actionName === "remove" ? "removed" : actionName === "draft" ? "draft" : "published",
    checksum: built.record.sourceHash || "",
    format: body?.format || "editor",
    effectiveFrom: actionName === "publish" ? new Date() : null,
  };
  record.documentId = previousTerms.documentId || `supplier-terms-${company._id}`;
  record.title = entry.title;
  record.originalLanguage = entry.originalLanguage;
  record.format = entry.format;
  record.versions = [...versions, entry];
  if (actionName === "draft") {
    record.sourceEn = previousTerms.sourceEn || "";
    record.sourceHash = previousTerms.sourceHash || "";
    record.translations = previousTerms.translations || record.translations;
    record.status = previousTerms.status === "published" ? "published" : "draft";
    record.publishedVersion = previousTerms.publishedVersion || 0;
  } else if (actionName === "remove" || !built.record.sourceEn) {
    record.sourceEn = "";
    record.sourceHash = "";
    record.translations = {};
    record.status = "removed";
    record.publishedVersion = 0;
  } else {
    record.status = "published";
    record.publishedVersion = nextVersion;
    record.effectiveFrom = new Date();
  }

  const previousHash = String(previousTerms.sourceHash || "");
  const previousSource = String(previousTerms.sourceEn || "");
  company.set("customerRentalTerms", record);
  await company.save();

  const newHash = String(built.record?.sourceHash || "");
  const newSource = String(built.record?.sourceEn || "");
  const removed = Boolean(previousSource) && !newSource;
  try {
    const { notifyRentalTermsChanged } = await import(
      "@/domain/mail/notificationPolicy"
    );
    await notifyRentalTermsChanged({
      companyId: String(company._id),
      companyName: company.name || "",
      actorEmail: session.user?.email || "",
      previousHash,
      newHash,
      removed,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[customer-rules] notify failed:", err?.message || err);
  }

  return NextResponse.json({
    success: true,
    companyId: String(company._id),
    companyName: company.name || "",
    terms: serializeTerms(company),
    failed: built.failed || [],
    translateConfigured: built.translateConfigured,
  });
}
