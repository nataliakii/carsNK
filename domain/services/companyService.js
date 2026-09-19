/**
 * Company service — direct DB access for server and API routes.
 * Use from server components and API routes; do not call internal API via fetch.
 */

import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { COMPANY_ID } from "@config/company";
import { ensureCarsNkCompany } from "./ensureCarsNkCompany";
import { isCompanyInSiteCountry } from "@/domain/platform/companyCountryScope";

function toPlainCompanyData(company) {
  if (!company) return null;
  return JSON.parse(JSON.stringify(company));
}

/**
 * Get company by ID. If the configured CarsNK COMPANY_ID is missing in an
 * empty database, create it with defaults so admin/public stop 404-ing.
 * @param {string} companyId - MongoDB _id
 * @returns {Promise<Object|null>} Company document or null
 */
export async function getCompany(companyId) {
  if (!companyId) return null;
  await connectToDB();
  let company = await Company.findById(companyId).lean();
  if (!company && String(companyId) === String(COMPANY_ID)) {
    company = await ensureCarsNkCompany(Company);
  }
  return toPlainCompanyData(company);
}

export async function getCompanyBySlug(slug) {
  const value = String(slug || "").trim().toLowerCase();
  if (!value) return null;
  await connectToDB();
  const company = await Company.findOne({
    slug: value,
    storefrontEnabled: { $ne: false },
  }).lean();
  if (!company || !isCompanyInSiteCountry(company)) return null;
  return toPlainCompanyData(company);
}
