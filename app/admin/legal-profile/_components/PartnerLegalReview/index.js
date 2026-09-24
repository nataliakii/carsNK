"use client";

import { Box, Stack } from "@mui/material";

import ReviewHeader from "./ReviewHeader";
import ReviewSummary from "./ReviewSummary";
import CompanyDetails from "./CompanyDetails";
import DocumentsChecklist from "./DocumentsChecklist";
import RentalTermsSummary from "./RentalTermsSummary";
import StickyReviewActions from "./StickyReviewActions";
import { ADMIN_VIEW_MODE } from "@/domain/admin/adminViewMode";

/**
 * Company-level legal review workspace for one partner application.
 * Shared by Legal hub Partners queue and the Owners → Legal tab.
 */
export default function PartnerLegalReview({
  row,
  onChanged,
  viewMode,
  onLeftQueue,
}) {
  const canReview = viewMode === ADMIN_VIEW_MODE.PLATFORM_ADMIN;

  return (
    <Box sx={{ position: "relative", pb: { xs: 1, md: 2 } }}>
      <Stack spacing={2}>
        <ReviewHeader row={row} />
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <ReviewSummary row={row} />
          <CompanyDetails row={row} />
        </Box>
        <DocumentsChecklist row={row} onChanged={onChanged} canReview={canReview} />
        <RentalTermsSummary row={row} />
      </Stack>
      <StickyReviewActions
        row={row}
        onChanged={onChanged}
        viewMode={viewMode}
        onLeftQueue={onLeftQueue}
      />
    </Box>
  );
}
