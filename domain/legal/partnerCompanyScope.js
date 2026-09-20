/**
 * Company the partner-legal routes act on.
 *
 * Superadmin may name a company explicitly; otherwise the session's effective
 * owner (own company, or view-as) is used. The request body never overrides
 * a partner admin's company.
 */

import { ROLE } from "@models/user";
import { getEffectiveOwnerId } from "@/domain/owners/ownerScope";

export function resolvePartnerCompanyId(session, requested) {
  const isSuperadmin = Number(session?.user?.role) === ROLE.SUPERADMIN;
  if (isSuperadmin && requested) return String(requested);
  return getEffectiveOwnerId(session?.user);
}
