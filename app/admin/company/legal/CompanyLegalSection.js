"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Divider, Stack } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import CompanySettingsLayout from "@/app/admin/company/CompanySettingsLayout";
import { COMPANY_SETTINGS_FORM_MAX_WIDTH } from "@/domain/admin/companySettingsLayout";
import PartnerLegalProfileSection from "@/app/admin/legal-profile/PartnerLegalProfileSection";
import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";
import { COMPANY_LEGAL_TABS } from "@/domain/legal/companyLegalPage";

import CompanyTermsPanel from "./CompanyTermsPanel";
import CompanyRentalTermsPanel from "./CompanyRentalTermsPanel";

function tabFromSearch(searchParams) {
  const tab = searchParams?.get("step") || searchParams?.get("tab");
  return COMPANY_LEGAL_TABS.includes(tab) ? tab : "details";
}

function CompanyLegalInner({ viewMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams);

  // One server-resolved publication state, shared by Documents and Terms.
  // Neither tab re-derives it from the agreement package.
  const { termsPublication, terms, reload } = usePartnerLegalStatus();
  const publication = termsPublication || "NOT_PUBLISHED";

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.delete("tab");
      if (next === "details") params.delete("step");
      else params.set("step", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(
    () => Math.max(0, COMPANY_LEGAL_TABS.indexOf(tab)),
    [tab]
  );

  const tabs = useMemo(
    () =>
      COMPANY_LEGAL_TABS.map((id) => ({
        id,
        label: t(`partnerLegal.companyPage.${id}`),
      })),
    [t]
  );

  return (
    <CompanySettingsLayout
      title={t("partnerLegal.companyPage.title")}
      tabs={tabs}
      tabValue={value}
      onTabChange={(_, next) => setTab(COMPANY_LEGAL_TABS[next] || "details")}
    >
      {tab === "documents" ? (
        <PartnerLegalProfileSection
          variant="company"
          panel="documents"
          viewMode={viewMode}
          termsPublication={publication}
        />
      ) : tab === "terms" ? (
        <Box
          data-testid="company-legal-terms"
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          <CompanyRentalTermsPanel />
        </Box>
      ) : (
        <Stack
          data-testid="company-legal-details"
          spacing={0}
          divider={<Divider sx={{ my: 3 }} />}
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          <PartnerLegalProfileSection
            variant="company"
            panel="details"
            viewMode={viewMode}
            termsPublication={publication}
          />
          <Box
            data-testid="company-legal-terms-form"
            sx={{
              width: "100%",
              maxWidth: COMPANY_SETTINGS_FORM_MAX_WIDTH,
              minWidth: 0,
            }}
          >
            <CompanyTermsPanel
              termsPublication={publication}
              terms={terms}
              onAccepted={reload}
            />
          </Box>
        </Stack>
      )}
    </CompanySettingsLayout>
  );
}

export default function CompanyLegalSection({ viewMode }) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <CompanyLegalInner viewMode={viewMode} />
    </Suspense>
  );
}
