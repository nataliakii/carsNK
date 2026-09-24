"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import PartnerLegalProfileSection from "@/app/admin/legal-profile/PartnerLegalProfileSection";
import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import { COMPANY_LEGAL_TABS } from "@/domain/legal/companyLegalPage";

import CompanyTermsPanel from "./CompanyTermsPanel";
import CompanyRentalTermsPanel from "./CompanyRentalTermsPanel";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";

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

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mb: 1, px: { xs: 1, md: 2 }, pt: 2 }}>
        {t("partnerLegal.companyPage.title")}
      </Typography>
      <Tabs
        value={value}
        onChange={(_, next) => setTab(COMPANY_LEGAL_TABS[next] || "details")}
        sx={adminSectionTabsSx}
      >
        <Tab label={t("partnerLegal.companyPage.details")} />
        <Tab label={t("partnerLegal.companyPage.documents")} />
        <Tab label={t("partnerLegal.companyPage.terms")} />
      </Tabs>
      {tab === "documents" ? (
        <PartnerLegalProfileSection
          variant="company"
          panel="documents"
          viewMode={viewMode}
          termsPublication={publication}
        />
      ) : tab === "terms" ? (
        <>
          <CompanyTermsPanel
            termsPublication={publication}
            terms={terms}
            onAccepted={reload}
          />
          <BookingFeeOutcomesTable language="en" compact />
          <CompanyRentalTermsPanel />
        </>
      ) : (
        <PartnerLegalProfileSection
          variant="company"
          panel="details"
          viewMode={viewMode}
          termsPublication={publication}
        />
      )}
    </Box>
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
