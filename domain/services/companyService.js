/**
 * Company service — direct DB access for server and API routes.
 * Use from server components and API routes; do not call internal API via fetch.
 */

import { connectToDB } from "@lib/database";
import Company from "@models/company";

function toPlainCompanyData(company) {
  if (!company) return null;
  return JSON.parse(JSON.stringify(company));
}

/**
 * Get company by ID.
 * @param {string} companyId - MongoDB _id
 * @returns {Promise<Object|null>} Company document or null
 */
export async function getCompany(companyId) {
  if (!companyId) return null;
  await connectToDB();
  const company = await Company.findById(companyId).lean();
  return toPlainCompanyData(company);
}
