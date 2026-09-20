import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@lib/adminAuth";
import { connectToDB } from "@lib/database";
import Company from "@models/company";
import PartnerLegalProfile from "@models/PartnerLegalProfile";
import PartnerAgreementAcceptance from "@models/PartnerAgreementAcceptance";
import { evaluateProfileCompleteness } from "@/domain/legal/partnerVerification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Superadmin "Partner agreements" overview.
 *
 * Returns one row per partner with verification status, agreement status,
 * version, signer, acceptedAt, checksum and history. Tax identifiers stay in
 * the response only in the form the operator legitimately needs to verify a
 * partner (registration number, NIF/CIF) — they are partner business data,
 * not the operator's own confidential identifiers.
 */
export async function GET(request) {
  const { errorResponse } = await requireSuperAdmin(request);
  if (errorResponse) return errorResponse;

  await connectToDB();

  const [companies, profiles, agreements] = await Promise.all([
    Company.find({}).select("name slug country").sort({ name: 1 }).lean(),
    PartnerLegalProfile.find({}).lean(),
    PartnerAgreementAcceptance.find({}).sort({ acceptedAt: -1 }).lean(),
  ]);

  const profileByCompany = new Map(
    profiles.map((p) => [String(p.companyId), p])
  );
  const agreementsByCompany = new Map();
  for (const agreement of agreements) {
    const key = String(agreement.companyId);
    if (!agreementsByCompany.has(key)) agreementsByCompany.set(key, []);
    agreementsByCompany.get(key).push(agreement);
  }

  const rows = companies.map((company) => {
    const key = String(company._id);
    const profile = profileByCompany.get(key) || null;
    const list = agreementsByCompany.get(key) || [];
    const active = list.find((a) => !a.supersededAt && !a.terminatedAt) || null;

    return {
      companyId: key,
      companyName: company.name || "",
      country: company.country || "",
      verification: profile
        ? {
            status: profile.verificationStatus,
            statusAt: profile.verificationStatusAt,
            verifiedByEmail: profile.verifiedByEmail || "",
            suspensionReason: profile.suspensionReason || "",
            rejectionReason: profile.rejectionReason || "",
            completeness: evaluateProfileCompleteness(profile),
            legalName: profile.legalName || "",
            registrationNumber: profile.registrationNumber || "",
            nifCif: profile.nifCif || "",
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

  return NextResponse.json({ success: true, partners: rows });
}
