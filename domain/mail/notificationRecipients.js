/**
 * Resolve notification recipients with strict company isolation.
 * Never uses client-controlled recipient lists for internal/ops mail.
 */

import mongoose from "mongoose";
import {
  getSuperadminNotificationEmails,
  normalizeEmailAddress,
} from "@config/email";
import { connectToDB } from "@lib/database";
import { User, ROLE } from "@models/user";
import Company from "@models/company";
import {
  ADMIN_STATUS,
  deriveAdminStatus,
} from "@/domain/admin/companyAdmins";
import {
  resolveCompanyPreferenceEmails,
} from "@/domain/mail/emailPreferences";

function isUsableObjectId(value) {
  const raw = String(value || "").trim();
  return Boolean(raw) && mongoose.Types.ObjectId.isValid(raw);
}

/**
 * Centrally configured superadmin recipients (env-based).
 * @returns {string[]}
 */
export function resolveSuperadminRecipients() {
  return getSuperadminNotificationEmails();
}

/**
 * Active administrators belonging ONLY to the given company.
 * Pending invitations and disabled accounts are excluded.
 *
 * @param {string} companyId
 * @returns {Promise<string[]>}
 */
export async function resolveCompanyAdminEmails(companyId) {
  const id = String(companyId || "").trim();
  if (!isUsableObjectId(id)) return [];

  await connectToDB();
  const users = await User.find({
    isAdmin: true,
    role: { $ne: ROLE.SUPERADMIN },
    ownerId: id,
    disabledAt: null,
  })
    .select("email ownerId disabledAt lastLoginAt invitedAt")
    .lean();

  const out = [];
  const seen = new Set();
  for (const user of users || []) {
    if (String(user?.ownerId || "") !== id) continue;
    if (deriveAdminStatus(user) !== ADMIN_STATUS.ACTIVE) continue;
    const email = normalizeEmailAddress(user.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Company operational booking recipients: prefs + active admins.
 * Critical events always ensure ≥1 active admin when any exist.
 *
 * @param {string} companyId
 * @param {"booking"|"transfer"|"critical"} channel
 * @param {{ fallbackEmails?: string[] }} [opts]
 * @returns {Promise<{ emails: string[], company: object|null }>}
 */
export async function resolveCompanyNotificationRecipients(
  companyId,
  channel = "booking",
  opts = {}
) {
  const id = String(companyId || "").trim();
  const seen = new Set();
  const emails = [];
  const push = (raw) => {
    const email = normalizeEmailAddress(raw);
    if (!email || seen.has(email)) return;
    seen.add(email);
    emails.push(email);
  };

  let company = null;
  if (isUsableObjectId(id)) {
    await connectToDB();
    company = await Company.findById(id)
      .select("name email email2 emailPreferences langAdmin country")
      .lean();
    if (company) {
      for (const email of resolveCompanyPreferenceEmails(company, channel)) {
        push(email);
      }
      const admins = await resolveCompanyAdminEmails(id);
      if (channel === "critical" || channel === "booking") {
        for (const email of admins) push(email);
      }
      if (channel === "critical" && emails.length === 0) {
        for (const email of admins) push(email);
        push(company.email);
      }
    }
  }

  // Server-known fallback (e.g. company.email loaded by the caller). Never from client.
  for (const raw of opts.fallbackEmails || []) {
    push(raw);
  }

  return { emails, company };
}

/**
 * Guard: recipients must never include another company's admins.
 * Used in tests and as a soft runtime check.
 */
export function assertCompanyIsolation(emails, allowedCompanyEmails) {
  const allowed = new Set(
    (allowedCompanyEmails || []).map((e) => normalizeEmailAddress(e)).filter(Boolean)
  );
  const foreign = (emails || [])
    .map((e) => normalizeEmailAddress(e))
    .filter((e) => e && allowed.size > 0 && !allowed.has(e));
  return { ok: foreign.length === 0, foreign };
}
