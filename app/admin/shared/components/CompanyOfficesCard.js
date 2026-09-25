"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { resolveCompanyOffices } from "@/domain/company/companyOffices";
import AdminSettingsSection, {
  adminReadableTextSx,
  adminSurfaceSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import CompanyOfficesEditor from "@/app/admin/shared/components/CompanyOfficesEditor";
import CoverageMapPreview from "@/app/admin/shared/components/CoverageMapPreview";

/**
 * Company hub — Offices tab. Pickup/return locations save via
 * /api/admin/offices (not the storefront PATCH).
 */
export default function CompanyOfficesCard({
  company,
  onSaved,
  disabled = false,
  embedded = false,
}) {
  const { t } = useTranslation();
  const [offices, setOffices] = useState(() => resolveCompanyOffices(company));
  const [ok, setOk] = useState("");

  useEffect(() => {
    setOffices(resolveCompanyOffices(company));
  }, [company]);

  const serviceAreas = company?.serviceAreas || {};
  const operatingCities = useMemo(() => {
    const fromPricing = Array.isArray(
      company?.deliveryPricing?.operatingCities
    )
      ? company.deliveryPricing.operatingCities
      : [];
    if (fromPricing.length) return fromPricing;
    return Array.isArray(company?.cities) ? company.cities : [];
  }, [company?.cities, company?.deliveryPricing?.operatingCities]);

  if (!company?._id) {
    return (
      <Typography color="text.secondary" sx={adminReadableTextSx}>
        {t("companyProfile.loadFailed")}
      </Typography>
    );
  }

  return (
    <Box sx={adminSurfaceSx(embedded)}>
      <AdminSettingsSection
        title={t("companyProfile.officesTitle")}
        description={t("companyProfile.officesHelp")}
      >
        <Box sx={{ mb: 2.5 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ mb: 1, ...adminReadableTextSx }}
          >
            {t("companyProfile.coverageMapTitle")}
          </Typography>
          <CoverageMapPreview
            offices={offices}
            radiusKm={company?.orderRadiusKm}
            cities={operatingCities}
            communityCodes={serviceAreas.communityCodes || []}
            provinceCodes={serviceAreas.provinceCodes || []}
          />
        </Box>
        <CompanyOfficesEditor
          offices={offices}
          onChange={setOffices}
          companyId={company._id}
          country={company.country}
          disabled={disabled}
          onPersisted={(nextOffices) => {
            setOk(
              t("companyProfile.officeSaved", { defaultValue: "Saved" })
            );
            onSaved?.({
              ...company,
              offices: nextOffices,
            });
          }}
        />
      </AdminSettingsSection>
      {ok ? (
        <Alert
          severity="success"
          sx={{ mt: 2 }}
          onClose={() => setOk("")}
        >
          {ok}
        </Alert>
      ) : null}
    </Box>
  );
}
