import mongoose from "mongoose";
import { NextResponse } from "next/server";

import Company from "@models/company";
import { connectToDB } from "@lib/database";
import { LEGAL_DOCUMENT_TYPE } from "@/domain/legal/documentTypes";
import { resolveDocumentForDisplay } from "@/domain/legal/documentService";
import { loadLegalSettingsWithTokens } from "@/domain/legal/legalSettingsService";
import { renderLegalDocument } from "@/domain/legal/tokens";
import { publicCompanyRentalTermsView } from "@/domain/company/customerRentalTerms";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";
import { getSiteCountryCode } from "@config/siteCountry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestLanguage(request) {
  return String(request.nextUrl.searchParams.get("lang") || "en")
    .toLowerCase()
    .split("-")[0]
    .trim() || "en";
}

/**
 * GET /api/public/booking-agreements?companyId=&lang=
 *
 * The two contracts a customer must read before submitting a booking:
 * published Rovaro customer-booking-terms, and the supplier's rental rules
 * in the requested language (English fallback).
 */
export async function GET(request) {
  const language = requestLanguage(request);
  const companyIdRaw = String(
    request.nextUrl.searchParams.get("companyId") || ""
  ).trim();

  try {
    const [{ doc, fellBackToEnglish }, { tokens }] = await Promise.all([
      resolveDocumentForDisplay({
        documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
        language,
      }),
      loadLegalSettingsWithTokens({ language }),
    ]);

    const platform = doc
      ? {
          available: true,
          documentType: doc.documentType,
          language: doc.language,
          version: doc.version,
          checksum: doc.checksum,
          fellBackToEnglish,
          content: renderLegalDocument(doc, { settings: tokens, language }),
        }
      : {
          available: false,
          documentType: LEGAL_DOCUMENT_TYPE.CUSTOMER_BOOKING_TERMS,
          language,
          version: 0,
          checksum: "",
          fellBackToEnglish: false,
          content: { title: "", sections: [] },
        };

    let company = {
      available: false,
      companyName: "",
      body: "",
      language: "en",
      sourceHash: "",
      fellBackToEnglish: false,
    };

    if (companyIdRaw && mongoose.Types.ObjectId.isValid(companyIdRaw)) {
      await connectToDB();
      const owner = await Company.findById(companyIdRaw)
        .select("name country customerRentalTerms")
        .lean();
      if (owner && isCompanyInSiteCountry(owner, getSiteCountryCode())) {
        company = publicCompanyRentalTermsView(
          owner.customerRentalTerms,
          language,
          owner.name
        );
      }
    }

    return NextResponse.json({
      success: true,
      language,
      platform,
      company,
    });
  } catch (err) {
    console.error("[public booking-agreements]", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Failed to load booking agreements" },
      { status: 500 }
    );
  }
}
