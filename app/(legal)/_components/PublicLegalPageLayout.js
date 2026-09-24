"use client";

import { Box } from "@mui/material";

import Feed from "@app/components/Feed";
import { PUBLIC_LEGAL_MAIN_CONTAINER } from "@/domain/legal/publicLegalPageLayout";

/**
 * Shared chrome for public customer legal pages:
 * PublicNavbar (via Feed) → MainContainer → content → PublicFooter (via Feed).
 */
export default function PublicLegalPageLayout({ locale, children }) {
  return (
    <Feed locale={locale}>
      <Box
        component="div"
        data-testid="public-legal-main"
        sx={PUBLIC_LEGAL_MAIN_CONTAINER}
      >
        {children}
      </Box>
    </Feed>
  );
}
