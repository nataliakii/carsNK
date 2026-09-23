import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import { evaluateProfileCompleteness } from "@/domain/legal/partnerVerification";
import {
  buildAdminCountryCompanyFilter,
  normalizeAdminCountryFilter,
} from "@/domain/platform/adminCountryScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin partner verification overview / pending count.
 *
 * Optional `?country=ES|GR|ALL` scopes companies to the admin workspace so
 * Spain Legal badge never includes Greece partners (and vice versa).
 */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();

  const { searchParams } = request.nextUrl;
  const country = normalizeAdminCountryFilter(
    searchParams.get("country") || "ALL"
  );
  const companyFilter = buildAdminCountryCompanyFilter(country);

  if (searchParams.get("summary") === "1") {
    const companies = await Company.find(companyFilter).select("_id").lean();
    const companyIds = companies.map((c) => c._id);
    const pendingReview =
      companyIds.length === 0
        ? 0
        : await PartnerLegalProfile.countDocuments({
            companyId: { $in: companyIds },
            verificationStatus: "PENDING_VERIFICATION",
          });
    return NextResponse.json({
      success: true,
      pendingReview,
      country,
    });
  }

  const [companies, profiles, agreements] = await Promise.all([
    Company.find(companyFilter)
      .select("name slug country email listedOnMarketplace bookingMode")
      .sort({ name: 1 })
      .lean(),
    PartnerLegalProfile.find({}).lean(),
    PartnerAgreementAcceptance.find({}).sort({ acceptedAt: -1 }).lean(),
  ]);

  const companyIdSet = new Set(companies.map((c) => String(c._id)));
  const profileByCompany = new Map(
    profiles
      .filter((p) => companyIdSet.has(String(p.companyId)))
      .map((p) => [String(p.companyId), p])
  );
  const agreementsByCompany = new Map();
  for (const agreement of agreements) {
    const key = String(agreement.companyId);
    if (!companyIdSet.has(key)) continue;
    if (!agreementsByCompany.has(key)) agreementsByCompany.set(key, []);
    agreementsByCompany.get(key).push(agreement);
  }

  const rows = companies.map((company) => {
    const key = String(company._id);
    const profile = profileByCompany.get(key) || null;
    const list = agreementsByCompany.get(key) || [];
    const active = list.find((a) => !a.supersededAt && !a.terminatedAt) || null;

    const uploaded = (profile?.documents || []).filter((doc) => doc?.storageRef);
    const completeness = profile ? evaluateProfileCompleteness(profile) : null;
    const missingDocs = completeness?.missingRecommendedDocuments || [];

    return {
      companyId: key,
      companyName: company.name || "",
      country: company.country || "",
      companyEmail: company.email || "",
      listedOnMarketplace: company.listedOnMarketplace !== false,
      bookingMode: company.bookingMode || "",
      verification: profile
        ? {
            status: profile.verificationStatus,
            statusAt: profile.verificationStatusAt,
            submittedAt: profile.submittedAt || null,
            verifiedByEmail: profile.verifiedByEmail || "",
            suspensionReason: profile.suspensionReason || "",
            rejectionReason: profile.rejectionReason || "",
            completeness,
            missingDocuments: missingDocs,
            legalName: profile.legalName || "",
            tradingName: profile.tradingName || "",
            registrationNumber: profile.registrationNumber || "",
            nifCif: profile.nifCif || "",
            signatoryName: profile.signatoryName || "",
            signatoryRole: profile.signatoryRole || "",
            businessEmail: profile.businessEmail || "",
            businessPhone: profile.businessPhone || "",
            registeredAddress: profile.registeredAddress || "",
            insuranceProvider: profile.insuranceProvider || "",
            insurancePolicyReference: profile.insurancePolicyReference || "",
            documents: uploaded.map((doc) => ({
              kind: doc.kind,
              label: doc.label || "",
              uploadedAt: doc.uploadedAt,
              accepted: Boolean(doc.accepted),
            })),
            history: profile.statusHistory || [],
          }
        : null,
      agreement: active
        ? {
            agreementId: active.agreementId,
            signerName: active.signerName,
            signerRole: active.signerRole,
            signerEmail: active.signerEmail,
            acceptedAt: active.acceptedAt,
            acceptanceMethod: active.acceptanceMethod,
            packageChecksum: active.packageChecksum,
            documents: (active.documents || []).map((d) => ({
              documentType: d.documentType,
              language: d.language,
              version: d.version,
              checksum: d.checksum,
            })),
          }
        : null,
      agreementHistory: list.map((a) => ({
        agreementId: a.agreementId,
        acceptedAt: a.acceptedAt,
        signerName: a.signerName,
        packageChecksum: a.packageChecksum,
        supersededAt: a.supersededAt,
        terminatedAt: a.terminatedAt,
        terminationReason: a.terminationReason || "",
      })),
    };
  });

  const rank = (row) => {
    const status = row.verification?.status || "";
    if (status === "PENDING_VERIFICATION") return 0;
    if (status === "DRAFT" || status === "REJECTED") return 1;
    if (status === "SUSPENDED") return 2;
    if (status === "VERIFIED") return 3;
    return 4;
  };
  rows.sort((a, b) => rank(a) - rank(b) || a.companyName.localeCompare(b.companyName));

  const pendingReview = rows.filter(
    (row) => row.verification?.status === "PENDING_VERIFICATION"
  ).length;

  return NextResponse.json({
    success: true,
    pendingReview,
    country,
    partners: rows,
  });
}
