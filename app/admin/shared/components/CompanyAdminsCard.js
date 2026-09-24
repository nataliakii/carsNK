"use client";

import { Box } from "@mui/material";

import CompanyAdminsPanel from "@/app/admin/shared/components/CompanyAdminsPanel";
import { adminSurfaceSx } from "@/app/admin/shared/components/AdminSettingsSection";

/**
 * Company profile card wrapper around the shared admins panel.
 *
 * Company admins see the roster read-only; only a superadmin gets the invite
 * button and the per-row actions, which the API enforces again server-side.
 */
export default function CompanyAdminsCard({
  companyId,
  companyName = "",
  embedded = false,
}) {
  if (!companyId) return null;

  return (
    <Box sx={adminSurfaceSx(embedded)}>
      <CompanyAdminsPanel
        companyId={companyId}
        companyName={companyName}
        superAdminOnly={false}
      />
    </Box>
  );
}
