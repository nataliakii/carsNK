"use client";

import PartnerLegalReview from "@/app/admin/legal-profile/_components/PartnerLegalReview";
import {
  Field,
  formatPartnerDate,
} from "@/app/admin/legal-profile/_components/PartnerLegalReview/reviewField";

export { Field, formatPartnerDate };

export function partnerStatusColor(status) {
  if (status === "VERIFIED") return "success";
  if (status === "PENDING_VERIFICATION") return "warning";
  if (status === "REJECTED" || status === "SUSPENDED") return "error";
  return "default";
}

/**
 * KYB detail for one partner — company-level review workflow.
 * Shared by Partners → Needs review and the partner Legal tab.
 */
export default function PartnerReviewDetail({
  row,
  onChanged,
  viewMode,
  onLeftQueue,
}) {
  return (
    <PartnerLegalReview
      row={row}
      onChanged={onChanged}
      viewMode={viewMode}
      onLeftQueue={onLeftQueue}
    />
  );
}
