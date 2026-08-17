/**
 * Resolve which company branding applies for admin voucher PDF/email.
 */

import { connectToDB } from "@lib/database";
import Company from "@models/company";
import { ROLE } from "@models/user";
import {
  buildCompanyVoucherDefaults,
  getCompanyVoucherStampSrc,
} from "@/domain/vouchers/companyStamp";

/**
 * @param {object} session - requireAdmin session ({ user })
 * @param {string|null|undefined} requestedCompanyId
 * @returns {Promise<{ company: object|null, stampSrc: string, defaults: object }>}
 */
export async function resolveAdminVoucherCompany(session, requestedCompanyId) {
  await connectToDB();
  const user = session?.user || {};
  const role = Number(user.role);
  const isSuper = role === ROLE.SUPERADMIN;
  const ownerId = user.ownerId ? String(user.ownerId) : null;
  const requested = String(requestedCompanyId || "").trim();

  let company = null;
  if (isSuper) {
    const id = requested || ownerId;
    if (id) company = await Company.findById(id).lean();
  } else if (ownerId) {
    // Partner admin: always their own company (ignore client spoofing)
    company = await Company.findById(ownerId).lean();
  }

  const stampSrc = getCompanyVoucherStampSrc(company);
  const defaults = buildCompanyVoucherDefaults(company);
  return { company, stampSrc, defaults };
}
