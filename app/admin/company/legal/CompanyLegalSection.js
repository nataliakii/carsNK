"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import PartnerLegalProfileSection from "@/app/admin/legal-profile/PartnerLegalProfileSection";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import { COMPANY_LEGAL_TABS } from "@/domain/legal/companyLegalPage";

import CompanyTermsPanel from "./CompanyTermsPanel";

function tabFromSearch(searchParams) {
  const tab = searchParams?.get("tab");
  return COMPANY_LEGAL_TABS.includes(tab) ? tab : "details";
}

function CompanyLegalInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams);

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === "details") params.delete("tab");
      else params.set("tab", next);
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
        <PartnerLegalProfileSection variant="company" panel="documents" />
      ) : tab === "terms" ? (
        <CompanyTermsPanel />
      ) : (
        <PartnerLegalProfileSection variant="company" panel="details" />
      )}
    </Box>
  );
}

export default function CompanyLegalSection() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <CompanyLegalInner />
    </Suspense>
  );
}
