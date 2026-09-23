import { NextResponse } from "next/server";

import { requireAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { resolvePartnerCompanyId } from "@/domain/legal/partnerCompanyScope";
import {
  buildCustomerRentalTermsRecord,
  CUSTOMER_RENTAL_TERMS_TARGET_LOCALES,
  translationsToObject,
} from "@/domain/company/customerRentalTerms";
import { isGoogleTranslateConfigured } from "@/domain/geo/googleTranslate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    sourceEn: stored.sourceEn || "",
    sourceHash: stored.sourceHash || "",
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

  const companyId = resolvePartnerCompanyId(
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

  const companyId = resolvePartnerCompanyId(session, body?.companyId);
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
  });
  if (!built.ok) {
    return NextResponse.json(
      { success: false, message: built.message },
      { status: 400 }
    );
  }

  company.set("customerRentalTerms", built.record);
  await company.save();

  return NextResponse.json({
    success: true,
    companyId: String(company._id),
    companyName: company.name || "",
    terms: serializeTerms(company),
    failed: built.failed || [],
    translateConfigured: built.translateConfigured,
  });
}
